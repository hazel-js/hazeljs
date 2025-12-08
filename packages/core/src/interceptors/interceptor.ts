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

  constructor(options?: CacheOptions) {
    this.ttl = options?.ttl || 60000;
  }

  async intercept(context: RequestContext, next: () => Promise<unknown>): Promise<unknown> {
    if (context.method !== 'GET') {
      return next();
    }

    const cacheKey = `${context.method}:${context.url}`;
    const cached = CacheInterceptor.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }

    const result = await next();
    CacheInterceptor.cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }
}

export type Type<T = unknown> = new (...args: unknown[]) => T;
