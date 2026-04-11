import { RequestContext } from '../request-context';
import logger from '../logger';

export interface Interceptor {
  intercept(context: RequestContext, next: () => Promise<unknown>): Promise<unknown>;
}

export interface InterceptorMetadata {
  type: Type<Interceptor>;
  options?: unknown;
}

export interface CacheOptions {
  ttl?: number;
  /** Max cached GET keys (LRU eviction). Default 1000. */
  maxEntries?: number;
}

export class LoggingInterceptor implements Interceptor {
  async intercept(context: RequestContext, next: () => Promise<unknown>): Promise<unknown> {
    const startTime = Date.now();
    logger.info(`[${context.method}] ${context.url}`);

    try {
      const result = await next();
      const duration = Date.now() - startTime;
      logger.info(`[${context.method}] ${context.url} - ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error as Error;
      logger.error(`[${context.method}] ${context.url} - ${err.message} (${duration}ms)`);
      throw error;
    }
  }
}

export class CacheInterceptor implements Interceptor {
  private static cache = new Map<string, { data: unknown; timestamp: number }>();
  private readonly ttl: number;
  private readonly maxEntries: number;

  constructor(options?: CacheOptions) {
    this.ttl = options?.ttl ?? 60000;
    this.maxEntries = options?.maxEntries ?? 1000;
  }

  private evictLRUIfNeeded(): void {
    while (CacheInterceptor.cache.size >= this.maxEntries) {
      const first = CacheInterceptor.cache.keys().next().value as string | undefined;
      if (first === undefined) {
        break;
      }
      CacheInterceptor.cache.delete(first);
    }
  }

  async intercept(context: RequestContext, next: () => Promise<unknown>): Promise<unknown> {
    if (context.method !== 'GET') {
      return next();
    }

    const cacheKey = `${context.method}:${context.url}`;
    const cached = CacheInterceptor.cache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.ttl) {
      CacheInterceptor.cache.delete(cacheKey);
      CacheInterceptor.cache.set(cacheKey, cached);
      return cached.data;
    }

    const result = await next();
    this.evictLRUIfNeeded();
    CacheInterceptor.cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }
}

export interface RetryOptions {
  count: number;
  delay?: number;
  retryIf?: (err: Error) => boolean;
}

export class RetryInterceptor implements Interceptor {
  async intercept(context: RequestContext, next: () => Promise<unknown>): Promise<unknown> {
    const opts = context.retryOptions;
    if (!opts || opts.count < 1) {
      return next();
    }
    const delayMs = opts.delay ?? 100;
    const shouldRetry = opts.retryIf ?? ((): boolean => true);
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= opts.count; attempt++) {
      try {
        return await next();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt === opts.count || !shouldRetry(lastError)) {
          throw lastError;
        }
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    throw lastError;
  }
}

export type Type<T = unknown> = new (...args: unknown[]) => T;
