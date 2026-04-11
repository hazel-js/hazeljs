/**
 * Composable middleware around AI completion calls (logging, caching, retries).
 */
import logger from '@hazeljs/core';
import type { AICompletionRequest, AICompletionResponse } from '../ai-enhanced.types';

export type AICompletionHandler = (request: AICompletionRequest) => Promise<AICompletionResponse>;

export interface AIMiddleware {
  readonly name?: string;
  handle(request: AICompletionRequest, next: AICompletionHandler): Promise<AICompletionResponse>;
}

export function composeAIMiddleware(
  stack: AIMiddleware[],
  inner: AICompletionHandler
): AICompletionHandler {
  return stack.reduceRight<AICompletionHandler>((next, mw) => (req) => mw.handle(req, next), inner);
}

/** Logs request/response metadata without storing message bodies. */
export class AILoggingMiddleware implements AIMiddleware {
  readonly name = 'logging';
  constructor(
    private readonly log: (msg: string, meta?: Record<string, unknown>) => void = (msg, meta) => {
      if (meta !== undefined) {
        logger.info(msg, meta);
      } else {
        logger.info(msg);
      }
    }
  ) {}

  async handle(
    request: AICompletionRequest,
    next: AICompletionHandler
  ): Promise<AICompletionResponse> {
    const start = Date.now();
    this.log('[AI] complete:start', { messages: request.messages?.length, model: request.model });
    try {
      const res = await next(request);
      this.log('[AI] complete:ok', { ms: Date.now() - start, model: res.model });
      return res;
    } catch (e) {
      this.log('[AI] complete:error', { ms: Date.now() - start, error: String(e) });
      throw e;
    }
  }
}

export type AICacheAdapter = {
  get(key: string): Promise<AICompletionResponse | null | undefined>;
  set(key: string, value: AICompletionResponse, ttlSeconds?: number): Promise<void>;
};

/** Optional response cache keyed by a stable serialization of the request. */
export class AICachingMiddleware implements AIMiddleware {
  readonly name = 'caching';
  constructor(
    private readonly cache: AICacheAdapter,
    private readonly keyOf: (req: AICompletionRequest) => string
  ) {}

  async handle(
    request: AICompletionRequest,
    next: AICompletionHandler
  ): Promise<AICompletionResponse> {
    const key = this.keyOf(request);
    const hit = await this.cache.get(key);
    if (hit) {
      return hit;
    }
    const res = await next(request);
    await this.cache.set(key, res);
    return res;
  }
}

/** Retries transient failures with exponential backoff. */
export class AIRetryMiddleware implements AIMiddleware {
  readonly name = 'retry';
  constructor(
    private readonly maxAttempts: number = 3,
    private readonly baseDelayMs: number = 200,
    private readonly isRetryable: (err: unknown) => boolean = () => true
  ) {}

  async handle(
    request: AICompletionRequest,
    next: AICompletionHandler
  ): Promise<AICompletionResponse> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await next(request);
      } catch (e) {
        lastErr = e;
        if (attempt === this.maxAttempts || !this.isRetryable(e)) {
          throw e;
        }
        const delay = this.baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastErr;
  }
}

/** On failure of the primary handler, try a secondary completion (e.g. cheaper model). */
export class AIFallbackMiddleware implements AIMiddleware {
  readonly name = 'fallback';
  constructor(private readonly fallback: AICompletionHandler) {}

  async handle(
    request: AICompletionRequest,
    next: AICompletionHandler
  ): Promise<AICompletionResponse> {
    try {
      return await next(request);
    } catch {
      return this.fallback(request);
    }
  }
}
