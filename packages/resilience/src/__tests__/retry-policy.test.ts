import { RetryPolicy } from '../retry/retry-policy';
import { RetryExhaustedError } from '../types';

describe('RetryPolicy', () => {
  it('should succeed on first try', async () => {
    const policy = new RetryPolicy({ maxAttempts: 3 });
    const result = await policy.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });

  it('should retry on failure and eventually succeed', async () => {
    let attempts = 0;
    const policy = new RetryPolicy({
      maxAttempts: 3,
      baseDelay: 10,
      jitter: false,
      backoff: 'fixed',
    });

    const result = await policy.execute(async () => {
      attempts++;
      if (attempts < 3) throw new Error('transient');
      return 'recovered';
    });

    expect(result).toBe('recovered');
    expect(attempts).toBe(3);
  });

  it('should throw RetryExhaustedError after max attempts', async () => {
    const policy = new RetryPolicy({
      maxAttempts: 2,
      baseDelay: 10,
      jitter: false,
      backoff: 'fixed',
    });

    await expect(
      policy.execute(() => Promise.reject(new Error('always-fail')))
    ).rejects.toThrow(RetryExhaustedError);
  });

  it('should not retry non-retryable errors', async () => {
    let attempts = 0;
    const policy = new RetryPolicy({
      maxAttempts: 5,
      baseDelay: 10,
      retryPredicate: (error) =>
        error instanceof Error && error.message !== 'fatal',
    });

    await expect(
      policy.execute(async () => {
        attempts++;
        throw new Error('fatal');
      })
    ).rejects.toThrow('fatal');

    expect(attempts).toBe(1); // No retries for non-retryable
  });

  it('should call onRetry callback', async () => {
    const retries: number[] = [];
    const policy = new RetryPolicy({
      maxAttempts: 3,
      baseDelay: 10,
      jitter: false,
      backoff: 'fixed',
      onRetry: (_error, attempt) => retries.push(attempt),
    });

    await policy
      .execute(() => Promise.reject(new Error('fail')))
      .catch(() => {});

    expect(retries).toEqual([1, 2, 3]);
  });

  it('should use exponential backoff', async () => {
    const timestamps: number[] = [];
    const policy = new RetryPolicy({
      maxAttempts: 3,
      baseDelay: 50,
      jitter: false,
      backoff: 'exponential',
    });

    await policy
      .execute(async () => {
        timestamps.push(Date.now());
        throw new Error('fail');
      })
      .catch(() => {});

    // Should have 4 timestamps (initial + 3 retries)
    expect(timestamps.length).toBe(4);

    // Delays should roughly double: ~50ms, ~100ms, ~200ms
    const delay1 = timestamps[1] - timestamps[0];
    const delay2 = timestamps[2] - timestamps[1];
    expect(delay1).toBeGreaterThanOrEqual(30); // ~50ms with some tolerance
    expect(delay2).toBeGreaterThanOrEqual(60); // ~100ms with some tolerance
  });
});
