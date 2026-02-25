import {
  TokenBucketLimiter,
  SlidingWindowLimiter,
  RateLimiter,
} from '../rate-limiter/rate-limiter';
import { RateLimitError } from '../types';

describe('TokenBucketLimiter', () => {
  it('should allow requests within capacity', () => {
    const limiter = new TokenBucketLimiter(5, 10);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
  });

  it('should reject when tokens exhausted', () => {
    const limiter = new TokenBucketLimiter(2, 10);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(false);
  });

  it('should refill tokens over time', async () => {
    const limiter = new TokenBucketLimiter(1, 100); // 100 tokens/sec
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(false);
    await new Promise((r) => setTimeout(r, 15)); // ~1.5 tokens
    expect(limiter.tryAcquire()).toBe(true);
  });

  it('getRetryAfterMs should return 0 when token available', () => {
    const limiter = new TokenBucketLimiter(5, 10);
    expect(limiter.getRetryAfterMs()).toBe(0);
  });

  it('getRetryAfterMs should return positive when exhausted', () => {
    const limiter = new TokenBucketLimiter(1, 100);
    limiter.tryAcquire();
    const retryAfter = limiter.getRetryAfterMs();
    expect(retryAfter).toBeGreaterThan(0);
  });
});

describe('SlidingWindowLimiter', () => {
  it('should allow requests within max', () => {
    const limiter = new SlidingWindowLimiter(5, 60_000);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
  });

  it('should reject when limit exceeded', () => {
    const limiter = new SlidingWindowLimiter(2, 60_000);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(false);
  });

  it('getRetryAfterMs should return 0 when under limit', () => {
    const limiter = new SlidingWindowLimiter(5, 60_000);
    limiter.tryAcquire();
    expect(limiter.getRetryAfterMs()).toBe(0);
  });

  it('getRetryAfterMs should return positive when at limit', () => {
    const limiter = new SlidingWindowLimiter(1, 60_000);
    limiter.tryAcquire();
    expect(limiter.getRetryAfterMs()).toBeGreaterThan(0);
  });
});

describe('RateLimiter', () => {
  describe('token-bucket strategy', () => {
    it('should execute fn when within limit', async () => {
      const limiter = new RateLimiter({
        strategy: 'token-bucket',
        max: 5,
        window: 60_000,
      });
      const result = await limiter.execute(() => Promise.resolve('ok'));
      expect(result).toBe('ok');
    });

    it('should throw RateLimitError when limit exceeded', async () => {
      const limiter = new RateLimiter({
        strategy: 'token-bucket',
        max: 1,
        window: 60_000,
      });
      await limiter.execute(() => Promise.resolve('first'));
      await expect(limiter.execute(() => Promise.resolve('second'))).rejects.toThrow(
        RateLimitError
      );
    });

    it('should include retryAfterMs in RateLimitError', async () => {
      const limiter = new RateLimiter({
        strategy: 'token-bucket',
        max: 1,
        window: 60_000,
      });
      await limiter.execute(() => Promise.resolve());
      try {
        await limiter.execute(() => Promise.resolve());
      } catch (e) {
        expect(e).toBeInstanceOf(RateLimitError);
        expect((e as RateLimitError).retryAfterMs).toBeGreaterThan(0);
      }
    });
  });

  describe('sliding-window strategy', () => {
    it('should execute fn when within limit', async () => {
      const limiter = new RateLimiter({
        strategy: 'sliding-window',
        max: 5,
        window: 60_000,
      });
      const result = await limiter.execute(() => Promise.resolve('ok'));
      expect(result).toBe('ok');
    });

    it('should throw RateLimitError when limit exceeded', async () => {
      const limiter = new RateLimiter({
        strategy: 'sliding-window',
        max: 1,
        window: 60_000,
      });
      await limiter.execute(() => Promise.resolve('first'));
      await expect(limiter.execute(() => Promise.resolve('second'))).rejects.toThrow(
        RateLimitError
      );
    });
  });

  it('tryAcquire should consume token and return boolean', () => {
    const limiter = new RateLimiter({
      strategy: 'sliding-window',
      max: 1,
      window: 60_000,
    });
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(false);
  });

  it('getRetryAfterMs should return 0 when under limit', () => {
    const limiter = new RateLimiter({
      strategy: 'sliding-window',
      max: 5,
      window: 60_000,
    });
    expect(limiter.getRetryAfterMs()).toBe(0);
  });

  it('getStrategy should return configured strategy', () => {
    const tb = new RateLimiter({ strategy: 'token-bucket', max: 10, window: 1000 });
    expect(tb.getStrategy()).toBe('token-bucket');

    const sw = new RateLimiter({ strategy: 'sliding-window', max: 10, window: 1000 });
    expect(sw.getStrategy()).toBe('sliding-window');
  });
});
