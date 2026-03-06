jest.mock('@hazeljs/core', () => ({
  __esModule: true,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockGenerate = jest.fn();
const mockGenerateStream = jest.fn();
const mockEmbed = jest.fn();
const mockRerank = jest.fn();

jest.mock('cohere-ai', () => ({
  CohereClient: jest.fn().mockImplementation(() => ({
    generate: mockGenerate,
    generateStream: mockGenerateStream,
    embed: mockEmbed,
    rerank: mockRerank,
  })),
}));

import { CohereProvider } from './cohere.provider';

const BASE_REQUEST = {
  messages: [{ role: 'user' as const, content: 'Hello Cohere' }],
  model: 'command',
};

const MOCK_GENERATE_RESPONSE = {
  id: 'cohere-123',
  generations: [{ text: 'Cohere response' }],
  meta: { billedUnits: { inputTokens: 10, outputTokens: 20 } },
};

describe('CohereProvider', () => {
  let provider: CohereProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new CohereProvider('test-api-key');
  });

  describe('constructor', () => {
    it('sets name to cohere', () => {
      expect(provider.name).toBe('cohere');
    });

    it('warns when no API key', () => {
      new CohereProvider(); // Should not throw
    });

    it('uses COHERE_API_KEY env var', () => {
      process.env.COHERE_API_KEY = 'env-key';
      const p = new CohereProvider();
      expect(p).toBeDefined();
      delete process.env.COHERE_API_KEY;
    });
  });

  describe('getSupportedModels()', () => {
    it('returns list of cohere models', () => {
      const models = provider.getSupportedModels();
      expect(models).toContain('command');
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe('complete()', () => {
    it('returns a completion response', async () => {
      mockGenerate.mockResolvedValue(MOCK_GENERATE_RESPONSE);

      const result = await provider.complete(BASE_REQUEST);

      expect(result.content).toBe('Cohere response');
      expect(result.role).toBe('assistant');
      expect(result.usage?.promptTokens).toBe(10);
      expect(result.usage?.completionTokens).toBe(20);
      expect(result.usage?.totalTokens).toBe(30);
      expect(result.finishReason).toBe('COMPLETE');
    });

    it('uses default model when not specified', async () => {
      mockGenerate.mockResolvedValue(MOCK_GENERATE_RESPONSE);

      await provider.complete({ messages: [{ role: 'user', content: 'hi' }] });

      expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining({ model: 'command' }));
    });

    it('passes temperature and maxTokens to API', async () => {
      mockGenerate.mockResolvedValue(MOCK_GENERATE_RESPONSE);

      await provider.complete({ ...BASE_REQUEST, temperature: 0.5, maxTokens: 200, topP: 0.9 });

      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.5, maxTokens: 200, p: 0.9 })
      );
    });

    it('handles missing meta/billedUnits gracefully', async () => {
      mockGenerate.mockResolvedValue({
        generations: [{ text: 'ok' }],
        meta: undefined,
      });

      const result = await provider.complete(BASE_REQUEST);
      expect(result.usage?.totalTokens).toBe(0);
    });

    it('uses generated id when response has one', async () => {
      mockGenerate.mockResolvedValue(MOCK_GENERATE_RESPONSE);
      const result = await provider.complete(BASE_REQUEST);
      expect(result.id).toBe('cohere-123');
    });

    it('generates a fallback id when response has no id', async () => {
      mockGenerate.mockResolvedValue({ ...MOCK_GENERATE_RESPONSE, id: undefined });
      const result = await provider.complete(BASE_REQUEST);
      expect(result.id).toMatch(/^cohere-\d+$/);
    });

    it('converts messages to prompt format', async () => {
      mockGenerate.mockResolvedValue(MOCK_GENERATE_RESPONSE);

      await provider.complete({
        messages: [
          { role: 'user', content: 'User msg' },
          { role: 'assistant', content: 'Asst msg' },
        ],
      });

      const callArg = mockGenerate.mock.calls[0][0];
      expect(callArg.prompt).toContain('user: User msg');
      expect(callArg.prompt).toContain('assistant: Asst msg');
    });

    it('throws wrapped error on API failure', async () => {
      mockGenerate.mockRejectedValue(new Error('Quota exceeded'));
      await expect(provider.complete(BASE_REQUEST)).rejects.toThrow(
        'Cohere API error: Quota exceeded'
      );
    });

    it('wraps non-Error thrown values', async () => {
      mockGenerate.mockRejectedValue('string error');
      await expect(provider.complete(BASE_REQUEST)).rejects.toThrow(
        'Cohere API error: Unknown error'
      );
    });
  });

  describe('streamComplete()', () => {
    it('yields text-generation chunks', async () => {
      async function* mockStream() {
        yield { eventType: 'text-generation', text: 'Hello ' };
        yield { eventType: 'text-generation', text: 'world' };
        yield {
          eventType: 'stream-end',
          response: {
            meta: { billedUnits: { inputTokens: 5, outputTokens: 10 } },
          },
        };
      }

      mockGenerateStream.mockReturnValue(mockStream());

      const results: unknown[] = [];
      for await (const chunk of provider.streamComplete(BASE_REQUEST)) {
        results.push(chunk);
      }

      // 2 text chunks + 1 stream-end
      expect(results.length).toBe(3);
    });

    it('yields done=true chunk on stream-end with usage', async () => {
      async function* mockStream() {
        yield {
          eventType: 'stream-end',
          response: { meta: { billedUnits: { inputTokens: 5, outputTokens: 3 } } },
        };
      }

      mockGenerateStream.mockReturnValue(mockStream());

      const results: Array<{ done: boolean; usage?: unknown }> = [];
      for await (const chunk of provider.streamComplete(BASE_REQUEST)) {
        results.push(chunk as { done: boolean; usage?: unknown });
      }

      const last = results[results.length - 1];
      expect(last.done).toBe(true);
      expect(last.usage).toBeDefined();
    });

    it('yields stream-end with undefined usage when no billedUnits', async () => {
      async function* mockStream() {
        yield { eventType: 'stream-end', response: { meta: {} } };
      }

      mockGenerateStream.mockReturnValue(mockStream());

      const results: Array<{ done: boolean; usage?: unknown }> = [];
      for await (const chunk of provider.streamComplete(BASE_REQUEST)) {
        results.push(chunk as { done: boolean; usage?: unknown });
      }

      expect(results[0].usage).toBeUndefined();
    });

    it('ignores unknown event types', async () => {
      async function* mockStream() {
        yield { eventType: 'unknown-event' };
        yield { eventType: 'stream-end', response: {} };
      }

      mockGenerateStream.mockReturnValue(mockStream());

      const results: unknown[] = [];
      for await (const chunk of provider.streamComplete(BASE_REQUEST)) {
        results.push(chunk);
      }

      expect(results.length).toBe(1); // only stream-end
    });

    it('throws wrapped error on streaming failure', async () => {
      mockGenerateStream.mockImplementation(async function* () {
        throw new Error('Stream crashed');
        yield { eventType: 'stream-end' };
      });

      await expect(async () => {
        for await (const _chunk of provider.streamComplete(BASE_REQUEST)) {
          // consume
        }
      }).rejects.toThrow('Cohere streaming error: Stream crashed');
    });
  });

  describe('embed()', () => {
    it('returns embeddings for string array', async () => {
      mockEmbed.mockResolvedValue({
        embeddings: [
          [0.1, 0.2],
          [0.3, 0.4],
        ],
      });

      const result = await provider.embed({ input: ['first', 'second'] });

      expect(result.embeddings).toHaveLength(2);
      expect(result.model).toBe('embed-english-v3.0');
    });

    it('handles single string input', async () => {
      mockEmbed.mockResolvedValue({ embeddings: [[0.5, 0.6]] });

      const result = await provider.embed({ input: 'single' });
      expect(result.embeddings).toHaveLength(1);
    });

    it('handles { float: number[][] } response format', async () => {
      mockEmbed.mockResolvedValue({ embeddings: { float: [[0.7, 0.8]] } });

      const result = await provider.embed({ input: 'test' });
      expect(result.embeddings).toEqual([[0.7, 0.8]]);
    });

    it('uses custom model when specified', async () => {
      mockEmbed.mockResolvedValue({ embeddings: [[0.1]] });

      const result = await provider.embed({ input: 'test', model: 'embed-multilingual-v3.0' });
      expect(result.model).toBe('embed-multilingual-v3.0');
    });

    it('estimates token usage from input length', async () => {
      mockEmbed.mockResolvedValue({ embeddings: [[0.1]] });

      const result = await provider.embed({ input: 'hello world' }); // 11 chars → ~3 tokens
      expect(result.usage?.promptTokens).toBeGreaterThan(0);
    });

    it('throws wrapped error on failure', async () => {
      mockEmbed.mockRejectedValue(new Error('Embedding failed'));
      await expect(provider.embed({ input: 'test' })).rejects.toThrow(
        'Cohere embedding error: Embedding failed'
      );
    });
  });

  describe('isAvailable()', () => {
    it('returns false when no API key', async () => {
      const p = new CohereProvider('');
      expect(await p.isAvailable()).toBe(false);
    });

    it('returns true when API responds', async () => {
      mockGenerate.mockResolvedValue(MOCK_GENERATE_RESPONSE);
      expect(await provider.isAvailable()).toBe(true);
    });

    it('returns false on API error', async () => {
      mockGenerate.mockRejectedValue(new Error('Unauthorized'));
      expect(await provider.isAvailable()).toBe(false);
    });
  });

  describe('rerank()', () => {
    it('returns ranked documents', async () => {
      mockRerank.mockResolvedValue({
        results: [
          { index: 1, relevanceScore: 0.9 },
          { index: 0, relevanceScore: 0.7 },
        ],
      });

      const result = await provider.rerank('query', ['doc0', 'doc1'], 2);

      expect(result).toHaveLength(2);
      expect(result[0].score).toBe(0.9);
      expect(result[0].index).toBe(1);
      expect(result[0].document).toBe('doc1');
    });

    it('uses default rerank model', async () => {
      mockRerank.mockResolvedValue({ results: [] });

      await provider.rerank('query', ['doc1']);

      expect(mockRerank).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'rerank-english-v3.0' })
      );
    });

    it('uses custom model when specified', async () => {
      mockRerank.mockResolvedValue({ results: [] });

      await provider.rerank('query', ['doc'], undefined, 'rerank-multilingual-v3.0');

      expect(mockRerank).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'rerank-multilingual-v3.0' })
      );
    });

    it('throws wrapped error on rerank failure', async () => {
      mockRerank.mockRejectedValue(new Error('Rerank failed'));
      await expect(provider.rerank('q', ['d'])).rejects.toThrow(
        'Cohere rerank error: Rerank failed'
      );
    });
  });
});
