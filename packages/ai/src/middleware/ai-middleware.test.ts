import type { AICompletionRequest, AICompletionResponse } from '../ai-enhanced.types';
import {
  composeAIMiddleware,
  AILoggingMiddleware,
  AICachingMiddleware,
  AIRetryMiddleware,
  AIFallbackMiddleware,
} from './ai-middleware';

const req: AICompletionRequest = {
  messages: [{ role: 'user', content: 'hi' }],
  model: 'gpt-4',
};

const res: AICompletionResponse = {
  id: 'test-res-1',
  role: 'assistant',
  content: 'ok',
  model: 'gpt-4',
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
};

describe('composeAIMiddleware', () => {
  it('chains middlewares outer-first', async () => {
    const order: string[] = [];
    const inner: (r: AICompletionRequest) => Promise<AICompletionResponse> = async () => {
      order.push('inner');
      return res;
    };
    const a = {
      name: 'a',
      handle: async (r: AICompletionRequest, next: typeof inner) => {
        order.push('a-in');
        const out = await next(r);
        order.push('a-out');
        return out;
      },
    };
    const b = {
      name: 'b',
      handle: async (r: AICompletionRequest, next: typeof inner) => {
        order.push('b-in');
        const out = await next(r);
        order.push('b-out');
        return out;
      },
    };
    const composed = composeAIMiddleware([a, b], inner);
    await composed(req);
    expect(order).toEqual(['a-in', 'b-in', 'inner', 'b-out', 'a-out']);
  });
});

describe('AILoggingMiddleware', () => {
  it('logs success path', async () => {
    const logs: string[] = [];
    const mw = new AILoggingMiddleware((msg) => logs.push(msg));
    const out = await mw.handle(req, async () => res);
    expect(out).toEqual(res);
    expect(logs.some((l) => l.includes('complete:start'))).toBe(true);
    expect(logs.some((l) => l.includes('complete:ok'))).toBe(true);
  });

  it('logs error path', async () => {
    const logs: string[] = [];
    const mw = new AILoggingMiddleware((msg) => logs.push(msg));
    const err = new Error('boom');
    await expect(
      mw.handle(req, async () => {
        throw err;
      })
    ).rejects.toThrow('boom');
    expect(logs.some((l) => l.includes('complete:error'))).toBe(true);
  });
});

describe('AICachingMiddleware', () => {
  it('returns cached response on hit', async () => {
    const cache = {
      get: jest.fn().mockResolvedValue(res),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const mw = new AICachingMiddleware(cache, () => 'k');
    const out = await mw.handle(req, async () => ({ ...res, content: 'miss' }));
    expect(out).toEqual(res);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('calls inner and sets cache on miss', async () => {
    const cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const mw = new AICachingMiddleware(cache, () => 'k');
    const out = await mw.handle(req, async () => res);
    expect(out).toEqual(res);
    expect(cache.set).toHaveBeenCalledWith('k', res);
  });
});

describe('AIRetryMiddleware', () => {
  it('retries then succeeds', async () => {
    let n = 0;
    const mw = new AIRetryMiddleware(3, 1);
    const out = await mw.handle(req, async () => {
      n += 1;
      if (n < 2) {
        throw new Error('transient');
      }
      return res;
    });
    expect(out).toEqual(res);
    expect(n).toBe(2);
  });

  it('stops when isRetryable returns false', async () => {
    const mw = new AIRetryMiddleware(3, 1, () => false);
    await expect(
      mw.handle(req, async () => {
        throw new Error('fatal');
      })
    ).rejects.toThrow('fatal');
  });
});

describe('AIFallbackMiddleware', () => {
  it('uses fallback when primary throws', async () => {
    const mw = new AIFallbackMiddleware(async () => ({ ...res, content: 'fallback' }));
    const out = await mw.handle(req, async () => {
      throw new Error('primary failed');
    });
    expect(out.content).toBe('fallback');
  });
});
