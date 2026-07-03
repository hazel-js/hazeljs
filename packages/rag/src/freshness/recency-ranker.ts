/**
 * Recency-weighted re-ranking for RAG retrieval results.
 */

import type { FreshnessMetadata } from './extract-freshness-metadata';

export interface RecencyRankOptions {
  /** Half-life in days for exponential decay (default: 180). */
  halfLifeDays?: number;
  /** Reference time for age calculations (default: now). */
  now?: Date;
}

export interface RankableSearchResult {
  score: number;
  metadata?: Record<string, unknown>;
  content?: string;
}

function readIso(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = metadata?.[key];
  return typeof v === 'string' && v.trim() ? v : undefined;
}

function getFreshnessDate(metadata: Record<string, unknown> | undefined): string | undefined {
  if (!metadata) return undefined;
  return (
    readIso(metadata, 'contentDate') ??
    readIso(metadata, 'lastModifiedAt') ??
    readIso(metadata, 'modifiedAt') ??
    readIso(metadata, 'publishedAt') ??
    readIso(metadata, 'crawledAt') ??
    readIso(metadata, 'scrapedAt')
  );
}

function getDetectedYears(metadata: Record<string, unknown> | undefined): number[] {
  const raw = metadata?.detectedYears;
  if (!Array.isArray(raw)) return [];
  return raw.filter((y): y is number => typeof y === 'number' && Number.isFinite(y));
}

function isEvergreen(metadata: Record<string, unknown> | undefined): boolean {
  return metadata?.temporalValidity === 'evergreen';
}

/**
 * Exponential recency decay: 0.5 ^ (ageDays / halfLifeDays).
 * Returns 1.0 when no date signal or content is evergreen.
 */
export function computeRecencyDecay(
  metadata: Record<string, unknown> | undefined,
  options: RecencyRankOptions = {}
): number {
  if (isEvergreen(metadata)) return 1;

  const halfLifeDays = options.halfLifeDays ?? 180;
  const now = options.now ?? new Date();
  const dateStr = getFreshnessDate(metadata);
  const years = getDetectedYears(metadata);

  if (!dateStr && years.length === 0) return 1;

  let reference: Date;
  if (dateStr) {
    reference = new Date(dateStr);
  } else if (years.length > 0) {
    reference = new Date(Date.UTC(years[0], 6, 1));
  } else {
    return 1;
  }

  if (Number.isNaN(reference.getTime())) return 1;

  const ageMs = now.getTime() - reference.getTime();
  if (ageMs <= 0) return 1;

  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, ageDays / halfLifeDays);
}

/**
 * Apply soft recency decay to similarity scores and re-sort descending.
 */
export function applyRecencyRanking<T extends RankableSearchResult>(
  results: T[],
  options: RecencyRankOptions = {}
): T[] {
  const now = options.now ?? new Date();
  const currentYear = now.getFullYear();

  const scored = results.map((r) => {
    const meta = r.metadata ?? {};
    const years = getDetectedYears(meta);
    const hasNewerSibling = results.some((other) => {
      if (other === r) return false;
      const otherYears = getDetectedYears(other.metadata);
      if (otherYears.length === 0 || years.length === 0) return false;
      const sameUri =
        meta.canonicalSourceUri && other.metadata?.canonicalSourceUri === meta.canonicalSourceUri;
      if (!sameUri) return false;
      return Math.max(...otherYears) > Math.max(...years);
    });

    let decay = computeRecencyDecay(meta, options);

    if (years.length > 0 && years.every((y) => y < currentYear) && hasNewerSibling) {
      decay *= 0.35;
    }

    return {
      ...r,
      score: r.score * decay,
      metadata: {
        ...meta,
        recencyDecay: decay,
        recencyAdjustedScore: r.score * decay,
      },
    };
  });

  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Remove chunks that are clearly expired relative to fresher alternatives.
 */
export function filterExpiredContent<T extends RankableSearchResult>(
  results: T[],
  options: RecencyRankOptions = {}
): T[] {
  const now = options.now ?? new Date();
  const currentYear = now.getFullYear();

  return results.filter((r) => {
    const meta = r.metadata ?? {};
    if (isEvergreen(meta)) return true;

    const validUntil = readIso(meta, 'validUntil');
    if (validUntil && new Date(validUntil).getTime() < now.getTime()) {
      return false;
    }

    const years = getDetectedYears(meta);
    if (years.length > 0 && years.every((y) => y < currentYear)) {
      const hasNewer = results.some((other) => {
        if (other === r) return false;
        const otherYears = getDetectedYears(other.metadata);
        if (otherYears.length === 0) return false;
        const maxOther = Math.max(...otherYears);
        const maxSelf = Math.max(...years);
        if (maxOther <= maxSelf) return false;
        const uriMatch =
          !meta.canonicalSourceUri ||
          other.metadata?.canonicalSourceUri === meta.canonicalSourceUri ||
          String(other.metadata?.source ?? '').includes(
            String(meta.source ?? '')
              .split('/')
              .slice(0, 3)
              .join('/')
          );
        return uriMatch;
      });
      if (hasNewer) return false;
    }

    return true;
  });
}

export function formatFreshnessLabel(metadata: Record<string, unknown> | undefined): string {
  const date = getFreshnessDate(metadata);
  const years = getDetectedYears(metadata);
  if (years.length > 0) return `as of ${years[0]}`;
  if (date) {
    const d = new Date(date);
    if (!Number.isNaN(d.getTime())) {
      return `as of ${d.toISOString().slice(0, 10)}`;
    }
  }
  return '';
}

export type { FreshnessMetadata };
