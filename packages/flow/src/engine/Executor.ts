/**
 * Executes a single node within a flow run
 */
import type { FlowContext, NodeDefinition, NodeResult } from '../types/FlowTypes.js';
import type { FlowEventRepo } from '../persistence/FlowEventRepo.js';
import type { IdempotencyRepo } from '../persistence/IdempotencyRepo.js';
import { checkIdempotency, storeIdempotency } from './Idempotency.js';
import { withTimeout } from './Timeout.js';
import { getRetryDelayMs, delay } from './Retry.js';
import { deepMerge } from './utils.js';

const RETRYABLE_ERROR_CODES = new Set(['TIMEOUT', 'NETWORK_ERROR', 'RATE_LIMIT']);

export async function executeNode(
  node: NodeDefinition,
  ctx: FlowContext,
  eventRepo: FlowEventRepo,
  idempotencyRepo: IdempotencyRepo
): Promise<{ result: NodeResult; cached: boolean }> {
  const attempt = (ctx.meta.attempts[node.id] ?? 0) + 1;
  ctx.meta.attempts[node.id] = attempt;

  await eventRepo.append(ctx.runId, 'NODE_STARTED', { nodeId: node.id, attempt });

  // Idempotency check
  if (node.idempotencyKey) {
    const key = node.idempotencyKey(ctx);
    const cached = await checkIdempotency(idempotencyRepo, key);
    if (cached) {
      await eventRepo.append(ctx.runId, 'NODE_FINISHED', {
        nodeId: node.id,
        attempt,
        cached: true,
      });
      return {
        result: {
          status: 'ok',
          output: cached.output,
          patch: cached.patch,
        },
        cached: true,
      };
    }
  }

  let lastError: { code: string; message: string; retryable?: boolean } | null = null;
  const maxAttempts = node.retry?.maxAttempts ?? 1;

  for (let a = 0; a < maxAttempts; a++) {
    try {
      let handlerPromise = node.handler(ctx);
      if (node.timeoutMs) {
        handlerPromise = withTimeout(handlerPromise, node.timeoutMs, node.id);
      }
      const result = await handlerPromise;

      if (result.status === 'ok') {
        if (node.idempotencyKey) {
          const key = node.idempotencyKey(ctx);
          await storeIdempotency(
            idempotencyRepo,
            key,
            ctx.runId,
            node.id,
            result.output,
            result.patch
          );
        }
        await eventRepo.append(ctx.runId, 'NODE_FINISHED', {
          nodeId: node.id,
          attempt: a + 1,
          cached: false,
        });
        return { result, cached: false };
      }

      if (result.status === 'wait') {
        await eventRepo.append(ctx.runId, 'NODE_FINISHED', {
          nodeId: node.id,
          attempt: a + 1,
          cached: false,
        });
        return { result, cached: false };
      }

      // result.status === 'error'
      lastError = result.error;
      await eventRepo.append(ctx.runId, 'NODE_FAILED', {
        nodeId: node.id,
        attempt: a + 1,
        error: result.error,
      });

      const retryable =
        result.error.retryable ?? RETRYABLE_ERROR_CODES.has(result.error.code);
      if (!retryable || a === maxAttempts - 1) {
        return { result, cached: false };
      }

      const delayMs = node.retry
        ? getRetryDelayMs(a, node.retry)
        : -1;
      if (delayMs > 0) {
        await delay(delayMs);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code =
        err instanceof Error && 'code' in err
          ? String((err as { code: string }).code)
          : 'UNKNOWN';
      lastError = { code, message, retryable: code === 'TIMEOUT' };
      await eventRepo.append(ctx.runId, 'NODE_FAILED', {
        nodeId: node.id,
        attempt: a + 1,
        error: lastError,
      });

      if (code === 'TIMEOUT' && node.retry && a < maxAttempts - 1) {
        const delayMs = getRetryDelayMs(a, node.retry);
        if (delayMs > 0) await delay(delayMs);
      } else {
        return {
          result: { status: 'error', error: lastError },
          cached: false,
        };
      }
    }
  }

  return {
    result: {
      status: 'error',
      error: lastError ?? { code: 'UNKNOWN', message: 'Max retries exceeded' },
    },
    cached: false,
  };
}

export function applyPatch(
  state: Record<string, unknown>,
  patch?: Record<string, unknown>
): Record<string, unknown> {
  if (!patch || Object.keys(patch).length === 0) return state;
  return deepMerge(state, patch);
}
