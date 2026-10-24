import type { ConfidenceAggregation, KnowledgeFact } from './types';
import { toDate } from './temporal';

export function aggregateConfidence(values: number[], mode: ConfidenceAggregation = 'min'): number {
  if (values.length === 0) return 1;
  if (mode === 'product') {
    return values.reduce((acc, v) => acc * clamp01(v), 1);
  }
  return Math.min(...values.map(clamp01));
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Rank conflicting facts: source authority → timestamp → confidence → priority.
 */
export function rankFacts(facts: KnowledgeFact[]): KnowledgeFact[] {
  return [...facts].sort((a, b) => {
    const authA = a.source?.authority ?? 0;
    const authB = b.source?.authority ?? 0;
    if (authB !== authA) return authB - authA;

    const timeA = toDate(a.createdAt)?.getTime() ?? toDate(a.validFrom)?.getTime() ?? 0;
    const timeB = toDate(b.createdAt)?.getTime() ?? toDate(b.validFrom)?.getTime() ?? 0;
    if (timeB !== timeA) return timeB - timeA;

    const confA = a.confidence ?? 0;
    const confB = b.confidence ?? 0;
    if (confB !== confA) return confB - confA;

    const priA = a.priority ?? a.source?.priority ?? 0;
    const priB = b.priority ?? b.source?.priority ?? 0;
    return priB - priA;
  });
}
