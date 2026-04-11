/**
 * RAG-oriented evaluation helpers (Ragas-style heuristics without external deps).
 */

import { precisionAtK, recallAtK, meanReciprocalRank, ndcgAtK } from './retrieval-metrics';

export interface RagRetrievalEvalInput {
  query: string;
  retrievedIds: string[];
  relevantIds: string[];
  k?: number;
}

export interface RagRetrievalEvalResult {
  precisionAtK: number;
  recallAtK: number;
  mrr: number;
  ndcgAtK: number;
}

export function evaluateRetrieval(input: RagRetrievalEvalInput): RagRetrievalEvalResult {
  const k = input.k ?? 5;
  const rel = new Set(input.relevantIds);
  return {
    precisionAtK: precisionAtK(input.retrievedIds, rel, k),
    recallAtK: recallAtK(input.retrievedIds, rel, k),
    mrr: meanReciprocalRank(input.retrievedIds, rel),
    ndcgAtK: ndcgAtK(input.retrievedIds, rel, k),
  };
}

/** Token overlap between answer and context (cheap faithfulness proxy) */
export function answerContextOverlap(answer: string, context: string): number {
  const a = new Set(
    answer
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
  const c = new Set(
    context
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
  if (a.size === 0) return 0;
  let inter = 0;
  for (const w of a) {
    if (c.has(w)) inter++;
  }
  return inter / a.size;
}
