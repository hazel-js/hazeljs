/**
 * Classic IR metrics for retrieval evaluation (no LLM required).
 */

/** Precision@k: fraction of top-k that are relevant */
export function precisionAtK(retrievedIds: string[], relevantIds: Set<string>, k: number): number {
  if (k <= 0) return 0;
  const top = retrievedIds.slice(0, k);
  const hits = top.filter((id) => relevantIds.has(id)).length;
  return hits / Math.min(k, top.length || 1);
}

/** Recall@k: fraction of all relevant docs found in top-k */
export function recallAtK(retrievedIds: string[], relevantIds: Set<string>, k: number): number {
  if (relevantIds.size === 0) return 1;
  const top = new Set(retrievedIds.slice(0, k));
  let hit = 0;
  for (const id of relevantIds) {
    if (top.has(id)) hit++;
  }
  return hit / relevantIds.size;
}

/** Mean Reciprocal Rank — first relevant position */
export function meanReciprocalRank(retrievedIds: string[], relevantIds: Set<string>): number {
  for (let i = 0; i < retrievedIds.length; i++) {
    if (relevantIds.has(retrievedIds[i])) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

/** Normalized Discounted Cumulative Gain (binary relevance) */
export function ndcgAtK(retrievedIds: string[], relevantIds: Set<string>, k: number): number {
  const top = retrievedIds.slice(0, k);
  const dcg = top.reduce((acc, id, idx) => {
    const rel = relevantIds.has(id) ? 1 : 0;
    return acc + (rel === 0 ? 0 : rel / Math.log2(idx + 2));
  }, 0);
  const idealHits = Math.min(relevantIds.size, k);
  let idcg = 0;
  for (let i = 0; i < idealHits; i++) {
    idcg += 1 / Math.log2(i + 2);
  }
  return idcg === 0 ? 0 : dcg / idcg;
}
