import { precisionAtK, recallAtK, meanReciprocalRank, ndcgAtK } from './retrieval-metrics';

describe('retrieval-metrics', () => {
  it('precisionAtK', () => {
    const rel = new Set(['a', 'b']);
    expect(precisionAtK(['a', 'c', 'd'], rel, 2)).toBe(0.5);
  });

  it('precisionAtK returns 0 when k <= 0', () => {
    expect(precisionAtK(['a'], new Set(['a']), 0)).toBe(0);
  });

  it('precisionAtK handles empty retrieved list', () => {
    expect(precisionAtK([], new Set(['a']), 5)).toBe(0);
  });

  it('recallAtK', () => {
    const rel = new Set(['a', 'b']);
    expect(recallAtK(['a', 'x', 'b'], rel, 3)).toBe(1);
  });

  it('recallAtK returns 1 when no relevant ids', () => {
    expect(recallAtK(['x'], new Set(), 5)).toBe(1);
  });

  it('mrr', () => {
    const rel = new Set(['b']);
    expect(meanReciprocalRank(['a', 'b', 'c'], rel)).toBe(0.5);
  });

  it('mrr returns 0 when no relevant in list', () => {
    expect(meanReciprocalRank(['x', 'y'], new Set(['z']))).toBe(0);
  });

  it('ndcgAtK', () => {
    const rel = new Set(['a', 'b']);
    expect(ndcgAtK(['a', 'b', 'c'], rel, 3)).toBeGreaterThan(0.9);
  });

  it('ndcgAtK returns 0 when ideal is empty', () => {
    expect(ndcgAtK(['a', 'b'], new Set(), 3)).toBe(0);
  });
});
