import { CohereClient } from 'cohere-ai';
import { CohereReranker } from '../../reranking/cohere.reranker';

// Mock cohere-ai module
jest.mock(
  'cohere-ai',
  () => ({
    CohereClient: jest.fn().mockImplementation(() => ({
      rerank: jest.fn(),
    })),
  }),
  { virtual: true }
);

describe('CohereReranker', () => {
  let reranker: CohereReranker;
  let mockCohereClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCohereClient = new (CohereClient as any)();
    reranker = new CohereReranker({ apiKey: 'test-key' });
    // In actual implementation, this.client = new CohereClient
    // We need to ensure reranker.client is the one we control
    (reranker as any).client = mockCohereClient;
  });

  it('reranks results using Cohere API', async () => {
    const results = [
      { id: '1', content: 'Apple is a fruit', score: 0.5, metadata: {} },
      { id: '2', content: 'Banana is long', score: 0.4, metadata: {} },
    ];

    mockCohereClient.rerank.mockResolvedValue({
      results: [
        { index: 1, relevanceScore: 0.95 },
        { index: 0, relevanceScore: 0.85 },
      ],
    });

    const output = await reranker.rerank('Tell me about banana', results);

    expect(output).toHaveLength(2);
    expect(output[0].id).toBe('2'); // Banana index 1 moved to top
    expect(output[0].score).toBe(0.95);
    expect(output[1].id).toBe('1');
    expect(output[1].score).toBe(0.85);

    expect(mockCohereClient.rerank).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'Tell me about banana',
        documents: ['Apple is a fruit', 'Banana is long'],
      })
    );
  });

  it('returns empty array if input results are empty', async () => {
    const output = await reranker.rerank('query', []);
    expect(output).toEqual([]);
    expect(mockCohereClient.rerank).not.toHaveBeenCalled();
  });

  it('handles Cohere API errors gracefully', async () => {
    mockCohereClient.rerank.mockRejectedValue(new Error('API Down'));

    await expect(
      reranker.rerank('q', [{ id: '1', content: 'c', score: 1, metadata: {} }])
    ).rejects.toThrow('Failed to rerank results using Cohere: Error: API Down');
  });

  it('uses default model and maxChunksPerDoc if not provided', () => {
    const customReranker = new CohereReranker({ apiKey: 'k' });
    expect((customReranker as any).model).toBe('rerank-english-v3.0');
    expect((customReranker as any).maxChunksPerDoc).toBe(10);
  });

  it('uses custom model and maxChunksPerDoc if provided', () => {
    const customReranker = new CohereReranker({
      apiKey: 'k',
      model: 'rerank-multilingual-v3.0',
      maxChunksPerDoc: 5,
    });
    expect((customReranker as any).model).toBe('rerank-multilingual-v3.0');
    expect((customReranker as any).maxChunksPerDoc).toBe(5);
  });
});
