import { isTransientError, withRetry } from './retry';

describe('retry', () => {
  it('detects transient HTTP errors', () => {
    expect(isTransientError({ status: 503 })).toBe(true);
    expect(isTransientError({ status: 400 })).toBe(false);
  });

  it('retries until success', async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw Object.assign(new Error('fail'), { status: 503 });
        }
        return 'ok';
      },
      { attempts: 3, backoff: 'fixed', delayMs: 1 }
    );
    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });
});
