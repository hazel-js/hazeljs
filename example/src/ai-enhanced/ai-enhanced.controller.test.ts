import { AIEnhancedController } from './ai-enhanced.controller';

describe('AIEnhancedController', () => {
  let controller: AIEnhancedController;

  beforeEach(() => {
    controller = new AIEnhancedController();
  });

  describe('generateWithClaude', () => {
    it('should generate content with Claude', async () => {
      const result = await controller.generateWithClaude({
        prompt: 'Hello, Claude!',
      });

      expect(result).toBeDefined();
      expect(result.provider).toBe('anthropic');
      expect(result.content).toBeDefined();
      expect(result.usage).toBeDefined();
    });

    it('should include model information', async () => {
      const result = await controller.generateWithClaude({
        prompt: 'Test prompt',
      });

      expect(result.model).toContain('claude');
    });
  });

  describe('streamWithClaude', () => {
    it('should stream content with Claude', async () => {
      const result = await controller.streamWithClaude({
        prompt: 'Stream test',
      });

      expect(result).toBeDefined();
      expect(result.provider).toBe('anthropic');
      expect(result.chunks).toBeDefined();
      expect(Array.isArray(result.chunks)).toBe(true);
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.fullContent).toBeDefined();
    });

    it('should combine chunks into full content', async () => {
      const result = await controller.streamWithClaude({
        prompt: 'Test',
      });

      const expectedContent = result.chunks.join('');
      expect(result.fullContent).toBe(expectedContent);
    });
  });

  describe('generateWithGemini', () => {
    it('should generate content with Gemini', async () => {
      const result = await controller.generateWithGemini({
        prompt: 'Hello, Gemini!',
      });

      expect(result).toBeDefined();
      expect(result.provider).toBe('gemini');
      expect(result.content).toBeDefined();
      expect(result.model).toBe('gemini-pro');
    });

    it('should include usage statistics', async () => {
      const result = await controller.generateWithGemini({
        prompt: 'Test',
      });

      expect(result.usage).toBeDefined();
      expect(result.usage.totalTokens).toBeGreaterThan(0);
    });
  });

  describe('generateWithCohere', () => {
    it('should generate content with Cohere', async () => {
      const result = await controller.generateWithCohere({
        prompt: 'Hello, Cohere!',
      });

      expect(result).toBeDefined();
      expect(result.provider).toBe('cohere');
      expect(result.content).toBeDefined();
      expect(result.model).toBe('command');
    });
  });

  describe('generateEmbeddings', () => {
    it('should generate embeddings with Gemini', async () => {
      const result = await controller.generateEmbeddings({
        texts: ['text1', 'text2'],
      });

      expect(result).toBeDefined();
      expect(result.provider).toBe('gemini');
      expect(result.count).toBe(2);
      expect(result.dimensions).toBe(768);
    });

    it('should handle single text', async () => {
      const result = await controller.generateEmbeddings({
        texts: ['single text'],
      });

      expect(result.count).toBe(1);
    });
  });

  describe('generateCohereEmbeddings', () => {
    it('should generate embeddings with Cohere', async () => {
      const result = await controller.generateCohereEmbeddings({
        texts: ['text1', 'text2', 'text3'],
      });

      expect(result).toBeDefined();
      expect(result.provider).toBe('cohere');
      expect(result.count).toBe(3);
      expect(result.dimensions).toBe(1024);
    });
  });

  describe('rerankDocuments', () => {
    it('should rerank documents', async () => {
      const result = await controller.rerankDocuments({
        query: 'machine learning',
        documents: ['doc1', 'doc2', 'doc3'],
      });

      expect(result).toBeDefined();
      expect(result.provider).toBe('cohere');
      expect(result.query).toBe('machine learning');
      expect(result.results).toHaveLength(3);
    });

    it('should limit results with topN', async () => {
      const result = await controller.rerankDocuments({
        query: 'test',
        documents: ['doc1', 'doc2', 'doc3', 'doc4'],
        topN: 2,
      });

      expect(result.results).toHaveLength(2);
    });

    it('should include scores', async () => {
      const result = await controller.rerankDocuments({
        query: 'test',
        documents: ['doc1', 'doc2'],
      });

      result.results.forEach(r => {
        expect(r).toHaveProperty('score');
        expect(r).toHaveProperty('index');
        expect(r).toHaveProperty('document');
      });
    });
  });

  describe('upsertDocuments', () => {
    it('should upsert documents to vector store', async () => {
      const result = await controller.upsertDocuments({
        documents: [
          { id: '1', content: 'Document 1' },
          { id: '2', content: 'Document 2' },
        ],
      });

      expect(result).toBeDefined();
      expect(result.message).toContain('success');
      expect(result.count).toBe(2);
    });

    it('should handle documents with metadata', async () => {
      const result = await controller.upsertDocuments({
        documents: [
          {
            id: '1',
            content: 'Doc with metadata',
            metadata: { category: 'test' },
          },
        ],
      });

      expect(result.count).toBe(1);
    });
  });

  describe('searchVectors', () => {
    beforeEach(async () => {
      await controller.upsertDocuments({
        documents: [
          { id: '1', content: 'Machine learning tutorial' },
          { id: '2', content: 'Deep learning basics' },
          { id: '3', content: 'Natural language processing' },
        ],
      });
    });

    it('should search vector store', async () => {
      const result = await controller.searchVectors({
        query: 'AI and ML',
      });

      expect(result).toBeDefined();
      expect(result.query).toBe('AI and ML');
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should respect topK parameter', async () => {
      const result = await controller.searchVectors({
        query: 'test',
        topK: 2,
      });

      expect(result.results.length).toBeLessThanOrEqual(2);
    });

    it('should include result count', async () => {
      const result = await controller.searchVectors({
        query: 'test',
      });

      expect(result.count).toBe(result.results.length);
    });

    it('should return results with scores', async () => {
      const result = await controller.searchVectors({
        query: 'test',
      });

      if (result.results.length > 0) {
        expect(result.results[0]).toHaveProperty('score');
        expect(result.results[0]).toHaveProperty('content');
      }
    });
  });

  describe('getVectorStats', () => {
    it('should return vector store statistics', async () => {
      const result = await controller.getVectorStats();

      expect(result).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should include database info', async () => {
      const result = await controller.getVectorStats();

      expect(result.stats).toHaveProperty('count');
      expect(result.stats).toHaveProperty('database');
    });
  });

  describe('compareProviders', () => {
    it('should compare all AI providers', async () => {
      const result = await controller.compareProviders({
        prompt: 'Test prompt',
      });

      expect(result).toBeDefined();
      expect(result.prompt).toBe('Test prompt');
      expect(result.providers).toBeDefined();
    });

    it('should include all three providers', async () => {
      const result = await controller.compareProviders({
        prompt: 'Compare test',
      });

      expect(result.providers).toHaveProperty('anthropic');
      expect(result.providers).toHaveProperty('gemini');
      expect(result.providers).toHaveProperty('cohere');
    });

    it('should include model and usage for each provider', async () => {
      const result = await controller.compareProviders({
        prompt: 'Test',
      });

      const providers = ['anthropic', 'gemini', 'cohere'] as const;
      
      providers.forEach(provider => {
        expect(result.providers[provider]).toHaveProperty('model');
        expect(result.providers[provider]).toHaveProperty('content');
        expect(result.providers[provider]).toHaveProperty('usage');
      });
    });

    it('should return different content from each provider', async () => {
      const result = await controller.compareProviders({
        prompt: 'Test',
      });

      const anthropicContent = result.providers.anthropic.content;
      const geminiContent = result.providers.gemini.content;
      const cohereContent = result.providers.cohere.content;

      expect(anthropicContent).toBeDefined();
      expect(geminiContent).toBeDefined();
      expect(cohereContent).toBeDefined();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete workflow', async () => {
      // 1. Generate embeddings
      const embeddings = await controller.generateEmbeddings({
        texts: ['test document'],
      });
      expect(embeddings.count).toBe(1);

      // 2. Upsert to vector store
      const upsert = await controller.upsertDocuments({
        documents: [{ id: '1', content: 'test document' }],
      });
      expect(upsert.count).toBe(1);

      // 3. Search vector store
      const search = await controller.searchVectors({
        query: 'test',
        topK: 1,
      });
      expect(search.results).toBeDefined();

      // 4. Get stats
      const stats = await controller.getVectorStats();
      expect(stats.stats.count).toBeGreaterThan(0);
    });

    it('should handle multiple provider comparison', async () => {
      const comparison = await controller.compareProviders({
        prompt: 'Explain quantum computing',
      });

      expect(comparison.providers.anthropic.content).toBeDefined();
      expect(comparison.providers.gemini.content).toBeDefined();
      expect(comparison.providers.cohere.content).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle empty prompt', async () => {
      const result = await controller.generateWithClaude({
        prompt: '',
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should handle empty document list', async () => {
      const result = await controller.upsertDocuments({
        documents: [],
      });

      expect(result.count).toBe(0);
    });

    it('should handle search with no results', async () => {
      const result = await controller.searchVectors({
        query: 'nonexistent query',
      });

      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });
  });
});
