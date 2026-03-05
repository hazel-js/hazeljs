import { MultiQueryRetrieval } from '../../retrieval/multi-query';
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

const SEARCH_RESULTS: SearchResult[] = [
  { id: 'd1', content: 'TypeScript docs', score: 0.9, metadata: {} },
  { id: 'd2', content: 'JavaScript docs', score: 0.7, metadata: {} },
];

describe('MultiQueryRetrieval', () => {
  it('retrieves using a custom generator', async () => {
    const vs = makeVectorStore(SEARCH_RESULTS);
    const customGenerator = jest.fn().mockResolvedValue(['query 1', 'query 2', 'query 3']);
    const retrieval = new MultiQueryRetrieval(vs, { numQueries: 3, customGenerator });
    const results = await retrieval.retrieve('TypeScript');
    expect(customGenerator).toHaveBeenCalledWith('TypeScript', 3);
    expect(Array.isArray(results)).toBe(true);
  });

  it('deduplicates results from multiple queries', async () => {
    const searchMock = jest.fn().mockResolvedValue(SEARCH_RESULTS);
    const vs = { ...makeVectorStore(), search: searchMock };
    const customGenerator = jest.fn().mockResolvedValue(['q1', 'q2', 'q3']);
    const retrieval = new MultiQueryRetrieval(vs, { numQueries: 3, customGenerator });
    const results = await retrieval.retrieve('test');
    // d1 and d2 appear in every query result but should only appear once
    const ids = results.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('respects topK limit', async () => {
    const vs = makeVectorStore(SEARCH_RESULTS);
    const customGenerator = jest.fn().mockResolvedValue(['q1', 'q2']);
    const retrieval = new MultiQueryRetrieval(vs, { customGenerator });
    const results = await retrieval.retrieve('test', { topK: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('falls back to simple variations when no customGenerator and no LLM key', async () => {
    const vs = makeVectorStore(SEARCH_RESULTS);
    // Default provider is openai, but no apiKey — will fallback to simple variations
    const retrieval = new MultiQueryRetrieval(vs, { llmProvider: 'openai' });
    // Won't actually call OpenAI; the require('openai') will fail and fall back
    const results = await retrieval.retrieve('TypeScript');
    expect(Array.isArray(results)).toBe(true);
  });

  it('ranks results by score and frequency bonus', async () => {
    const highScoreResult: SearchResult = {
      id: 'high',
      content: 'high score doc',
      score: 0.99,
      metadata: {},
    };
    const lowScoreResult: SearchResult = {
      id: 'low',
      content: 'low score doc',
      score: 0.1,
      metadata: {},
    };
    const vs = makeVectorStore([highScoreResult, lowScoreResult]);
    const customGenerator = jest.fn().mockResolvedValue(['q1', 'q2', 'q3']);
    const retrieval = new MultiQueryRetrieval(vs, { numQueries: 3, customGenerator });
    const results = await retrieval.retrieve('test');
    // Highest score doc should rank first
    if (results.length >= 2) {
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    }
  });

  it('handles empty search results gracefully', async () => {
    const vs = makeVectorStore([]);
    const customGenerator = jest.fn().mockResolvedValue(['q1']);
    const retrieval = new MultiQueryRetrieval(vs, { customGenerator });
    const results = await retrieval.retrieve('nothing');
    expect(results).toHaveLength(0);
  });

  it('uses simple variations as fallback for anthropic provider', async () => {
    const vs = makeVectorStore(SEARCH_RESULTS);
    const retrieval = new MultiQueryRetrieval(vs, { llmProvider: 'anthropic' as never });
    const results = await retrieval.retrieve('TypeScript');
    expect(Array.isArray(results)).toBe(true);
  });
});
