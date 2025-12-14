import { RateLimiter } from '../../src/utils/rate-limiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });
  describe('Token Bucket Algorithm', () => {
    it('should allow requests within rate limit', () => {
      const limiter = new RateLimiter({ tokensPerMinute: 60 });

      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.tryConsume()).toBe(true);
    });

    it('should block requests exceeding burst size', () => {
      const limiter = new RateLimiter({ tokensPerMinute: 60, burstSize: 2 });

      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.tryConsume()).toBe(false);
    });

    it('should refill tokens over time', async () => {
      const limiter = new RateLimiter({ tokensPerMinute: 600, burstSize: 1 });

      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.tryConsume()).toBe(false);

      jest.advanceTimersByTime(150);

      expect(limiter.tryConsume()).toBe(true);
    });

    it('should wait for token availability', async () => {
      const limiter = new RateLimiter({ tokensPerMinute: 600, burstSize: 1 });

      limiter.tryConsume();
      const waitPromise = limiter.waitForToken(200);
      
      // Advance timers to allow token refill
      await jest.runAllTimersAsync();
      
      const result = await waitPromise;

      expect(result).toBe(true);
    });

    it('should timeout if token not available', async () => {
      const limiter = new RateLimiter({ tokensPerMinute: 60, burstSize: 1 });

      limiter.tryConsume();
      const waitPromise = limiter.waitForToken(50);
      
      // Advance timers to trigger timeout
      await jest.runAllTimersAsync();
      
      const result = await waitPromise;

      expect(result).toBe(false);
    });

    it('should return available tokens', () => {
      const limiter = new RateLimiter({ tokensPerMinute: 60, burstSize: 10 });

      expect(limiter.getAvailableTokens()).toBe(10);
      limiter.tryConsume();
      expect(limiter.getAvailableTokens()).toBe(9);
    });

    it('should reset tokens', () => {
      const limiter = new RateLimiter({ tokensPerMinute: 60, burstSize: 5 });

      limiter.tryConsume();
      limiter.tryConsume();
      expect(limiter.getAvailableTokens()).toBe(3);

      limiter.reset();
      expect(limiter.getAvailableTokens()).toBe(5);
    });
  });
});
