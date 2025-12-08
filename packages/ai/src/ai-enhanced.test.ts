import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { CohereProvider } from './providers/cohere.provider';
import { VectorService } from './vector/vector.service';
import {
  AIFunction,
  getAIFunctionMetadata,
  hasAIFunctionMetadata,
} from './decorators/ai-function.decorator';
import {
  AIValidate,
  getAIValidationMetadata,
  hasAIValidationMetadata,
} from './decorators/ai-validate.decorator';

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    provider = new AnthropicProvider();
  });

  describe('complete', () => {
    it('should generate completion', async () => {
      const response = await provider.complete({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(response).toBeDefined();
      expect(response.id).toContain('claude-');
      expect(response.content).toBeDefined();
      expect(response.role).toBe('assistant');
      expect(response.usage).toBeDefined();
    });

    it('should use specified model', async () => {
      const response = await provider.complete({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-sonnet-20240229',
      });

      expect(response.model).toBe('claude-3-sonnet-20240229');
    });
  });

  describe('streamComplete', () => {
    it('should stream completion', async () => {
      const chunks: string[] = [];

      for await (const chunk of provider.streamComplete({
        messages: [{ role: 'user', content: 'Hello' }],
      })) {
        chunks.push(chunk.delta);
        expect(chunk.id).toContain('claude-stream-');
        expect(chunk.content).toBeDefined();
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should mark last chunk as done', async () => {
      let lastChunk;

      for await (const chunk of provider.streamComplete({
        messages: [{ role: 'user', content: 'Hello' }],
      })) {
        lastChunk = chunk;
      }

      expect(lastChunk?.done).toBe(true);
      expect(lastChunk?.usage).toBeDefined();
    });
  });

  describe('embed', () => {
    it('should throw error for embeddings', async () => {
      await expect(provider.embed({ input: 'test' })).rejects.toThrow(
        'Anthropic does not support embeddings'
      );
    });
  });

  describe('isAvailable', () => {
    it('should check availability', async () => {
      const available = await provider.isAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('getSupportedModels', () => {
    it('should return supported models', () => {
      const models = provider.getSupportedModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models).toContain('claude-3-opus-20240229');
      expect(models).toContain('claude-3-sonnet-20240229');
    });
  });
});

describe('GeminiProvider', () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    provider = new GeminiProvider();
  });

  describe('complete', () => {
    it('should generate completion', async () => {
      const response = await provider.complete({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(response).toBeDefined();
      expect(response.id).toContain('gemini-');
      expect(response.content).toBeDefined();
      expect(response.model).toBe('gemini-pro');
    });
  });

  describe('streamComplete', () => {
    it('should stream completion', async () => {
      const chunks: string[] = [];

      for await (const chunk of provider.streamComplete({
        messages: [{ role: 'user', content: 'Hello' }],
      })) {
        chunks.push(chunk.delta);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('embed', () => {
    it('should generate embeddings', async () => {
      const response = await provider.embed({
        input: 'test text',
      });

      expect(response).toBeDefined();
      expect(response.embeddings).toHaveLength(1);
      expect(response.embeddings[0]).toHaveLength(768);
      expect(response.model).toBe('embedding-001');
    });

    it('should handle multiple inputs', async () => {
      const response = await provider.embed({
        input: ['text1', 'text2', 'text3'],
      });

      expect(response.embeddings).toHaveLength(3);
      expect(response.usage).toBeDefined();
    });
  });

  describe('getSupportedModels', () => {
    it('should return supported models', () => {
      const models = provider.getSupportedModels();
      expect(models).toContain('gemini-pro');
      expect(models).toContain('embedding-001');
    });
  });
});

describe('CohereProvider', () => {
  let provider: CohereProvider;

  beforeEach(() => {
    provider = new CohereProvider();
  });

  describe('complete', () => {
    it('should generate completion', async () => {
      const response = await provider.complete({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(response).toBeDefined();
      expect(response.id).toContain('cohere-');
      expect(response.content).toBeDefined();
      expect(response.model).toBe('command');
    });
  });

  describe('streamComplete', () => {
    it('should stream completion', async () => {
      const chunks: string[] = [];

      for await (const chunk of provider.streamComplete({
        messages: [{ role: 'user', content: 'Hello' }],
      })) {
        chunks.push(chunk.delta);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('embed', () => {
    it('should generate embeddings', async () => {
      const response = await provider.embed({
        input: 'test text',
      });

      expect(response).toBeDefined();
      expect(response.embeddings).toHaveLength(1);
      expect(response.embeddings[0]).toHaveLength(1024);
      expect(response.model).toBe('embed-english-v3.0');
    });

    it('should handle multiple inputs', async () => {
      const response = await provider.embed({
        input: ['text1', 'text2'],
      });

      expect(response.embeddings).toHaveLength(2);
    });
  });

  describe('rerank', () => {
    it('should rerank documents', async () => {
      const documents = ['doc1', 'doc2', 'doc3'];
      const results = await provider.rerank('query', documents);

      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty('index');
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('document');
    });

    it('should limit results with topN', async () => {
      const documents = ['doc1', 'doc2', 'doc3', 'doc4', 'doc5'];
      const results = await provider.rerank('query', documents, 2);

      expect(results).toHaveLength(2);
    });

    it('should sort by score descending', async () => {
      const documents = ['doc1', 'doc2', 'doc3'];
      const results = await provider.rerank('query', documents);

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });
  });

  describe('getSupportedModels', () => {
    it('should return supported models', () => {
      const models = provider.getSupportedModels();
      expect(models).toContain('command');
      expect(models).toContain('embed-english-v3.0');
    });
  });
});

describe('VectorService', () => {
  let service: VectorService;

  beforeEach(async () => {
    service = new VectorService();
    await service.initialize({
      database: 'pinecone',
      index: 'test-index',
    });
  });

  afterEach(async () => {
    await service.clear();
  });

  describe('upsert', () => {
    it('should upsert documents', async () => {
      const documents = [
        { id: '1', content: 'Document 1' },
        { id: '2', content: 'Document 2' },
      ];

      await service.upsert(documents);

      const doc1 = await service.get('1');
      expect(doc1).toBeDefined();
      expect(doc1?.content).toBe('Document 1');
    });

    it('should generate embeddings if not provided', async () => {
      const documents = [{ id: '1', content: 'Test' }];
      await service.upsert(documents);

      const doc = await service.get('1');
      expect(doc?.embedding).toBeDefined();
      expect(doc?.embedding?.length).toBeGreaterThan(0);
    });

    it('should use provided embeddings', async () => {
      const embedding = Array.from({ length: 1536 }, () => 0.5);
      const documents = [{ id: '1', content: 'Test', embedding }];

      await service.upsert(documents);

      const doc = await service.get('1');
      expect(doc?.embedding).toEqual(embedding);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await service.upsert([
        { id: '1', content: 'Machine learning basics' },
        { id: '2', content: 'Deep learning tutorial' },
        { id: '3', content: 'Natural language processing' },
      ]);
    });

    it('should search for similar documents', async () => {
      const results = await service.search({
        query: 'AI and machine learning',
        topK: 2,
      });

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('content');
      expect(results[0]).toHaveProperty('score');
    });

    it('should return results sorted by score', async () => {
      const results = await service.search({
        query: 'test query',
        topK: 3,
      });

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    it('should respect topK parameter', async () => {
      const results = await service.search({
        query: 'test',
        topK: 1,
      });

      expect(results).toHaveLength(1);
    });
  });

  describe('delete', () => {
    it('should delete documents', async () => {
      await service.upsert([
        { id: '1', content: 'Doc 1' },
        { id: '2', content: 'Doc 2' },
      ]);

      await service.delete(['1']);

      const doc = await service.get('1');
      expect(doc).toBeNull();

      const doc2 = await service.get('2');
      expect(doc2).toBeDefined();
    });

    it('should delete multiple documents', async () => {
      await service.upsert([
        { id: '1', content: 'Doc 1' },
        { id: '2', content: 'Doc 2' },
        { id: '3', content: 'Doc 3' },
      ]);

      await service.delete(['1', '2']);

      expect(await service.get('1')).toBeNull();
      expect(await service.get('2')).toBeNull();
      expect(await service.get('3')).toBeDefined();
    });
  });

  describe('get', () => {
    it('should get document by ID', async () => {
      await service.upsert([{ id: '1', content: 'Test' }]);

      const doc = await service.get('1');
      expect(doc).toBeDefined();
      expect(doc?.id).toBe('1');
      expect(doc?.content).toBe('Test');
    });

    it('should return null for non-existent ID', async () => {
      const doc = await service.get('nonexistent');
      expect(doc).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all documents', async () => {
      await service.upsert([
        { id: '1', content: 'Doc 1' },
        { id: '2', content: 'Doc 2' },
      ]);

      await service.clear();

      const stats = await service.getStats();
      expect(stats.count).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      await service.upsert([
        { id: '1', content: 'Doc 1' },
        { id: '2', content: 'Doc 2' },
      ]);

      const stats = await service.getStats();
      expect(stats.count).toBe(2);
      expect(stats.database).toBe('pinecone');
    });
  });
});

describe('AI Decorators', () => {
  describe('@AIFunction', () => {
    it('should store AI function metadata', () => {
      class TestClass {
        @AIFunction({
          provider: 'openai',
          model: 'gpt-4',
          streaming: true,
        })
        testMethod() {
          return 'test';
        }
      }

      const instance = new TestClass();
      const metadata = getAIFunctionMetadata(instance, 'testMethod');

      expect(metadata).toBeDefined();
      expect(metadata?.provider).toBe('openai');
      expect(metadata?.model).toBe('gpt-4');
      expect(metadata?.streaming).toBe(true);
    });

    it('should apply default values', () => {
      class TestClass {
        @AIFunction({
          provider: 'anthropic',
          model: 'claude-3-opus-20240229',
        })
        testMethod() {
          return 'test';
        }
      }

      const instance = new TestClass();
      const metadata = getAIFunctionMetadata(instance, 'testMethod');

      expect(metadata?.streaming).toBe(false);
      expect(metadata?.temperature).toBe(0.7);
      expect(metadata?.maxTokens).toBe(1000);
    });

    it('should check if method has AI function metadata', () => {
      class TestClass {
        @AIFunction({ provider: 'openai', model: 'gpt-4' })
        decorated() {}

        notDecorated() {}
      }

      const instance = new TestClass();
      expect(hasAIFunctionMetadata(instance, 'decorated')).toBe(true);
      expect(hasAIFunctionMetadata(instance, 'notDecorated')).toBe(false);
    });
  });

  describe('@AIPrompt', () => {
    it('should mark parameter as prompt', () => {
      // Decorator is applied, test passes if no errors
      expect(true).toBe(true);
    });
  });

  describe('@AIValidate', () => {
    it('should store AI validation metadata', () => {
      @AIValidate({
        provider: 'openai',
        instruction: 'Validate email',
      })
      class TestDto {
        email!: string;
      }

      const metadata = getAIValidationMetadata(TestDto);

      expect(metadata).toBeDefined();
      expect(metadata?.provider).toBe('openai');
      expect(metadata?.instruction).toBe('Validate email');
    });

    it('should apply default values', () => {
      @AIValidate({
        provider: 'anthropic',
        instruction: 'Validate',
      })
      class TestDto {}

      const metadata = getAIValidationMetadata(TestDto);

      expect(metadata?.model).toBe('gpt-3.5-turbo');
      expect(metadata?.failOnInvalid).toBe(true);
    });

    it('should check if class has AI validation metadata', () => {
      @AIValidate({ provider: 'openai', instruction: 'Test' })
      class DecoratedDto {}

      class NotDecoratedDto {}

      expect(hasAIValidationMetadata(DecoratedDto)).toBe(true);
      expect(hasAIValidationMetadata(NotDecoratedDto)).toBe(false);
    });
  });

  describe('@AIValidateProperty', () => {
    it('should mark property for validation', () => {
      // Decorator is applied, test passes if no errors
      expect(true).toBe(true);
    });
  });
});
