import { describe, it, expect, vi } from 'vitest';
import { checkIdempotency, storeIdempotency } from '../src/engine/Idempotency.js';

describe('checkIdempotency', () => {
  it('returns null when record not found', async () => {
    const repo = { get: vi.fn().mockResolvedValue(null) };
    const result = await checkIdempotency(repo as never, 'key-1');
    expect(result).toBeNull();
    expect(repo.get).toHaveBeenCalledWith('key-1');
  });

  it('returns output and patch when record exists', async () => {
    const repo = {
      get: vi.fn().mockResolvedValue({
        outputJson: { x: 1 },
        patchJson: { y: 2 },
      }),
    };
    const result = await checkIdempotency(repo as never, 'key-2');
    expect(result).toEqual({ output: { x: 1 }, patch: { y: 2 } });
  });
});

describe('storeIdempotency', () => {
  it('calls repo.set with correct args', async () => {
    const repo = { set: vi.fn().mockResolvedValue(undefined) };
    await storeIdempotency(repo as never, 'key', 'run-1', 'node-a', { out: 1 }, { p: 2 });
    expect(repo.set).toHaveBeenCalledWith('key', 'run-1', 'node-a', { out: 1 }, { p: 2 });
  });
});
