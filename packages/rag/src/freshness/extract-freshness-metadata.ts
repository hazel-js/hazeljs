/**
 * Extract temporal signals from HTML, HTTP headers, sitemap data, and page text.
 */

export interface FreshnessMetadata {
  /** Best estimate of the period the content describes (ISO 8601). */
  contentDate?: string;
  /** HTTP Last-Modified or HTML meta modified date (ISO 8601). */
  lastModifiedAt?: string;
  /** Published date from meta / JSON-LD (ISO 8601). */
  publishedAt?: string;
  /** When the page was crawled (ISO 8601). */
  crawledAt?: string;
  /** Years detected in visible content (e.g. "Admissions 2025"). */
  detectedYears?: number[];
  /** LLM or heuristic classification — evergreen content is not recency-penalized. */
  temporalValidity?: 'evergreen' | 'dated';
  /** Estimated expiry for dated content (ISO 8601). */
  validUntil?: string;
}

export interface ExtractFreshnessOptions {
  html?: string;
  text?: string;
  httpLastModified?: string | null;
  sitemapLastmod?: string | null;
  crawledAt?: Date;
}

const YEAR_IN_CONTENT =
  /\b(?:fall|spring|summer|winter|admissions?|session|semester|academic\s+year|batch|class\s+of|deadline|intake)\s*(?:['']?\s*)?(20\d{2})\b/gi;
const STANDALONE_YEAR = /\b(20[2-3]\d)\b/g;

function parseIsoDate(raw: string | null | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const d = new Date(raw.trim());
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function extractMetaDates(html: string): { publishedAt?: string; modifiedAt?: string } {
  const publishedPatterns = [
    /property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
    /property=["']og:published_time["'][^>]+content=["']([^"']+)["']/i,
    /name=["']date["'][^>]+content=["']([^"']+)["']/i,
    /name=["']pubdate["'][^>]+content=["']([^"']+)["']/i,
  ];
  const modifiedPatterns = [
    /property=["']article:modified_time["'][^>]+content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]+property=["']article:modified_time["']/i,
    /property=["']og:updated_time["'][^>]+content=["']([^"']+)["']/i,
    /name=["']last-modified["'][^>]+content=["']([^"']+)["']/i,
  ];

  let publishedAt: string | undefined;
  let modifiedAt: string | undefined;

  for (const re of publishedPatterns) {
    const m = html.match(re);
    if (m?.[1]) {
      publishedAt = parseIsoDate(m[1]);
      if (publishedAt) break;
    }
  }
  for (const re of modifiedPatterns) {
    const m = html.match(re);
    if (m?.[1]) {
      modifiedAt = parseIsoDate(m[1]);
      if (modifiedAt) break;
    }
  }

  return { publishedAt, modifiedAt };
}

function extractJsonLdDates(html: string): { publishedAt?: string; modifiedAt?: string } {
  const scripts = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  if (!scripts?.length) return {};

  let publishedAt: string | undefined;
  let modifiedAt: string | undefined;

  for (const block of scripts) {
    const inner = block.replace(/<\/?script[^>]*>/gi, '').trim();
    try {
      const data = JSON.parse(inner) as Record<string, unknown> | Record<string, unknown>[];
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        if (typeof node.datePublished === 'string') {
          publishedAt = publishedAt ?? parseIsoDate(node.datePublished);
        }
        if (typeof node.dateModified === 'string') {
          modifiedAt = modifiedAt ?? parseIsoDate(node.dateModified);
        }
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  }

  return { publishedAt, modifiedAt };
}

function detectYearsInText(text: string): number[] {
  const years = new Set<number>();
  const currentYear = new Date().getFullYear();

  let m: RegExpExecArray | null;
  const contextual = new RegExp(YEAR_IN_CONTENT.source, YEAR_IN_CONTENT.flags);
  while ((m = contextual.exec(text)) !== null) {
    const y = Number(m[1]);
    if (y >= 2000 && y <= currentYear + 3) years.add(y);
  }

  const standalone = new RegExp(STANDALONE_YEAR.source, STANDALONE_YEAR.flags);
  while ((m = standalone.exec(text)) !== null) {
    const y = Number(m[1]);
    if (y >= 2000 && y <= currentYear + 3) years.add(y);
  }

  return [...years].sort((a, b) => b - a);
}

function yearToContentDate(year: number): string {
  return new Date(Date.UTC(year, 6, 1)).toISOString();
}

function pickContentDate(signals: {
  detectedYears: number[];
  lastModifiedAt?: string;
  publishedAt?: string;
  sitemapLastmod?: string;
}): string | undefined {
  if (signals.detectedYears.length > 0) {
    return yearToContentDate(signals.detectedYears[0]);
  }
  return signals.lastModifiedAt ?? signals.publishedAt ?? signals.sitemapLastmod;
}

/**
 * Extract freshness metadata from crawl signals.
 */
export function extractFreshnessMetadata(options: ExtractFreshnessOptions): FreshnessMetadata {
  const html = options.html ?? '';
  const text = options.text ?? html;
  const crawledAt = (options.crawledAt ?? new Date()).toISOString();

  const meta = html ? extractMetaDates(html) : {};
  const jsonLd = html ? extractJsonLdDates(html) : {};

  const httpModified = parseIsoDate(options.httpLastModified ?? undefined);
  const sitemapModified = parseIsoDate(options.sitemapLastmod ?? undefined);
  const publishedAt = meta.publishedAt ?? jsonLd.publishedAt;
  const lastModifiedAt = httpModified ?? meta.modifiedAt ?? jsonLd.modifiedAt ?? sitemapModified;
  const detectedYears = detectYearsInText(text);
  const contentDate = pickContentDate({
    detectedYears,
    lastModifiedAt,
    publishedAt,
    sitemapLastmod: sitemapModified,
  });

  const out: FreshnessMetadata = { crawledAt };
  if (contentDate) out.contentDate = contentDate;
  if (lastModifiedAt) out.lastModifiedAt = lastModifiedAt;
  if (publishedAt) out.publishedAt = publishedAt;
  if (detectedYears.length > 0) out.detectedYears = detectedYears;
  if (detectedYears.length > 0) out.temporalValidity = 'dated';

  return out;
}
