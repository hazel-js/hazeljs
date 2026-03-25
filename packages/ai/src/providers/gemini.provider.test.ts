jest.mock('@hazeljs/core', () => ({
  __esModule: true,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockGenerateContent = jest.fn();
const mockGenerateContentStream = jest.fn();
const mockEmbedContent = jest.fn();
const mockGetGenerativeModel = jest.fn().mockReturnValue({
  generateContent: mockGenerateContent,
  generateContentStream: mockGenerateContentStream,
  embedContent: mockEmbedContent,
});

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

import { GeminiProvider } from './gemini.provider';

const BASE_REQUEST = {
  messages: [{ role: 'user' as const, content: 'Hello Gemini' }],
  model: 'gemini-pro',
};

const MOCK_GENERATE_RESULT = {
  response: {
    text: jest.fn().mockReturnValue('Gemini response'),
    usageMetadata: {
      promptTokenCount: 8,
      candidatesTokenCount: 12,
      totalTokenCount: 20,
    },
    candidates: [{ finishReason: 'STOP' }],
  },
};

describe('GeminiProvider', () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    MOCK_GENERATE_RESULT.response.text.mockReturnValue('Gemini response');
    provider = new GeminiProvider('test-api-key');
  });

  describe('constructor', () => {
    it('sets name to gemini', () => {
      expect(provider.name).toBe('gemini');
    });

    it('warns when no API key', () => {
      new GeminiProvider(); // Should not throw
    });

    it('uses GEMINI_API_KEY env var', () => {
      process.env.GEMINI_API_KEY = 'env-key';
      const p = new GeminiProvider();
      expect(p).toBeDefined();
      delete process.env.GEMINI_API_KEY;
    });
  });

  describe('getSupportedModels()', () => {
    it('returns list of gemini models', () => {
      const models = provider.getSupportedModels();
      expect(models).toContain('gemini-2.5-flash');
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe('complete()', () => {
    it('returns a completion response', async () => {
      mockGenerateContent.mockResolvedValue(MOCK_GENERATE_RESULT);

      const result = await provider.complete(BASE_REQUEST);

      expect(result.content).toBe('Gemini response');
      expect(result.role).toBe('assistant');
      expect(result.usage?.promptTokens).toBe(8);
      expect(result.usage?.completionTokens).toBe(12);
      expect(result.usage?.totalTokens).toBe(20);
    });

    it('uses default model when not specified', async () => {
      mockGenerateContent.mockResolvedValue(MOCK_GENERATE_RESULT);

      await provider.complete({ messages: [{ role: 'user', content: 'hi' }] });

      expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-2.5-flash' });
    });

    it('converts messages to prompt format', async () => {
      mockGenerateContent.mockResolvedValue(MOCK_GENERATE_RESULT);

      await provider.complete({
        messages: [
          { role: 'user', content: 'User msg' },
          { role: 'assistant', content: 'Asst msg' },
          { role: 'system', content: 'Sys msg' },
        ],
      });

      const callArg = mockGenerateContent.mock.calls[0][0] as string;
      expect(callArg).toContain('user: User msg');
      expect(callArg).toContain('model: Asst msg');
      expect(callArg).toContain('system: Sys msg');
    });

    it('handles missing usageMetadata gracefully', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: jest.fn().mockReturnValue('ok'),
          usageMetadata: undefined,
          candidates: undefined,
        },
      });

      const result = await provider.complete(BASE_REQUEST);
      expect(result.usage?.totalTokens).toBe(0);
      expect(result.finishReason).toBe('STOP');
    });

    it('throws wrapped error on API failure', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Quota exceeded'));

      await expect(provider.complete(BASE_REQUEST)).rejects.toThrow(
        'Gemini API error: Quota exceeded'
      );
    });

    it('wraps non-Error thrown values', async () => {
      mockGenerateContent.mockRejectedValue('string error');

      await expect(provider.complete(BASE_REQUEST)).rejects.toThrow(
        'Gemini API error: Unknown error'
      );
    });
  });

  describe('streamComplete()', () => {
    it('yields chunks from stream', async () => {
      async function* mockStream() {
        yield {
          text: jest.fn().mockReturnValue('Hello '),
          candidates: undefined,
          usageMetadata: undefined,
        };
        yield {
          text: jest.fn().mockReturnValue('world'),
          candidates: [{ finishReason: 'STOP' }],
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3, totalTokenCount: 8 },
        };
      }

      mockGenerateContentStream.mockResolvedValue({ stream: mockStream() });

      const results: unknown[] = [];
      for await (const chunk of provider.streamComplete(BASE_REQUEST)) {
        results.push(chunk);
      }

      expect(results.length).toBe(2);
    });

    it('marks last chunk as done when finishReason is set', async () => {
      async function* mockStream() {
        yield {
          text: jest.fn().mockReturnValue('end'),
          candidates: [{ finishReason: 'STOP' }],
          usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2, totalTokenCount: 5 },
        };
      }

      mockGenerateContentStream.mockResolvedValue({ stream: mockStream() });

      const results: Array<{ done: boolean; usage?: unknown }> = [];
      for await (const chunk of provider.streamComplete(BASE_REQUEST)) {
        results.push(chunk as { done: boolean; usage?: unknown });
      }

      expect(results[0].done).toBe(true);
      expect(results[0].usage).toBeDefined();
    });

    it('yields chunks without usage when not last', async () => {
      async function* mockStream() {
        yield {
          text: jest.fn().mockReturnValue('partial'),
          candidates: undefined,
          usageMetadata: undefined,
        };
      }

      mockGenerateContentStream.mockResolvedValue({ stream: mockStream() });

      const results: Array<{ done: boolean; usage?: unknown }> = [];
      for await (const chunk of provider.streamComplete(BASE_REQUEST)) {
        results.push(chunk as { done: boolean; usage?: unknown });
      }

      expect(results[0].done).toBe(false);
      expect(results[0].usage).toBeUndefined();
    });

    it('throws wrapped error on stream failure', async () => {
      mockGenerateContentStream.mockRejectedValue(new Error('Stream failed'));

      await expect(async () => {
        for await (const _chunk of provider.streamComplete(BASE_REQUEST)) {
          // consume
        }
      }).rejects.toThrow('Gemini streaming error: Stream failed');
    });
  });

  describe('embed()', () => {
    it('returns embeddings for single string input', async () => {
      mockEmbedContent.mockResolvedValue({ embedding: { values: [0.1, 0.2, 0.3] } });

      const result = await provider.embed({ input: 'hello world', model: 'text-embedding-004' });

      expect(result.embeddings).toHaveLength(1);
      expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3]);
    });

    it('returns embeddings for array input', async () => {
      mockEmbedContent.mockResolvedValue({ embedding: { values: [0.5, 0.6] } });

      const result = await provider.embed({ input: ['first', 'second'] });

      expect(result.embeddings).toHaveLength(2);
      expect(mockEmbedContent).toHaveBeenCalledTimes(2);
    });

    it('uses default model text-embedding-004', async () => {
      mockEmbedContent.mockResolvedValue({ embedding: { values: [0.1] } });

      const result = await provider.embed({ input: 'test' });

      expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'text-embedding-004' });
      expect(result.model).toBe('text-embedding-004');
    });

    it('estimates token usage based on input length', async () => {
      mockEmbedContent.mockResolvedValue({ embedding: { values: [0.1] } });

      const result = await provider.embed({ input: 'test input' }); // 10 chars → 3 tokens

      expect(result.usage?.promptTokens).toBeGreaterThan(0);
    });

    it('throws wrapped error on API failure', async () => {
      mockEmbedContent.mockRejectedValue(new Error('Embedding failed'));

      await expect(provider.embed({ input: 'test' })).rejects.toThrow(
        'Gemini embedding error: Embedding failed'
      );
    });
  });

  describe('isAvailable()', () => {
    it('returns false when no API key', async () => {
      const p = new GeminiProvider('');
      expect(await p.isAvailable()).toBe(false);
    });

    it('returns true when API responds', async () => {
      mockGenerateContent.mockResolvedValue(MOCK_GENERATE_RESULT);
      expect(await provider.isAvailable()).toBe(true);
    });

    it('returns false on API error', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API error'));
      expect(await provider.isAvailable()).toBe(false);
    });
  });
});
