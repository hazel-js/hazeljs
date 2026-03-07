import { describe, it, expect, vi, afterEach } from 'vitest';
import { withTimeout, TimeoutError } from '../src/engine/Timeout.js';

describe('withTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns result when promise resolves before timeout', async () => {
    const result = await withTimeout(Promise.resolve(42), 1000, 'node-a');
    expect(result).toBe(42);
  });

  it('throws TimeoutError when promise exceeds timeout', async () => {
    vi.useFakeTimers();
    const slow = new Promise<number>((resolve) => {
      setTimeout(() => resolve(1), 500);
    });
    const p = withTimeout(slow, 100, 'node-x');
    vi.advanceTimersByTime(100);
    await expect(p).rejects.toThrow(TimeoutError);
    await expect(p).rejects.toMatchObject({ nodeId: 'node-x', timeoutMs: 100 });
  });
});

describe('TimeoutError', () => {
  it('has nodeId and timeoutMs', () => {
    const err = new TimeoutError('msg', 'n1', 500);
    expect(err.nodeId).toBe('n1');
    expect(err.timeoutMs).toBe(500);
  });
});
