jest.mock('@hazeljs/core', () => ({
  __esModule: true,
  Service: () => () => undefined,
  default: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@hazeljs/cache', () => ({
  __esModule: true,
  CacheService: jest.fn(),
}));

// Prevent real SDK initialization - mock provider constructors
jest.mock('./providers/openai.provider', () => ({
  OpenAIProvider: jest.fn().mockImplementation(() => ({
    name: 'openai',
    complete: jest.fn().mockResolvedValue({
      id: '1',
      content: 'openai response',
      role: 'assistant',
      model: 'gpt-4',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    }),
    streamComplete: jest.fn(),
    embed: jest.fn(),
    isAvailable: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('./providers/anthropic.provider', () => ({
  AnthropicProvider: jest.fn().mockImplementation(() => ({
    name: 'anthropic',
    complete: jest.fn(),
    streamComplete: jest.fn(),
    embed: jest.fn(),
    isAvailable: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('./providers/gemini.provider', () => ({
  GeminiProvider: jest.fn().mockImplementation(() => ({
    name: 'gemini',
    complete: jest.fn(),
    streamComplete: jest.fn(),
    embed: jest.fn(),
    isAvailable: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('./providers/cohere.provider', () => ({
  CohereProvider: jest.fn().mockImplementation(() => ({
    name: 'cohere',
    complete: jest.fn(),
    streamComplete: jest.fn(),
    embed: jest.fn(),
    isAvailable: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('./providers/ollama.provider', () => ({
  OllamaProvider: jest.fn().mockImplementation(() => ({
    name: 'ollama',
    complete: jest.fn().mockResolvedValue({
      id: 'ollama-1',
      content: 'ollama response',
      role: 'assistant',
      model: 'llama2',
      usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
      finishReason: 'stop',
    }),
    streamComplete: jest.fn(),
    embed: jest.fn().mockResolvedValue({
      embeddings: [[0.1, 0.2, 0.3]],
      model: 'llama2',
      usage: { promptTokens: 5, totalTokens: 5 },
    }),
    isAvailable: jest.fn().mockResolvedValue(true),
  })),
}));

import { AIEnhancedService } from './ai-enhanced.service';
import { IAIProvider, AIProvider } from './ai-enhanced.types';

function makeMockProvider(name: AIProvider): IAIProvider & {
  complete: jest.Mock;
  streamComplete: jest.Mock;
  embed: jest.Mock;
  isAvailable: jest.Mock;
} {
  return {
    name,
    complete: jest.fn().mockResolvedValue({
      id: 'test-1',
      content: 'test response',
      role: 'assistant',
      model: 'test-model',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    }),
    streamComplete: jest.fn(),
    embed: jest.fn().mockResolvedValue({
      embeddings: [[0.1, 0.2]],
      model: 'test-model',
      usage: { promptTokens: 5, totalTokens: 5 },
    }),
    isAvailable: jest.fn().mockResolvedValue(true),
  };
}

const REQUEST = {
  messages: [{ role: 'user' as const, content: 'Hello' }],
  model: 'test-model',
};

describe('AIEnhancedService', () => {
  let service: AIEnhancedService;

  beforeEach(() => {
    jest.clearAllMocks();
    // No API key env vars — only ollama provider registers
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.COHERE_API_KEY;
    service = new AIEnhancedService();
    service.setRetryConfig(1, 0); // Fast retries for tests
  });

  describe('constructor', () => {
    it('creates service with default tokenTracker', () => {
      expect(service).toBeDefined();
    });

    it('registers ollama provider by default (no env keys)', () => {
      const providers = service.getAvailableProviders();
      expect(providers).toContain('ollama');
    });

    it('registers openai when OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const s = new AIEnhancedService();
      expect(s.getAvailableProviders()).toContain('openai');
      delete process.env.OPENAI_API_KEY;
    });

    it('registers anthropic when ANTHROPIC_API_KEY is set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const s = new AIEnhancedService();
      expect(s.getAvailableProviders()).toContain('anthropic');
      delete process.env.ANTHROPIC_API_KEY;
    });

    it('registers gemini when GEMINI_API_KEY is set', () => {
      process.env.GEMINI_API_KEY = 'test-key';
      const s = new AIEnhancedService();
      expect(s.getAvailableProviders()).toContain('gemini');
      delete process.env.GEMINI_API_KEY;
    });

    it('registers cohere when COHERE_API_KEY is set', () => {
      process.env.COHERE_API_KEY = 'test-key';
      const s = new AIEnhancedService();
      expect(s.getAvailableProviders()).toContain('cohere');
      delete process.env.COHERE_API_KEY;
    });
  });

  describe('registerProvider()', () => {
    it('adds a custom provider', () => {
      const mock = makeMockProvider('openai');
      service.registerProvider(mock);
      expect(service.getAvailableProviders()).toContain('openai');
    });
  });

  describe('setDefaultProvider()', () => {
    it('sets default to a registered provider', () => {
      const mock = makeMockProvider('openai');
      service.registerProvider(mock);
      expect(() => service.setDefaultProvider('openai')).not.toThrow();
    });

    it('throws for an unregistered provider', () => {
      expect(() => service.setDefaultProvider('anthropic')).toThrow(
        'Provider anthropic is not registered'
      );
    });
  });

  describe('createContext() and getContext()', () => {
    it('createContext returns an AIContextManager', () => {
      const ctx = service.createContext(2048);
      expect(ctx).toBeDefined();
      expect(ctx.maxTokens).toBe(2048);
    });

    it('getContext returns undefined before createContext()', () => {
      expect(service.getContext()).toBeUndefined();
    });

    it('getContext returns manager after createContext()', () => {
      service.createContext();
      expect(service.getContext()).toBeDefined();
    });
  });

  describe('complete()', () => {
    it('calls provider.complete() and returns response', async () => {
      const mock = makeMockProvider('openai');
      service.registerProvider(mock);
      service.setDefaultProvider('openai');

      const result = await service.complete(REQUEST);
      expect(mock.complete).toHaveBeenCalledWith(REQUEST);
      expect(result.content).toBe('test response');
    });

    it('uses specified provider from config', async () => {
      const ollamaMock = makeMockProvider('ollama');
      service.registerProvider(ollamaMock);

      await service.complete(REQUEST, { provider: 'ollama' });
      expect(ollamaMock.complete).toHaveBeenCalled();
    });

    it('throws when provider is not registered', async () => {
      await expect(service.complete(REQUEST, { provider: 'anthropic' })).rejects.toThrow(
        'Provider anthropic is not registered or available'
      );
    });

    it('tracks token usage after successful completion', async () => {
      const mock = makeMockProvider('openai');
      service.registerProvider(mock);
      service.setDefaultProvider('openai');

      await service.complete(REQUEST, { userId: 'user1' });

      const stats = service.getTokenStats('user1') as { requestCount: number };
      expect(stats.requestCount).toBe(1);
    });

    it('throws when rate limit exceeded', async () => {
      const mock = makeMockProvider('openai');
      service.registerProvider(mock);
      service.setDefaultProvider('openai');

      // Set a very tight token limit
      const tracker = (
        service as unknown as { tokenTracker: { updateConfig: (c: unknown) => void } }
      ).tokenTracker;
      tracker.updateConfig({ maxTokensPerRequest: 1 });

      await expect(service.complete(REQUEST)).rejects.toThrow('Rate limit exceeded');
    });

    it('uses cache when cacheService and cacheKey provided (cache hit)', async () => {
      const cachedResponse = {
        id: 'cached',
        content: 'cached response',
        role: 'assistant' as const,
        model: 'gpt-4',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop' as const,
      };
      const mockCache = {
        get: jest.fn().mockResolvedValue(cachedResponse),
        set: jest.fn().mockResolvedValue(undefined),
      };

      const s = new AIEnhancedService(undefined, mockCache as never);
      s.setRetryConfig(1, 0);
      const mock = makeMockProvider('openai');
      s.registerProvider(mock);
      s.setDefaultProvider('openai');

      const result = await s.complete(REQUEST, { cacheKey: 'my-key' });
      expect(result.content).toBe('cached response');
      expect(mock.complete).not.toHaveBeenCalled();
    });

    it('caches response on cache miss', async () => {
      const mockCache = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
      };

      const s = new AIEnhancedService(undefined, mockCache as never);
      s.setRetryConfig(1, 0);
      const mock = makeMockProvider('openai');
      s.registerProvider(mock);
      s.setDefaultProvider('openai');

      await s.complete(REQUEST, { cacheKey: 'new-key', cacheTTL: 60 });
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('does not check cache when no cacheKey provided', async () => {
      const mockCache = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
      };

      const s = new AIEnhancedService(undefined, mockCache as never);
      s.setRetryConfig(1, 0);
      const mock = makeMockProvider('openai');
      s.registerProvider(mock);
      s.setDefaultProvider('openai');

      await s.complete(REQUEST); // No cacheKey
      expect(mockCache.get).not.toHaveBeenCalled();
    });

    it('uses default cache TTL of 3600 when not specified', async () => {
      const mockCache = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
      };

      const s = new AIEnhancedService(undefined, mockCache as never);
      s.setRetryConfig(1, 0);
      const mock = makeMockProvider('openai');
      s.registerProvider(mock);
      s.setDefaultProvider('openai');

      await s.complete(REQUEST, { cacheKey: 'key' });
      expect(mockCache.set).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 3600);
    });

    it('skips token tracking when response has no usage', async () => {
      const mock = makeMockProvider('openai');
      mock.complete.mockResolvedValueOnce({
        id: 'no-usage',
        content: 'response',
        role: 'assistant',
        model: 'test',
        finishReason: 'stop',
      });
      service.registerProvider(mock);
      service.setDefaultProvider('openai');

      await expect(service.complete(REQUEST)).resolves.toBeDefined();
    });
  });

  describe('complete() retry logic', () => {
    it('retries on transient failure and succeeds', async () => {
      service.setRetryConfig(2, 0);

      const mock = makeMockProvider('openai');
      mock.complete.mockRejectedValueOnce(new Error('transient error')).mockResolvedValueOnce({
        id: '2',
        content: 'success after retry',
        role: 'assistant',
        model: 'test',
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        finishReason: 'stop',
      });
      service.registerProvider(mock);
      service.setDefaultProvider('openai');

      const result = await service.complete(REQUEST);
      expect(result.content).toBe('success after retry');
      expect(mock.complete).toHaveBeenCalledTimes(2);
    });

    it('throws after all retries exhausted', async () => {
      service.setRetryConfig(2, 0);

      const mock = makeMockProvider('openai');
      mock.complete.mockRejectedValue(new Error('always fails'));
      service.registerProvider(mock);
      service.setDefaultProvider('openai');

      await expect(service.complete(REQUEST)).rejects.toThrow('always fails');
      expect(mock.complete).toHaveBeenCalledTimes(2);
    });

    it('throws non-Error objects as wrapped error', async () => {
      service.setRetryConfig(1, 0);

      const mock = makeMockProvider('openai');
      mock.complete.mockRejectedValue('string error');
      service.registerProvider(mock);
      service.setDefaultProvider('openai');

      await expect(service.complete(REQUEST)).rejects.toThrow('Unknown error');
    });
  });

  describe('streamComplete()', () => {
    it('yields chunks from provider', async () => {
      const chunks = [
        { id: 'c1', content: 'Hello', delta: 'Hello', done: false },
        {
          id: 'c2',
          content: 'Hello world',
          delta: ' world',
          done: true,
          usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
        },
      ];

      async function* mockStream() {
        for (const chunk of chunks) {
          yield chunk;
        }
      }

      const mock = makeMockProvider('openai');
      mock.streamComplete.mockReturnValue(mockStream());
      service.registerProvider(mock);
      service.setDefaultProvider('openai');

      const results: unknown[] = [];
      for await (const chunk of service.streamComplete(REQUEST)) {
        results.push(chunk);
      }

      expect(results).toHaveLength(2);
    });

    it('tracks token usage from final chunk', async () => {
      async function* mockStream() {
        yield {
          id: 'c1',
          content: 'Hi',
          delta: 'Hi',
          done: true,
          usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 },
        };
      }

      const mock = makeMockProvider('openai');
      mock.streamComplete.mockReturnValue(mockStream());
      service.registerProvider(mock);
      service.setDefaultProvider('openai');

      for await (const _chunk of service.streamComplete(REQUEST, { userId: 'u1' })) {
        // consume
      }

      const stats = service.getTokenStats('u1') as { requestCount: number };
      expect(stats.requestCount).toBe(1);
    });

    it('throws rate limit error before streaming', async () => {
      const mock = makeMockProvider('openai');
      service.registerProvider(mock);
      service.setDefaultProvider('openai');

      const tracker = (
        service as unknown as { tokenTracker: { updateConfig: (c: unknown) => void } }
      ).tokenTracker;
      tracker.updateConfig({ maxTokensPerRequest: 1 });

      const gen = service.streamComplete(REQUEST);
      await expect(gen.next()).rejects.toThrow('Rate limit exceeded');
    });

    it('rethrows provider streaming errors', async () => {
      async function* failStream() {
        throw new Error('stream failed');
        yield { id: '1', content: '', delta: '', done: false };
      }

      const mock = makeMockProvider('openai');
      mock.streamComplete.mockReturnValue(failStream());
      service.registerProvider(mock);
      service.setDefaultProvider('openai');

      const results: unknown[] = [];
      await expect(async () => {
        for await (const chunk of service.streamComplete(REQUEST)) {
          results.push(chunk);
        }
      }).rejects.toThrow('stream failed');
    });
  });

  describe('embed()', () => {
    it('returns embeddings from provider', async () => {
      const mock = makeMockProvider('openai');
      service.registerProvider(mock);
      service.setDefaultProvider('openai');

      const result = await service.embed({ input: 'test' });
      expect(result.embeddings).toHaveLength(1);
    });

    it('tracks embedding token usage', async () => {
      const mock = makeMockProvider('openai');
      service.registerProvider(mock);
      service.setDefaultProvider('openai');

      await service.embed({ input: 'test' }, { userId: 'u-embed' });
      const stats = service.getTokenStats('u-embed') as { requestCount: number };
      expect(stats.requestCount).toBe(1);
    });

    it('returns cached embeddings on cache hit', async () => {
      const cached = {
        embeddings: [[9, 9]],
        model: 'test',
        usage: { promptTokens: 0, totalTokens: 0 },
      };
      const mockCache = {
        get: jest.fn().mockResolvedValue(cached),
        set: jest.fn(),
      };

      const s = new AIEnhancedService(undefined, mockCache as never);
      s.setRetryConfig(1, 0);
      const mock = makeMockProvider('openai');
      s.registerProvider(mock);
      s.setDefaultProvider('openai');

      const result = await s.embed({ input: 'test' }, { cacheKey: 'embed-key' });
      expect(result.embeddings[0]).toEqual([9, 9]);
      expect(mock.embed).not.toHaveBeenCalled();
    });

    it('caches embeddings on miss with default TTL', async () => {
      const mockCache = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
      };

      const s = new AIEnhancedService(undefined, mockCache as never);
      s.setRetryConfig(1, 0);
      const mock = makeMockProvider('openai');
      s.registerProvider(mock);
      s.setDefaultProvider('openai');

      await s.embed({ input: 'test' }, { cacheKey: 'k' });
      expect(mockCache.set).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 86400);
    });

    it('skips token tracking when usage is missing', async () => {
      const mock = makeMockProvider('openai');
      mock.embed.mockResolvedValueOnce({ embeddings: [[0.1]], model: 'test' }); // no usage
      service.registerProvider(mock);
      service.setDefaultProvider('openai');

      await expect(service.embed({ input: 'test' })).resolves.toBeDefined();
    });
  });

  describe('isProviderAvailable()', () => {
    it('returns true for an available registered provider', async () => {
      const mock = makeMockProvider('openai');
      mock.isAvailable.mockResolvedValue(true);
      service.registerProvider(mock);

      expect(await service.isProviderAvailable('openai')).toBe(true);
    });

    it('returns false for an unregistered provider', async () => {
      expect(await service.isProviderAvailable('anthropic')).toBe(false);
    });

    it('returns false when provider.isAvailable() returns false', async () => {
      const mock = makeMockProvider('openai');
      mock.isAvailable.mockResolvedValue(false);
      service.registerProvider(mock);

      expect(await service.isProviderAvailable('openai')).toBe(false);
    });
  });

  describe('getAvailableProviders()', () => {
    it('returns list of provider names', () => {
      const providers = service.getAvailableProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });
  });

  describe('getTokenStats()', () => {
    it('returns global stats when no userId', () => {
      const stats = service.getTokenStats();
      expect(stats).toBeDefined();
    });

    it('returns user-specific stats when userId provided', () => {
      const stats = service.getTokenStats('user42', 30);
      expect(stats).toBeDefined();
    });
  });

  describe('configureModel()', () => {
    it('succeeds for a registered provider', () => {
      const mock = makeMockProvider('openai');
      service.registerProvider(mock);

      expect(() =>
        service.configureModel({ provider: 'openai', model: 'gpt-4-turbo', temperature: 0.7 })
      ).not.toThrow();
    });

    it('throws for an unregistered provider', () => {
      expect(() =>
        service.configureModel({ provider: 'anthropic', model: 'claude-3', temperature: 0.5 })
      ).toThrow('Provider anthropic not found');
    });
  });

  describe('setRetryConfig()', () => {
    it('updates retry configuration', () => {
      expect(() => service.setRetryConfig(5, 500)).not.toThrow();
    });
  });
});
