/**
 * Boost retrieval scores when query terms match URL path segments
 * (e.g. "graduate programs" → /graduate/).
 */

import type { RankableSearchResult } from './recency-ranker';

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'how',
  'about',
  'what',
  'which',
  'does',
  'do',
  'is',
  'are',
  'was',
  'were',
  'for',
  'of',
  'in',
  'on',
  'at',
  'to',
  'and',
  'or',
  'with',
  'from',
  'can',
  'you',
  'me',
  'my',
  'your',
  'tell',
  'list',
  'show',
  'programs',
  'program',
  'programmes',
  'courses',
  'course',
  'degrees',
  'degree',
]);

function readSourceUrl(metadata: Record<string, unknown> | undefined): string | undefined {
  if (!metadata) return undefined;
  for (const key of ['source', 'url', 'canonicalSourceUri']) {
    const v = metadata[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

/** Meaningful query tokens for URL path matching. */
export function extractQueryPathTokens(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function urlPathSegments(url: string): string[] {
  try {
    return new URL(url).pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => segment.toLowerCase());
  } catch {
    return [];
  }
}

/**
 * Score multiplier when query tokens align with URL path segments.
 * Exact segment matches (e.g. "graduate" ↔ /graduate/) get a stronger boost.
 */
export function computePathRelevanceBoost(query: string, sourceUrl?: string): number {
  if (!sourceUrl?.trim()) return 1;

  const tokens = extractQueryPathTokens(query);
  if (tokens.length === 0) return 1;

  const segments = urlPathSegments(sourceUrl);
  if (segments.length === 0) return 1;

  let exactMatches = 0;
  let partialMatches = 0;

  for (const token of tokens) {
    const tokenNorm = token.replace(/-/g, ' ');
    if (segments.some((segment) => segment === token || segment.replace(/-/g, ' ') === tokenNorm)) {
      exactMatches++;
      continue;
    }
    const pathText = segments.join(' ');
    if (pathText.includes(token) || pathText.includes(tokenNorm.replace(/\s+/g, '-'))) {
      partialMatches++;
    }
  }

  if (exactMatches === 0 && partialMatches === 0) return 1;
  return 1 + exactMatches * 0.35 + partialMatches * 0.12;
}

/** Re-rank results with a URL path relevance boost for the query. */
export function applyPathRelevanceBoost<T extends RankableSearchResult>(
  results: T[],
  query: string,
): T[] {
  const trimmed = query.trim();
  if (!trimmed || results.length === 0) return results;

  const scored = results.map((r) => {
    const sourceUrl = readSourceUrl(r.metadata);
    const boost = computePathRelevanceBoost(trimmed, sourceUrl);
    if (boost === 1) return r;

    return {
      ...r,
      score: r.score * boost,
      metadata: {
        ...(r.metadata ?? {}),
        pathRelevanceBoost: boost,
        pathAdjustedScore: r.score * boost,
      },
    };
  });

  return scored.sort((a, b) => b.score - a.score);
}
