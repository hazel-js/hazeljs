import { describe, it, expect, vi, afterEach } from 'vitest';
import { delay, getRetryDelayMs } from '../src/engine/Retry.js';

describe('delay', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves after specified ms', async () => {
    vi.useFakeTimers();
    const p = delay(100);
    vi.advanceTimersByTime(100);
    await expect(p).resolves.toBeUndefined();
  });
});

describe('getRetryDelayMs', () => {
  it('returns -1 when attempt >= maxAttempts', () => {
    const policy = { maxAttempts: 3, backoff: 'fixed' as const, baseDelayMs: 100 };
    expect(getRetryDelayMs(3, policy)).toBe(-1);
    expect(getRetryDelayMs(4, policy)).toBe(-1);
  });

  it('returns baseDelayMs for fixed backoff', () => {
    const policy = { maxAttempts: 5, backoff: 'fixed' as const, baseDelayMs: 200 };
    expect(getRetryDelayMs(0, policy)).toBe(200);
    expect(getRetryDelayMs(1, policy)).toBe(200);
  });

  it('returns exponential delay for exponential backoff', () => {
    const policy = { maxAttempts: 5, backoff: 'exponential' as const, baseDelayMs: 100 };
    expect(getRetryDelayMs(0, policy)).toBe(100);
    expect(getRetryDelayMs(1, policy)).toBe(200);
    expect(getRetryDelayMs(2, policy)).toBe(400);
  });

  it('caps at maxDelayMs when provided', () => {
    const policy = {
      maxAttempts: 5,
      backoff: 'exponential' as const,
      baseDelayMs: 100,
      maxDelayMs: 250,
    };
    expect(getRetryDelayMs(0, policy)).toBe(100);
    expect(getRetryDelayMs(1, policy)).toBe(200);
    expect(getRetryDelayMs(2, policy)).toBe(250);
  });
});
