/**
 * WebLoader
 *
 * Scrapes one or more URLs and converts the page content to plain text
 * (or optionally HTML) suitable for RAG indexing.
 *
 * Two operation modes:
 *  - **built-in** (default) — uses Node.js `fetch` + a lightweight HTML
 *    stripper.  No extra dependencies.
 *  - **cheerio** mode — uses the optional `cheerio` peer dependency for
 *    CSS-selector-based content extraction (much more precise).
 *
 * Install cheerio for the selector mode:
 * ```bash
 * npm install cheerio
 * ```
 *
 * @example
 * ```typescript
 * // Scrape a single page (no extra deps)
 * const loader = new WebLoader({ url: 'https://hazeljs.ai/docs' });
 * const docs = await loader.load();
 *
 * // Scrape multiple URLs
 * const loader = new WebLoader({
 *   urls: ['https://example.com/a', 'https://example.com/b'],
 * });
 *
 * // Extract only the <article> element (requires cheerio)
 * const loader = new WebLoader({
 *   url: 'https://blog.example.com/post',
 *   selector: 'article',
 * });
 * ```
 */

import { BaseDocumentLoader, Loader } from './base.loader';
import type { Document } from '../types';

export interface WebLoaderOptions {
  /** Single URL to scrape. */
  url?: string;
  /** Multiple URLs — loaded in parallel (max `concurrency`). */
  urls?: string[];
  /**
   * CSS selector to extract content from.
   * Requires the optional `cheerio` peer dependency.
   * @example 'article', 'main', '.post-content', '#readme'
   */
  selector?: string;
  /**
   * Maximum number of concurrent fetches.
   * @default 3
   */
  concurrency?: number;
  /**
   * Request timeout in milliseconds.
   * @default 15000
   */
  timeout?: number;
  /**
   * Additional headers sent with every request.
   * @example { 'User-Agent': 'HazelJSBot/1.0' }
   */
  headers?: Record<string, string>;
  /**
   * Retry failed requests this many times before giving up.
   * @default 2
   */
  retries?: number;
  /** Extra metadata merged into every document. */
  metadata?: Record<string, unknown>;
}

@Loader({
  name: 'WebLoader',
  description: 'Scrapes web pages and converts them to plain text documents.',
  mimeTypes: ['text/html'],
})
export class WebLoader extends BaseDocumentLoader {
  private readonly urls: string[];
  private readonly selector?: string;
  private readonly concurrency: number;
  private readonly timeout: number;
  private readonly headers: Record<string, string>;
  private readonly retries: number;
  private readonly extraMetadata: Record<string, unknown>;

  constructor(options: WebLoaderOptions) {
    super();
    if (!options.url && (!options.urls || options.urls.length === 0)) {
      throw new Error('WebLoader: provide at least one URL via `url` or `urls`.');
    }
    this.urls = options.urls ?? (options.url ? [options.url] : []);
    this.selector = options.selector;
    this.concurrency = options.concurrency ?? 3;
    this.timeout = options.timeout ?? 15_000;
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; HazelJSBot/1.0)',
      ...options.headers,
    };
    this.retries = options.retries ?? 2;
    this.extraMetadata = options.metadata ?? {};
  }

  async load(): Promise<Document[]> {
    const allDocs: Document[] = [];

    // Process in chunks of `concurrency`
    for (let i = 0; i < this.urls.length; i += this.concurrency) {
      const batch = this.urls.slice(i, i + this.concurrency);
      const results = await Promise.allSettled(batch.map((url) => this.scrape(url)));

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          allDocs.push(result.value);
        } else if (result.status === 'rejected') {
          // eslint-disable-next-line no-console
          console.warn('[WebLoader] Failed to scrape URL:', result.reason);
        }
      }
    }

    return allDocs;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async scrape(url: string): Promise<Document | null> {
    const html = await this.fetchWithRetry(url);
    if (!html) return null;

    let text: string;
    let title = '';

    if (this.selector) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports
        const cheerio = require('cheerio') as any;
        const $ = cheerio.load(html);
        title = $('title').first().text().trim();
        text = $(this.selector).text().trim();
        if (!text) {
          // eslint-disable-next-line no-console
          console.warn(
            `[WebLoader] Selector "${this.selector}" found no content at ${url}. Falling back to full page.`
          );
          text = this.stripTags(html);
        }
      } catch {
        // cheerio not installed
        if (this.selector) {
          throw new Error(
            `[WebLoader] The \`selector\` option requires the optional peer dependency "cheerio". ` +
              `Run: npm install cheerio\n` +
              `Or remove the \`selector\` option to use built-in HTML stripping.`
          );
        }
        text = this.stripTags(html);
      }
    } else {
      title = this.extractTitle(html);
      text = this.stripTags(html);
    }

    return this.createDocument(text, {
      source: url,
      url,
      loaderType: 'web',
      ...(title && { title }),
      scrapedAt: new Date().toISOString(),
      ...this.extraMetadata,
    });
  }

  private async fetchWithRetry(url: string): Promise<string | null> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          headers: this.headers,
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.includes('text/')) {
          // eslint-disable-next-line no-console
          console.warn(`[WebLoader] Skipping non-text content at ${url}: ${contentType}`);
          return null;
        }

        return await response.text();
      } catch (err) {
        lastError = err;
        if (attempt < this.retries) {
          // Exponential backoff: 500ms, 1000ms, 2000ms
          await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
        }
      }
    }

    throw new Error(
      `[WebLoader] Failed to fetch ${url} after ${this.retries + 1} attempts: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`
    );
  }

  private extractTitle(html: string): string {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return match ? match[1].trim() : '';
  }

  private stripTags(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<\/(p|div|h[1-6]|li|tr|br)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
