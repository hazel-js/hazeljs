/**
 * Idempotency check and store helpers
 */
import type { FlowContext, NodeResult } from '../types/FlowTypes.js';
import type { IdempotencyRepo } from '../persistence/IdempotencyRepo.js';

export async function checkIdempotency(
  repo: IdempotencyRepo,
  key: string
): Promise<{ output?: unknown; patch?: Record<string, unknown> } | null> {
  const record = await repo.get(key);
  if (!record) return null;
  return {
    output: record.outputJson,
    patch: record.patchJson as Record<string, unknown> | undefined,
  };
}

export async function storeIdempotency(
  repo: IdempotencyRepo,
  key: string,
  runId: string,
  nodeId: string,
  output?: unknown,
  patch?: Record<string, unknown>
): Promise<void> {
  await repo.set(key, runId, nodeId, output, patch);
}
