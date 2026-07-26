import { describe, it, expect, vi } from 'vitest';
import { runIdToLockKey, withAdvisoryLock } from '../src/engine/Locks.js';

describe('withAdvisoryLock', () => {
  it('runs fn inside a transaction after acquiring xact lock', async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const result = await withAdvisoryLock(prisma as never, 'run-1', async () => 99);
    expect(result).toBe(99);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(tx.$executeRaw).toHaveBeenCalledOnce();
  });

  it('maps transaction start failures to LockBusyError', async () => {
    const prisma = {
      $transaction: vi.fn().mockRejectedValue(new Error('Unable to start a transaction')),
    };
    await expect(withAdvisoryLock(prisma as never, 'run-1', async () => 42)).rejects.toThrow(
      /Lock busy for run run-1/
    );
  });
});

describe('runIdToLockKey', () => {
  it('returns stable hash for same runId', () => {
    const key1 = runIdToLockKey('run-123');
    const key2 = runIdToLockKey('run-123');
    expect(key1).toBe(key2);
  });

  it('returns different keys for different runIds', () => {
    const key1 = runIdToLockKey('run-1');
    const key2 = runIdToLockKey('run-2');
    expect(key1).not.toBe(key2);
  });

  it('returns positive BigInt within safe range', () => {
    const key = runIdToLockKey('any-run-id');
    expect(key >= 0n).toBe(true);
    expect(key <= BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
  });

  it('handles empty string', () => {
    const key = runIdToLockKey('');
    expect(typeof key).toBe('bigint');
  });
});
