import { BM25 } from '../../retrieval/bm25';

function makeDocs() {
  return [
    {
      id: 'd1',
      content: 'TypeScript is a typed superset of JavaScript',
      tokens: ['typescript', 'is', 'a', 'typed', 'superset', 'of', 'javascript'],
    },
    {
      id: 'd2',
      content: 'JavaScript runs in the browser',
      tokens: ['javascript', 'runs', 'in', 'the', 'browser'],
    },
    {
      id: 'd3',
      content: 'Python is a general purpose language',
      tokens: ['python', 'is', 'a', 'general', 'purpose', 'language'],
    },
  ];
}

describe('BM25', () => {
  it('searches and returns ranked results', () => {
    const bm25 = new BM25();
    bm25.addDocuments(makeDocs());
    const results = bm25.search('typescript');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('d1');
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('results are sorted by score descending', () => {
    const bm25 = new BM25();
    bm25.addDocuments(makeDocs());
    const results = bm25.search('javascript');
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('returns at most topK results', () => {
    const bm25 = new BM25();
    bm25.addDocuments(makeDocs());
    const results = bm25.search('is', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('returns zero score for terms not in any document', () => {
    const bm25 = new BM25();
    bm25.addDocuments(makeDocs());
    const results = bm25.search('xylophone');
    results.forEach((r) => expect(r.score).toBe(0));
  });

  it('handles empty query gracefully', () => {
    const bm25 = new BM25();
    bm25.addDocuments(makeDocs());
    const results = bm25.search('');
    expect(Array.isArray(results)).toBe(true);
  });

  it('addDocuments accumulates across calls', () => {
    const bm25 = new BM25();
    bm25.addDocuments([makeDocs()[0]]);
    bm25.addDocuments([makeDocs()[1]]);
    const results = bm25.search('javascript');
    expect(results.some((r) => r.id === 'd2')).toBe(true);
  });

  it('clear resets all state', () => {
    const bm25 = new BM25();
    bm25.addDocuments(makeDocs());
    bm25.clear();
    const results = bm25.search('typescript');
    expect(results).toHaveLength(0);
  });

  it('uses custom k1 and b parameters', () => {
    const bm25 = new BM25({ k1: 2.0, b: 0.5 });
    bm25.addDocuments(makeDocs());
    const results = bm25.search('typescript');
    expect(results.length).toBeGreaterThan(0);
  });

  it('tokenizes queries before scoring', () => {
    const bm25 = new BM25();
    bm25.addDocuments(makeDocs());
    // Query with punctuation should still match
    const results = bm25.search('TypeScript!');
    expect(results.some((r) => r.id === 'd1')).toBe(true);
  });
});
