/**
 * Route Matcher
 * Matches incoming request paths against gateway route patterns.
 * Supports glob patterns (/**), path parameters (:param), and wildcards (*).
 */

export interface RouteMatch {
  /** Whether the pattern matched */
  matched: boolean;
  /** Extracted path parameters */
  params: Record<string, string>;
  /** The remaining path after the matched prefix (for proxying) */
  remainingPath: string;
}

/**
 * Convert a route pattern to a regex for matching
 *
 * Patterns:
 *   /api/users         -> exact match
 *   /api/users/:id     -> path parameter
 *   /api/users/*       -> single segment wildcard
 *   /api/users/**      -> multi-segment wildcard (greedy)
 */
export function matchRoute(pattern: string, path: string): RouteMatch {
  const noMatch: RouteMatch = { matched: false, params: {}, remainingPath: '' };

  // Normalize paths
  const normPattern = normalizePath(pattern);
  const normPath = normalizePath(path);

  // Handle exact "**" at end (catch-all)
  if (normPattern.endsWith('/**')) {
    const prefix = normPattern.slice(0, -3); // Remove /**
    if (normPath === prefix || normPath.startsWith(prefix + '/')) {
      const remaining = normPath.slice(prefix.length) || '/';
      return {
        matched: true,
        params: {},
        remainingPath: remaining,
      };
    }
    return noMatch;
  }

  // Split into segments
  const patternSegments = normPattern.split('/').filter(Boolean);
  const pathSegments = normPath.split('/').filter(Boolean);

  // Different segment counts means no match (unless there's a wildcard)
  if (patternSegments.length !== pathSegments.length) {
    return noMatch;
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternSegments.length; i++) {
    const pSeg = patternSegments[i];
    const rSeg = pathSegments[i];

    if (pSeg.startsWith(':')) {
      // Path parameter
      params[pSeg.slice(1)] = rSeg;
    } else if (pSeg === '*') {
      // Single-segment wildcard, matches anything
      continue;
    } else if (pSeg !== rSeg) {
      return noMatch;
    }
  }

  return {
    matched: true,
    params,
    remainingPath: normPath,
  };
}

/**
 * Normalize a path: ensure leading slash, remove trailing slash
 */
function normalizePath(path: string): string {
  let normalized = path;
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Sort route patterns by specificity (most specific first)
 * Rules:
 *   1. Exact paths > parameterized paths > wildcards > catch-all
 *   2. Longer paths > shorter paths
 */
export function sortRoutesBySpecificity(patterns: string[]): string[] {
  return [...patterns].sort((a, b) => {
    const aScore = getSpecificityScore(a);
    const bScore = getSpecificityScore(b);
    if (aScore !== bScore) return bScore - aScore; // Higher score = more specific
    return b.length - a.length; // Longer = more specific
  });
}

function getSpecificityScore(pattern: string): number {
  const segments = pattern.split('/').filter(Boolean);
  let score = segments.length * 10; // Base score from segment count

  for (const seg of segments) {
    if (seg === '**') {
      score -= 5; // Catch-all is least specific
    } else if (seg === '*') {
      score -= 3; // Single wildcard
    } else if (seg.startsWith(':')) {
      score -= 1; // Parameter
    } else {
      score += 2; // Exact segment is most specific
    }
  }

  return score;
}
