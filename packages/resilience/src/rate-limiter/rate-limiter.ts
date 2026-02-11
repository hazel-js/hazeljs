/**
 * Rate Limiter
 * Token bucket and sliding window implementations for rate limiting.
 */

import { RateLimiterConfig, RateLimitError, RateLimiterStrategy } from '../types';

/**
 * Token Bucket Rate Limiter
 * Allows bursts up to the bucket capacity and refills at a steady rate.
 */
export class TokenBucketLimiter {
  private tokens: number;
  private lastRefill: number;
  private capacity: number;
  private refillRate: number; // tokens per ms

  constructor(capacity: number, refillRatePerSecond: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRatePerSecond / 1000;
    this.lastRefill = Date.now();
  }

  /**
   * Try to consume a token. Returns true if allowed.
   */
  tryAcquire(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /**
   * Get time in ms until the next token is available
   */
  getRetryAfterMs(): number {
    this.refill();
    if (this.tokens >= 1) return 0;
    const needed = 1 - this.tokens;
    return Math.ceil(needed / this.refillRate);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

/**
 * Sliding Window Counter Rate Limiter
 * Tracks request counts in small sub-windows for more accurate rate limiting.
 */
export class SlidingWindowLimiter {
  private windows = new Map<number, number>();
  private max: number;
  private windowMs: number;
  private subWindowMs: number;

  constructor(max: number, windowMs: number) {
    this.max = max;
    this.windowMs = windowMs;
    // Use 10 sub-windows for granularity
    this.subWindowMs = Math.max(1, Math.floor(windowMs / 10));
  }

  /**
   * Try to record a request. Returns true if within limit.
   */
  tryAcquire(): boolean {
    this.evict();
    const count = this.getCurrentCount();
    if (count >= this.max) {
      return false;
    }

    const subKey = this.getCurrentSubKey();
    this.windows.set(subKey, (this.windows.get(subKey) || 0) + 1);
    return true;
  }

  /**
   * Get time in ms until a slot opens up
   */
  getRetryAfterMs(): number {
    this.evict();
    if (this.getCurrentCount() < this.max) return 0;
    // Earliest sub-window will expire after subWindowMs
    return this.subWindowMs;
  }

  private getCurrentCount(): number {
    let total = 0;
    for (const count of this.windows.values()) {
      total += count;
    }
    return total;
  }

  private getCurrentSubKey(): number {
    return Math.floor(Date.now() / this.subWindowMs);
  }

  private evict(): void {
    const cutoffKey = Math.floor((Date.now() - this.windowMs) / this.subWindowMs);
    for (const key of this.windows.keys()) {
      if (key <= cutoffKey) {
        this.windows.delete(key);
      }
    }
  }
}

/**
 * Unified RateLimiter that wraps the configured strategy
 */
export class RateLimiter {
  private limiter: TokenBucketLimiter | SlidingWindowLimiter;
  private strategy: RateLimiterStrategy;

  constructor(config: RateLimiterConfig) {
    this.strategy = config.strategy;

    if (config.strategy === 'token-bucket') {
      const refillRate = config.refillRate ?? config.max / (config.window / 1000);
      this.limiter = new TokenBucketLimiter(config.max, refillRate);
    } else {
      this.limiter = new SlidingWindowLimiter(config.max, config.window);
    }
  }

  /**
   * Execute a function within rate limit constraints
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.limiter.tryAcquire()) {
      const retryAfter = this.limiter.getRetryAfterMs();
      throw new RateLimitError(
        `Rate limit exceeded. Retry after ${retryAfter}ms`,
        retryAfter
      );
    }
    return fn();
  }

  /**
   * Try to acquire permission (consumes a token/slot)
   */
  tryAcquire(): boolean {
    return this.limiter.tryAcquire();
  }

  /**
   * Get time in ms until the next request is allowed
   */
  getRetryAfterMs(): number {
    return this.limiter.getRetryAfterMs();
  }

  /**
   * Get the strategy in use
   */
  getStrategy(): RateLimiterStrategy {
    return this.strategy;
  }
}
