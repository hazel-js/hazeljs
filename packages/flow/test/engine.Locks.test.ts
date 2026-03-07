import { describe, it, expect, vi } from 'vitest';
import { runIdToLockKey, withAdvisoryLock } from '../src/engine/Locks.js';

describe('withAdvisoryLock', () => {
  it('throws LockBusyError when lock not acquired', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ acquired: false }]),
      $executeRaw: vi.fn().mockResolvedValue(undefined),
    };
    await expect(withAdvisoryLock(prisma as never, 'run-1', async () => 42)).rejects.toThrow(
      /Lock busy for run run-1/
    );
  });

  it('executes fn and unlocks when lock acquired', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ acquired: true }]),
      $executeRaw: vi.fn().mockResolvedValue(undefined),
    };
    const result = await withAdvisoryLock(prisma as never, 'run-1', async () => 99);
    expect(result).toBe(99);
    expect(prisma.$executeRaw).toHaveBeenCalled();
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
