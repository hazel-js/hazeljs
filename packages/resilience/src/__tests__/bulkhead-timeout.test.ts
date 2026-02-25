import { Bulkhead } from '../bulkhead/bulkhead';
import { Timeout, withTimeout } from '../timeout/timeout';
import { BulkheadError, TimeoutError } from '../types';

describe('Bulkhead', () => {
  it('should allow calls within concurrency limit', async () => {
    const bulkhead = new Bulkhead({ maxConcurrent: 2, maxQueue: 0 });

    const results = await Promise.all([
      bulkhead.execute(() => Promise.resolve('a')),
      bulkhead.execute(() => Promise.resolve('b')),
    ]);

    expect(results).toEqual(['a', 'b']);
  });

  it('should reject when concurrency and queue are full', async () => {
    const bulkhead = new Bulkhead({ maxConcurrent: 1, maxQueue: 0 });

    // Start a slow call that holds the slot
    const slowCall = bulkhead.execute(
      () => new Promise((resolve) => setTimeout(() => resolve('slow'), 100))
    );

    // This should be rejected immediately
    await expect(bulkhead.execute(() => Promise.resolve('should-not-run'))).rejects.toThrow(
      BulkheadError
    );

    await slowCall;
  });

  it('should queue calls when concurrency is full', async () => {
    const bulkhead = new Bulkhead({ maxConcurrent: 1, maxQueue: 1 });
    const order: string[] = [];

    const call1 = bulkhead.execute(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      order.push('first');
      return 'first';
    });

    const call2 = bulkhead.execute(async () => {
      order.push('second');
      return 'second';
    });

    const [r1, r2] = await Promise.all([call1, call2]);
    expect(r1).toBe('first');
    expect(r2).toBe('second');
    expect(order).toEqual(['first', 'second']);
  });

  it('should track metrics', async () => {
    const bulkhead = new Bulkhead({ maxConcurrent: 2, maxQueue: 5 });
    const metrics = bulkhead.getMetrics();
    expect(metrics.activeCalls).toBe(0);
    expect(metrics.queueLength).toBe(0);
    expect(metrics.maxConcurrent).toBe(2);
    expect(metrics.maxQueue).toBe(5);
  });
});

describe('Timeout', () => {
  it('should resolve if function completes in time', async () => {
    const timeout = new Timeout(1000);
    const result = await timeout.execute(() => Promise.resolve('fast'));
    expect(result).toBe('fast');
  });

  it('should reject with TimeoutError if too slow', async () => {
    const timeout = new Timeout(50);
    await expect(
      timeout.execute(() => new Promise((resolve) => setTimeout(() => resolve('slow'), 200)))
    ).rejects.toThrow(TimeoutError);
  });

  it('should work with withTimeout helper', async () => {
    const result = await withTimeout(() => Promise.resolve('quick'), 1000);
    expect(result).toBe('quick');
  });

  it('should include duration in error message', async () => {
    const timeout = new Timeout({ duration: 50, message: 'Custom timeout' });
    try {
      await timeout.execute(() => new Promise((resolve) => setTimeout(() => resolve('slow'), 200)));
      fail('should have thrown');
    } catch (error) {
      expect((error as TimeoutError).message).toContain('Custom timeout');
      expect((error as TimeoutError).message).toContain('50ms');
    }
  });
});
