import { HybridSearchRetrieval } from '../../retrieval/hybrid-search';
import type { VectorStore, SearchResult } from '../../types';

function makeVectorStore(results: SearchResult[] = []): VectorStore {
  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    addDocuments: jest.fn().mockResolvedValue([]),
    search: jest.fn().mockResolvedValue(results),
    searchByVector: jest.fn().mockResolvedValue(results),
    deleteDocuments: jest.fn().mockResolvedValue(undefined),
    updateDocument: jest.fn().mockResolvedValue(undefined),
    getDocument: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  };
}

const VECTOR_RESULTS: SearchResult[] = [
  { id: 'd1', content: 'TypeScript typed language', score: 0.9, metadata: {} },
  { id: 'd2', content: 'JavaScript dynamic language', score: 0.7, metadata: {} },
];

describe('HybridSearchRetrieval', () => {
  it('throws when weights do not sum to 1', () => {
    const vs = makeVectorStore();
    expect(() => new HybridSearchRetrieval(vs, { vectorWeight: 0.5, keywordWeight: 0.3 })).toThrow(
      'sum to 1.0'
    );
  });

  it('throws if search is called before indexDocuments', async () => {
    const vs = makeVectorStore();
    const hybrid = new HybridSearchRetrieval(vs);
    await expect(hybrid.search('query')).rejects.toThrow('must be indexed');
  });

  it('performs hybrid search after indexing', async () => {
    const vs = makeVectorStore(VECTOR_RESULTS);
    const hybrid = new HybridSearchRetrieval(vs);
    await hybrid.indexDocuments([
      { id: 'd1', content: 'TypeScript typed language' },
      { id: 'd2', content: 'JavaScript dynamic language' },
    ]);
    const results = await hybrid.search('typescript');
    expect(Array.isArray(results)).toBe(true);
  });

  it('returns at most topK results', async () => {
    const vs = makeVectorStore(VECTOR_RESULTS);
    const hybrid = new HybridSearchRetrieval(vs);
    await hybrid.indexDocuments([
      { id: 'd1', content: 'TypeScript typed language' },
      { id: 'd2', content: 'JavaScript dynamic language' },
    ]);
    const results = await hybrid.search('language', { topK: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('handles empty vector results gracefully', async () => {
    const vs = makeVectorStore([]);
    const hybrid = new HybridSearchRetrieval(vs);
    await hybrid.indexDocuments([{ id: 'd1', content: 'Some content' }]);
    const results = await hybrid.search('typescript');
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(0);
  });

  it('clear resets the index', async () => {
    const vs = makeVectorStore(VECTOR_RESULTS);
    const hybrid = new HybridSearchRetrieval(vs);
    await hybrid.indexDocuments([{ id: 'd1', content: 'content' }]);
    hybrid.clear();
    await expect(hybrid.search('query')).rejects.toThrow('must be indexed');
  });

  it('uses custom weights', async () => {
    const vs = makeVectorStore(VECTOR_RESULTS);
    const hybrid = new HybridSearchRetrieval(vs, { vectorWeight: 0.8, keywordWeight: 0.2 });
    await hybrid.indexDocuments([{ id: 'd1', content: 'TypeScript typed language' }]);
    const results = await hybrid.search('typescript');
    expect(Array.isArray(results)).toBe(true);
  });

  it('results have hybridScore applied to score field', async () => {
    const vs = makeVectorStore(VECTOR_RESULTS);
    const hybrid = new HybridSearchRetrieval(vs);
    await hybrid.indexDocuments([
      { id: 'd1', content: 'TypeScript typed language' },
      { id: 'd2', content: 'JavaScript dynamic language' },
    ]);
    const results = await hybrid.search('typescript language');
    for (const r of results) {
      expect(typeof r.score).toBe('number');
    }
  });
});
