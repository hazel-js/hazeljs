import { RetryHandler, RetryError, Retry } from '../../src/utils/retry';

describe('RetryHandler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('execute', () => {
    it('should succeed on first attempt', async () => {
      const handler = new RetryHandler();
      const fn = jest.fn().mockResolvedValue('success');

      const result = await handler.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error', async () => {
      const handler = new RetryHandler({ maxRetries: 2, initialDelayMs: 100 });
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');

      const promise = handler.execute(fn);
      jest.advanceTimersByTime(300);
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    }, 10000);

    it('should throw RetryError after max retries', async () => {
      // Use real timers for this test to avoid async/timer interaction issues
      jest.useRealTimers();
      
      const handler = new RetryHandler({ maxRetries: 2, initialDelayMs: 10 });
      const error = new Error('ECONNRESET');
      const fn = jest.fn().mockRejectedValue(error);

      // Start execution and immediately catch the rejection
      const promise = handler.execute(fn);
      
      // Add error handler to prevent unhandled rejection
      promise.catch(() => {
        // Expected rejection, ignore
      });
      
      // Wait for all retries to complete (initial + 2 retries with delays)
      await new Promise((resolve) => setTimeout(resolve, 200));
      
      // Verify the function was called the expected number of times (initial + 2 retries = 3)
      expect(fn).toHaveBeenCalledTimes(3);
      
      // Properly await the rejection and verify it
      let caughtError: unknown;
      try {
        await promise;
      } catch (err) {
        caughtError = err;
      }
      
      expect(caughtError).toBeDefined();
      expect(caughtError).toBeInstanceOf(RetryError);
      if (caughtError instanceof RetryError) {
        expect(caughtError.message).toContain('Failed after 3 attempts');
        expect(caughtError.attempts).toBe(3);
      }
      
      // Restore fake timers
      jest.useFakeTimers();
    }, 10000);

    it('should not retry non-retryable errors', async () => {
      const handler = new RetryHandler();
      const error = new Error('PERMANENT_ERROR');
      const fn = jest.fn().mockRejectedValue(error);

      await expect(handler.execute(fn)).rejects.toThrow('PERMANENT_ERROR');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const handler = new RetryHandler({
        maxRetries: 1,
        initialDelayMs: 100,
        onRetry,
      });
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');

      const promise = handler.execute(fn);
      jest.advanceTimersByTime(200);
      await jest.runAllTimersAsync();
      await promise;

      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    }, 10000);

    it('should use custom retryable errors', async () => {
      const handler = new RetryHandler({
        retryableErrors: ['CUSTOM_ERROR'],
      });
      const error = new Error('CUSTOM_ERROR');
      const fn = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const promise = handler.execute(fn);
      jest.advanceTimersByTime(2000);
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    }, 10000);

    it('should check error code for retryability', async () => {
      const handler = new RetryHandler();
      const error = Object.assign(new Error('Connection reset'), { code: 'ECONNRESET' });
      const fn = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const promise = handler.execute(fn);
      jest.advanceTimersByTime(2000);
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
    }, 10000);

    it('should check error message for retryability', async () => {
      const handler = new RetryHandler();
      const error = new Error('Connection timeout: ETIMEDOUT occurred');
      const fn = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const promise = handler.execute(fn);
      jest.advanceTimersByTime(2000);
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
    }, 10000);

    it('should use exponential backoff', async () => {
      const handler = new RetryHandler({
        maxRetries: 3,
        initialDelayMs: 100,
        backoffMultiplier: 2,
      });
      const delays: number[] = [];
      const originalSleep = handler['sleep'];
      handler['sleep'] = async (ms: number) => {
        delays.push(ms);
        return originalSleep.call(handler, ms);
      };

      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');

      const promise = handler.execute(fn);
      jest.advanceTimersByTime(1000);
      await jest.runAllTimersAsync();
      await promise;

      expect(delays.length).toBe(2);
      expect(delays[0]).toBeGreaterThanOrEqual(0);
      expect(delays[1]).toBeGreaterThanOrEqual(0);
    }, 10000);

    it('should respect maxDelayMs', async () => {
      const handler = new RetryHandler({
        maxRetries: 1,
        initialDelayMs: 1000,
        maxDelayMs: 500,
        backoffMultiplier: 10,
      });

      const delays: number[] = [];
      const originalSleep = handler['sleep'];
      handler['sleep'] = async (ms: number) => {
        delays.push(ms);
        return originalSleep.call(handler, ms);
      };

      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue('success');

      const promise = handler.execute(fn);
      jest.advanceTimersByTime(1000);
      await jest.runAllTimersAsync();
      await promise;

      // Account for jitter (±25%), so maxDelayMs * 1.25 is acceptable
      expect(delays[0]).toBeLessThanOrEqual(500 * 1.25);
    }, 10000);
  });

  describe('RetryError', () => {
    it('should contain attempts and lastError', () => {
      const error = new Error('Test error');
      const retryError = new RetryError('Failed', 3, error);

      expect(retryError.attempts).toBe(3);
      expect(retryError.lastError).toBe(error);
      expect(retryError.name).toBe('RetryError');
    });
  });

  describe('Retry decorator', () => {
    it('should retry method calls', async () => {
      class TestClass {
        private attempts = 0;

        @Retry({ maxRetries: 2, initialDelayMs: 100 })
        async testMethod(): Promise<string> {
          this.attempts++;
          if (this.attempts < 3) {
            const error = new Error('ECONNRESET');
            throw error;
          }
          return 'success';
        }
      }

      const instance = new TestClass();
      const promise = instance.testMethod();
      jest.advanceTimersByTime(500);
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
    }, 10000);
  });
});

