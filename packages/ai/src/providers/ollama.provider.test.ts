jest.mock('@hazeljs/core', () => ({
  __esModule: true,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { OllamaProvider } from './ollama.provider';

describe('OllamaProvider', () => {
  let provider: OllamaProvider;
  let mockFetch: jest.SpyInstance;

  beforeEach(() => {
    provider = new OllamaProvider();
    mockFetch = jest.spyOn(global, 'fetch' as never).mockImplementation(() => {
      throw new Error('fetch not configured in this test');
    });
  });

  afterEach(() => {
    mockFetch.mockRestore();
  });

  describe('constructor', () => {
    it('sets name to ollama', () => {
      expect(provider.name).toBe('ollama');
    });

    it('accepts custom baseURL and model', () => {
      const p = new OllamaProvider({ baseURL: 'http://custom:11434', defaultModel: 'mistral' });
      expect(p).toBeDefined();
    });

    it('uses OLLAMA_BASE_URL env var', () => {
      process.env.OLLAMA_BASE_URL = 'http://env-host:11434';
      const p = new OllamaProvider();
      expect(p).toBeDefined();
      delete process.env.OLLAMA_BASE_URL;
    });
  });

  describe('getSupportedModels()', () => {
    it('returns list including llama2', () => {
      const models = provider.getSupportedModels();
      expect(models).toContain('llama3.1');
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe('getSupportedEmbeddingModels()', () => {
    it('returns list including llama2', () => {
      const models = provider.getSupportedEmbeddingModels();
      expect(models).toContain('llama3.1');
    });
  });

  describe('complete()', () => {
    it('returns a completion response for user message', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            model: 'llama2',
            response: 'Hello world',
            done: true,
            prompt_eval_count: 10,
            eval_count: 20,
          }),
      });

      const result = await provider.complete({
        messages: [{ role: 'user', content: 'Say hello' }],
        model: 'llama2',
      });

      expect(result.content).toBe('Hello world');
      expect(result.role).toBe('assistant');
      expect(result.usage?.promptTokens).toBe(10);
      expect(result.usage?.completionTokens).toBe(20);
      expect(result.usage?.totalTokens).toBe(30);
      expect(result.finishReason).toBe('stop');
    });

    it('uses defaultModel when request has no model', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ model: 'llama2', response: 'ok', done: true }),
      });

      const result = await provider.complete({ messages: [{ role: 'user', content: 'hi' }] });
      expect(result).toBeDefined();
    });

    it('returns "length" finishReason when not done', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ model: 'llama2', response: 'partial', done: false }),
      });

      const result = await provider.complete({ messages: [{ role: 'user', content: 'hi' }] });
      expect(result.finishReason).toBe('length');
    });

    it('handles zero token counts gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ model: 'llama2', response: 'ok', done: true }),
      });

      const result = await provider.complete({ messages: [{ role: 'user', content: 'hi' }] });
      expect(result.usage?.promptTokens).toBe(0);
      expect(result.usage?.completionTokens).toBe(0);
    });

    it('transforms all message roles into prompt string', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ model: 'llama2', response: 'ok', done: true }),
      });

      await provider.complete({
        messages: [
          { role: 'system', content: 'System prompt' },
          { role: 'user', content: 'User message' },
          { role: 'assistant', content: 'Assistant response' },
        ],
      });

      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(callBody.prompt).toContain('System: System prompt');
      expect(callBody.prompt).toContain('User: User message');
      expect(callBody.prompt).toContain('Assistant: Assistant response');
    });

    it('passes temperature and maxTokens to request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ model: 'llama2', response: 'ok', done: true }),
      });

      await provider.complete({
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0.5,
        maxTokens: 100,
        topP: 0.9,
      });

      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(callBody.temperature).toBe(0.5);
      expect(callBody.num_predict).toBe(100);
      expect(callBody.top_p).toBe(0.9);
    });

    it('throws on API error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      await expect(
        provider.complete({ messages: [{ role: 'user', content: 'hi' }] })
      ).rejects.toThrow('Ollama API error: 500');
    });
  });

  describe('streamComplete()', () => {
    it('yields stream chunks', async () => {
      const encoder = new TextEncoder();
      const lines = [
        JSON.stringify({ model: 'llama2', response: 'Hello', done: false, prompt_eval_count: 5 }),
        JSON.stringify({ model: 'llama2', response: ' world', done: true, eval_count: 10 }),
      ];

      let readIdx = 0;
      const mockReader = {
        read: jest.fn().mockImplementation(() => {
          if (readIdx < lines.length) {
            return Promise.resolve({ done: false, value: encoder.encode(lines[readIdx++] + '\n') });
          }
          return Promise.resolve({ done: true, value: undefined });
        }),
        releaseLock: jest.fn(),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const results: unknown[] = [];
      for await (const chunk of provider.streamComplete({
        messages: [{ role: 'user', content: 'hi' }],
      })) {
        results.push(chunk);
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it('skips invalid JSON lines', async () => {
      const encoder = new TextEncoder();
      const lines = [
        'not-json\n',
        JSON.stringify({ model: 'llama2', response: 'ok', done: true }) + '\n',
      ];

      let readIdx = 0;
      const mockReader = {
        read: jest.fn().mockImplementation(() => {
          if (readIdx < lines.length) {
            return Promise.resolve({ done: false, value: encoder.encode(lines[readIdx++]) });
          }
          return Promise.resolve({ done: true, value: undefined });
        }),
        releaseLock: jest.fn(),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const results: unknown[] = [];
      for await (const chunk of provider.streamComplete({
        messages: [{ role: 'user', content: 'hi' }],
      })) {
        results.push(chunk);
      }
      // No error thrown; any valid chunks collected
      expect(Array.isArray(results)).toBe(true);
    });

    it('throws when response is not ok', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve('Service Unavailable'),
      });

      const gen = provider.streamComplete({ messages: [{ role: 'user', content: 'hi' }] });
      await expect(gen.next()).rejects.toThrow('Ollama API error: 503');
    });

    it('throws when response has no body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: null,
      });

      const gen = provider.streamComplete({ messages: [{ role: 'user', content: 'hi' }] });
      await expect(gen.next()).rejects.toThrow('No response body available for streaming');
    });
  });

  describe('embed()', () => {
    it('returns embeddings for string input', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ embedding: [0.1, 0.2, 0.3] }),
      });

      const result = await provider.embed({ input: 'hello world', model: 'llama2' });
      expect(result.embeddings).toHaveLength(1);
      expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3]);
      expect(result.usage?.promptTokens).toBe(0);
    });

    it('uses first element when input is an array', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ embedding: [0.5, 0.6] }),
      });

      const result = await provider.embed({ input: ['first', 'second'] });
      expect(result.embeddings).toHaveLength(1);
      // Only first element used
      const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(callBody.prompt).toBe('first');
    });

    it('uses defaultModel when no model specified', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ embedding: [0.1] }),
      });

      const result = await provider.embed({ input: 'test' });
      expect(result.model).toBe('llama3.1');
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      });

      await expect(provider.embed({ input: 'hello' })).rejects.toThrow('Ollama API error: 404');
    });
  });

  describe('isAvailable()', () => {
    it('returns true when API responds ok', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      expect(await provider.isAvailable()).toBe(true);
    });

    it('returns false when API is down (fetch rejects)', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));
      expect(await provider.isAvailable()).toBe(false);
    });

    it('returns false on non-ok response', async () => {
      mockFetch.mockResolvedValue({ ok: false });
      expect(await provider.isAvailable()).toBe(false);
    });
  });
});
