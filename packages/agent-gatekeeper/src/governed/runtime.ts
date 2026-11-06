/**
 * GovernedRuntime — opt-in external harness boundary.
 * Tools go through Gatekeeper; identity from TrustedCallerContext only.
 */

import { randomUUID } from 'crypto';
import type { AgentGatekeeper } from '../gatekeeper';
import type { ApprovalProvider } from '../approval/provider';
import { buildApprovalRequest } from '../approval/provider';
import { invocationFingerprint } from '../security';
import type { AuditSink } from '../audit/sink';
import type { ProtectedTool, ToolInvocationContext } from '../types';
import { argumentDigest } from './digest';
import { withGovernedApproval } from './approval';
import type { DistributedLock } from './lock';
import type { ToolAttemptLedger } from './ledger';
import { acknowledgeCancel, markUnknown, requestCancel, type GovernedRunStore } from './run-store';
import type { RuntimeAdapter } from './adapters';
import {
  assertGovernedManifest,
  StaleApprovalError,
  type GovernedToolRequest,
  type TrustedCallerContext,
} from './types';

export interface GovernedToolExecutorOptions {
  gatekeeper: AgentGatekeeper;
  approvals: ApprovalProvider;
  lock: DistributedLock;
  ledger: ToolAttemptLedger;
  audit?: AuditSink;
  /** Tools keyed by name. */
  tools: Map<string, ProtectedTool>;
  /** Upstream executor — e.g. fake commerce API. */
  dispatch: (toolName: string, input: unknown) => Promise<unknown>;
  /** Optional timeout after which status becomes unknown (ms). */
  dispatchTimeoutMs?: number;
}

export interface GovernedToolResult {
  outcome: 'succeeded' | 'denied' | 'require_approval' | 'unknown' | 'failed' | 'duplicate';
  approvalId?: string;
  result?: unknown;
  reason?: string;
  attemptStatus?: string;
}

export function createGovernedToolExecutor(options: GovernedToolExecutorOptions) {
  const governed = withGovernedApproval(options.approvals, options.lock);

  async function execute(
    caller: TrustedCallerContext,
    request: GovernedToolRequest
  ): Promise<GovernedToolResult> {
    const tool = options.tools.get(request.toolName);
    if (!tool) {
      return { outcome: 'denied', reason: `Unknown tool ${request.toolName}` };
    }

    // Strip forged identity from model args — only server context is trusted.
    const safeInput = request.input;
    const digest = argumentDigest(safeInput);
    const invocationId = `inv_${randomUUID()}`;

    const context: ToolInvocationContext = {
      invocationId,
      runId: caller.runId,
      agentId: 'governed-runtime',
      tenantId: caller.tenantId,
      delegatedUserId: caller.actorId,
      toolName: request.toolName,
      input: safeInput,
      environment: caller.environment ?? 'production',
      timestamp: new Date(),
      capabilities: caller.capabilities,
      roles: caller.roles,
      trustLevel: caller.trustLevel,
      approvalToken: request.approvalToken,
      idempotencyKey: request.idempotencyKey,
      trace: { traceId: caller.traceId },
      metadata: { policyVersion: caller.policyVersion, argumentDigest: digest },
    };

    let effectiveInput = safeInput;
    let decision = await options.gatekeeper.evaluate(context, request.classification);

    if (decision.outcome === 'rewrite') {
      effectiveInput = decision.safeInput;
      decision = await options.gatekeeper.evaluate(
        { ...context, input: decision.safeInput },
        request.classification
      );
    }

    if (decision.outcome === 'deny') {
      return { outcome: 'denied', reason: decision.reason };
    }

    if (decision.outcome === 'require_approval') {
      if (!request.approvalToken) {
        const approval = buildApprovalRequest(
          {
            invocationId,
            runId: caller.runId,
            agentId: 'governed-runtime',
            tenantId: caller.tenantId,
            delegatedUserId: caller.actorId,
            toolName: request.toolName,
            input:
              effectiveInput && typeof effectiveInput === 'object'
                ? (effectiveInput as Record<string, unknown>)
                : { value: effectiveInput },
            reason: decision.reason,
            policyIds: decision.policyIds,
            policyVersions: [caller.policyVersion],
            riskClassification:
              request.classification === 'destructive'
                ? 'critical'
                : request.classification === 'write'
                  ? 'high'
                  : 'medium',
            idempotencyKey: request.idempotencyKey,
          },
          { now: (): Date => new Date() },
          (): string => `apr_${randomUUID()}`,
          300_000
        );
        const stored = await governed.createGoverned(approval, {
          argumentDigest: argumentDigest(effectiveInput),
          actorId: caller.actorId,
        });
        return {
          outcome: 'require_approval',
          approvalId: stored.approvalId,
          reason: decision.reason,
        };
      }

      const fingerprint = invocationFingerprint({
        agentId: context.agentId,
        toolName: request.toolName,
        input: effectiveInput,
        tenantId: caller.tenantId,
      });
      const execDigest = argumentDigest(effectiveInput);

      try {
        const consumed = await governed.consumeGoverned({
          approvalId: request.approvalToken,
          fingerprint,
          argumentDigest: execDigest,
          actorId: caller.actorId,
          policyVersion: caller.policyVersion,
        });
        if (!consumed.valid) {
          return { outcome: 'denied', reason: consumed.reason ?? 'Approval invalid' };
        }
      } catch (e) {
        if (e instanceof StaleApprovalError) {
          return { outcome: 'denied', reason: e.message };
        }
        throw e;
      }

      // Re-evaluate immediately before execution. Approval was just consumed;
      // require_approval again is expected for HITL policies — do not deny.
      const reEval = await options.gatekeeper.evaluate(
        { ...context, input: effectiveInput },
        request.classification
      );
      if (reEval.outcome === 'deny') {
        return { outcome: 'denied', reason: reEval.reason };
      }
    }

    const execDigest = argumentDigest(effectiveInput);
    const claim = await options.ledger.beginDispatch({
      idempotencyKey: request.idempotencyKey,
      tenantId: caller.tenantId,
      runId: caller.runId,
      toolName: request.toolName,
      argumentDigest: execDigest,
    });

    if (!claim.created) {
      if (claim.record.status === 'succeeded') {
        return {
          outcome: 'duplicate',
          result: claim.record.outcome,
          attemptStatus: claim.record.status,
        };
      }
      if (claim.record.status === 'dispatched' || claim.record.status === 'unknown') {
        return {
          outcome: 'unknown',
          reason: 'Prior attempt in-flight or unknown — reconcile before retry',
          attemptStatus: claim.record.status,
        };
      }
      return {
        outcome: 'failed',
        reason: claim.record.error ?? 'Prior attempt failed',
        attemptStatus: claim.record.status,
      };
    }

    const timeoutMs = options.dispatchTimeoutMs ?? 30_000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        options.dispatch(request.toolName, effectiveInput),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            const err = new Error('Dispatch timeout');
            err.name = 'DispatchTimeout';
            reject(err);
          }, timeoutMs);
        }),
      ]);
      if (timer) clearTimeout(timer);
      await options.ledger.update(request.idempotencyKey, {
        status: 'succeeded',
        outcome: result,
      });
      return { outcome: 'succeeded', result, attemptStatus: 'succeeded' };
    } catch (e) {
      if (timer) clearTimeout(timer);
      if (e instanceof Error && e.name === 'DispatchTimeout') {
        await options.ledger.update(request.idempotencyKey, {
          status: 'unknown',
          error: e.message,
        });
        return {
          outcome: 'unknown',
          reason: 'Timeout after dispatch — reconcile upstream before retry',
          attemptStatus: 'unknown',
        };
      }
      await options.ledger.update(request.idempotencyKey, {
        status: 'failed',
        error: e instanceof Error ? e.message : String(e),
      });
      return {
        outcome: 'failed',
        reason: e instanceof Error ? e.message : String(e),
        attemptStatus: 'failed',
      };
    }
  }

  return { execute, governedApprovals: governed };
}

export interface GovernedRuntimeOptions {
  adapter: RuntimeAdapter;
  runStore: GovernedRunStore;
  toolExecutor: ReturnType<typeof createGovernedToolExecutor>;
  audit?: AuditSink;
}

export function createGovernedRuntime(options: GovernedRuntimeOptions) {
  assertGovernedManifest(options.adapter.manifest);

  return {
    adapter: options.adapter,

    async start(caller: TrustedCallerContext, input: unknown) {
      const started = await options.adapter.start({ caller, input });
      const record = await options.runStore.create({
        runId: caller.runId,
        tenantId: caller.tenantId,
        actorId: caller.actorId,
        adapter: options.adapter.name,
        status: 'running',
        cancelState: 'none',
        providerSessionId: started.providerSessionId,
        policyVersion: caller.policyVersion,
        capabilities: caller.capabilities,
      });
      return record;
    },

    async status(runId: string) {
      const record = await options.runStore.get(runId);
      if (!record) return undefined;
      if (record.providerSessionId) {
        const remote = await options.adapter.status(record.providerSessionId);
        if (!remote.alive && record.status === 'running') {
          return options.runStore.update(runId, markUnknown('Provider session not alive'));
        }
      }
      return record;
    },

    async requestCancel(runId: string) {
      const record = await options.runStore.get(runId);
      if (!record) return undefined;
      const patch = requestCancel(record);
      const updated = await options.runStore.update(runId, patch);
      if (record.providerSessionId) {
        const ack = await options.adapter.cancel(record.providerSessionId);
        if (ack.acknowledged) {
          return options.runStore.update(runId, acknowledgeCancel());
        }
      }
      return updated;
    },

    async executeTool(caller: TrustedCallerContext, request: GovernedToolRequest) {
      return options.toolExecutor.execute(caller, request);
    },
  };
}

export type GovernedRuntime = ReturnType<typeof createGovernedRuntime>;
