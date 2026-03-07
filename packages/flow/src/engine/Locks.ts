/**
 * Postgres advisory locks for flow run concurrency safety.
 * Uses a stable hash of runId -> bigint for pg_advisory_lock.
 *
 * Hash algorithm: djb2-like string hash, then take mod to fit in int8 range.
 * PostgreSQL advisory lock keys are int8 (signed 64-bit).
 */

import type { PrismaClient } from '../persistence/prisma.js';

export function runIdToLockKey(runId: string): bigint {
  let hash = 5381;
  for (let i = 0; i < runId.length; i++) {
    hash = ((hash << 5) + hash) ^ runId.charCodeAt(i);
  }
  // Ensure positive and within safe int8 range (use MAX_SAFE_INTEGER to avoid precision loss)
  const h = Math.abs(hash);
  return BigInt(h % Number.MAX_SAFE_INTEGER);
}

export async function withAdvisoryLock<T>(
  prisma: PrismaClient,
  runId: string,
  fn: () => Promise<T>
): Promise<T> {
  const key = runIdToLockKey(runId);
  try {
    const result = await prisma.$queryRaw`SELECT pg_try_advisory_lock(${key}) as acquired`;
    const acquired = (result as Array<{ acquired: boolean }>)[0]?.acquired;
    if (!acquired) {
      const { LockBusyError } = await import('../types/Errors.js');
      throw new LockBusyError(runId);
    }
    return await fn();
  } finally {
    await prisma.$executeRaw`SELECT pg_advisory_unlock(${key})`;
  }
}
