import { Request, Response } from '../types';
import { MiddlewareClass, NextFunction } from './global-middleware';
import { HttpError } from '../errors/http.error';
import logger from '../logger';

/**
 * Rate limit storage interface
 */
interface RateLimitStore {
  get(key: string): Promise<number | null>;
  set(key: string, value: number, ttl: number): Promise<void>;
  increment(key: string, ttl: number): Promise<number>;
  reset(key: string): Promise<void>;
}

/**
 * In-memory rate limit store
 */
class MemoryStore implements RateLimitStore {
  private store: Map<string, { count: number; resetTime: number }> = new Map();

  async get(key: string): Promise<number | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.resetTime) {
      this.store.delete(key);
      return null;
    }

    return entry.count;
  }

  async set(key: string, value: number, ttl: number): Promise<void> {
    this.store.set(key, {
      count: value,
      resetTime: Date.now() + ttl * 1000,
    });
  }

  async increment(key: string, ttl: number): Promise<number> {
    const entry = this.store.get(key);
    const now = Date.now();

    if (!entry || now > entry.resetTime) {
      await this.set(key, 1, ttl);
      return 1;
    }

    entry.count++;
    this.store.set(key, entry);
    return entry.count;
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Rate limit options
 */
export interface RateLimitOptions {
  /**
   * Maximum number of requests
   */
  max: number;

  /**
   * Time window in seconds
   */
  windowMs: number;

  /**
   * Custom key generator function
   */
  keyGenerator?: (req: Request) => string;

  /**
   * Custom store (default: in-memory)
   */
  store?: RateLimitStore;

  /**
   * Skip successful requests
   */
  skipSuccessfulRequests?: boolean;

  /**
   * Skip failed requests
   */
  skipFailedRequests?: boolean;

  /**
   * Custom error message
   */
  message?: string;

  /**
   * Custom error status code
   */
  statusCode?: number;

  /**
   * Standard rate limit headers
   */
  standardHeaders?: boolean;

  /**
   * Legacy rate limit headers
   */
  legacyHeaders?: boolean;
}

/**
 * Rate Limiting Middleware
 * Prevents abuse by limiting the number of requests from a single IP
 */
export class RateLimitMiddleware implements MiddlewareClass {
  private store: RateLimitStore;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private options: RateLimitOptions) {
    this.store = options.store || new MemoryStore();

    // Set defaults
    this.options = {
      keyGenerator: (req: Request) => {
        const forwarded = req.headers?.['x-forwarded-for'];
        const ip = forwarded
          ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim())
          : (req as { socket?: { remoteAddress?: string } }).socket?.remoteAddress || 'unknown';
        return ip;
      },
      message: 'Too many requests, please try again later.',
      statusCode: 429,
      standardHeaders: true,
      legacyHeaders: true,
      ...options,
    };

    // Cleanup expired entries every minute
    if (this.store instanceof MemoryStore) {
      this.cleanupInterval = setInterval(() => {
        (this.store as MemoryStore).cleanup();
      }, 60000);
    }
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const key = this.options.keyGenerator!(req);
    const count = await this.store.increment(key, this.options.windowMs);

    // Set rate limit headers
    if (this.options.standardHeaders) {
      res.setHeader('RateLimit-Limit', this.options.max.toString());
      res.setHeader('RateLimit-Remaining', Math.max(0, this.options.max - count).toString());
      res.setHeader('RateLimit-Reset', new Date(Date.now() + this.options.windowMs * 1000).toISOString());
    }

    if (this.options.legacyHeaders) {
      res.setHeader('X-RateLimit-Limit', this.options.max.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.options.max - count).toString());
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + this.options.windowMs * 1000).toISOString());
    }

    // Check if limit exceeded
    if (count > this.options.max) {
      logger.warn(`Rate limit exceeded for ${key}: ${count}/${this.options.max}`);
      throw new HttpError(
        this.options.statusCode!,
        this.options.message!
      );
    }

    await next();

    // Handle skip options
    // Note: Response statusCode is set via res.status() and checked via res.writeHead
    // For now, we'll skip this check as Response interface doesn't expose statusCode directly
    // In a real implementation, you'd track the status in a response interceptor
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

