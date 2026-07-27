/**
 * Postgres advisory locks for flow run concurrency safety.
 * Uses a stable hash of runId -> bigint for pg_advisory_xact_lock.
 *
 * Hash algorithm: djb2-like string hash, then take mod to fit in int8 range.
 * PostgreSQL advisory lock keys are int8 (signed 64-bit).
 *
 * Locks are transaction-scoped and acquired inside an interactive transaction so
 * the same backend session holds the lock for the full tick. Session-level
 * pg_try_advisory_lock/unlock across pooled connections is unsafe with Prisma.
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

function lockTransactionTimeoutMs(): number {
  const raw = Number(process.env.FLOW_LOCK_TRANSACTION_TIMEOUT_MS || '120000');
  return Number.isFinite(raw) && raw >= 5_000 ? raw : 120_000;
}

export async function withAdvisoryLock<T>(
  prisma: PrismaClient,
  runId: string,
  fn: () => Promise<T>
): Promise<T> {
  const key = runIdToLockKey(runId);
  const timeout = lockTransactionTimeoutMs();

  try {
    return await prisma.$transaction(
      async (tx) => {
        // Blocks until acquired; released automatically at transaction end.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key})`;
        return await fn();
      },
      {
        maxWait: 10_000,
        timeout,
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/Unable to start a transaction|timed out fetching a new connection|P2028/i.test(message)) {
      const { LockBusyError } = await import('../types/Errors.js');
      throw new LockBusyError(runId);
    }
    throw err;
  }
}
