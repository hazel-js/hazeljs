/**
 * Factory: AgentGatekeeper + approval provider + ToolExecutor authorization gate.
 */

import { AgentGatekeeper } from '../gatekeeper';
import {
  createHumanTaskProvider,
  InMemoryApprovalProvider,
  type ApprovalProvider,
} from '../approval/provider';
import type { AuditSink } from '../audit/sink';
import type {
  AgentGatekeeperPolicy,
  DefaultDecision,
  GatekeeperMode,
  ToolExecutorGateInput,
  ToolExecutorGateResult,
} from '../types';
import { createToolExecutorGate, type CreateToolExecutorGateOptions } from '../adapters';
import { resolveAuditSink, type ResolveAuditSinkOptions } from './resolve-audit-sink';
import { tryCreateRedisApprovalProvider } from './redis-from-env';
import type { HumanTaskLookup } from './human-task-resume';

export type GatekeeperApprovalBackend = 'human-task' | 'redis' | 'memory' | 'custom';

export interface HumanTaskServiceLike extends HumanTaskLookup {
  create(input: {
    id?: string;
    runId: string;
    type: 'tool_approval' | 'user_input' | 'review';
    toolName?: string;
    payload?: unknown;
    metadata?: unknown;
  }): Promise<{ id: string }>;
  get(id: string): Promise<{ status?: string; payload?: unknown; metadata?: unknown } | undefined>;
  resolve(
    id: string,
    decision: 'approved' | 'rejected' | 'expired',
    resolvedBy?: string
  ): Promise<unknown>;
}

export interface CreateAgentGatekeeperBundleOptions {
  policies: AgentGatekeeperPolicy[];
  /** When false, gatekeeper mode is forced to disabled. Default true. */
  enabled?: boolean;
  mode?: GatekeeperMode;
  defaultDecision?: DefaultDecision;
  /** Durable HITL — preferred approval backend when Redis is unset. */
  humanTasks?: HumanTaskServiceLike;
  /** Explicit approval provider (skips Redis / HumanTask / memory resolution). */
  approvalProvider?: ApprovalProvider;
  /** Redis URL override (default GATEKEEPER_REDIS_URL || REDIS_URL). */
  redisUrl?: string;
  auditSink?: AuditSink;
  audit?: ResolveAuditSinkOptions;
  /** Defaults for ToolExecutor context when input omits them. */
  tenantId?: string;
  environment?: string;
  /** Extra ToolExecutor gate options (merged with humanTasks / tenant defaults). */
  gate?: Omit<
    CreateToolExecutorGateOptions,
    'humanTasks' | 'defaultTenantId' | 'defaultEnvironment'
  >;
}

export interface AgentGatekeeperBundle {
  enabled: boolean;
  gatekeeper: AgentGatekeeper;
  approvalProvider: ApprovalProvider;
  authorizationGate: {
    execute(input: ToolExecutorGateInput): Promise<ToolExecutorGateResult>;
  };
  policies: AgentGatekeeperPolicy[];
  approvalBackend: GatekeeperApprovalBackend;
  auditBackend: string;
}

const bound = new WeakMap<object, AgentGatekeeperBundle>();

export function bindGatekeeper(runtime: object, bundle: AgentGatekeeperBundle): void {
  bound.set(runtime, bundle);
}

export function getBoundGatekeeper(runtime: object): AgentGatekeeperBundle | undefined {
  return bound.get(runtime);
}

/** @deprecated Prefer getBoundGatekeeper */
export function gatekeeperFor(runtime: object): AgentGatekeeperBundle | undefined {
  return getBoundGatekeeper(runtime);
}

/**
 * Build a production-shaped Gatekeeper stack: policies, approvals, audit, ToolExecutor gate.
 */
export function createAgentGatekeeperBundle(
  options: CreateAgentGatekeeperBundleOptions
): AgentGatekeeperBundle {
  const enabled = options.enabled !== false;
  const policies = options.policies;

  let approvalProvider: ApprovalProvider;
  let approvalBackend: GatekeeperApprovalBackend;

  if (options.approvalProvider) {
    approvalProvider = options.approvalProvider;
    approvalBackend = 'custom';
  } else {
    const redis = tryCreateRedisApprovalProvider({
      url: options.redisUrl,
      onMissingRedisPackage: (): void => {
        // Prefer stderr over console for lint; ops-visible when redis peer missing
        process.stderr.write(
          'GATEKEEPER_REDIS_URL is set but the `redis` package is not installed — using durable HITL approvals\n'
        );
      },
    });
    if (redis) {
      approvalProvider = redis;
      approvalBackend = 'redis';
    } else if (options.humanTasks) {
      approvalProvider = createHumanTaskProvider(options.humanTasks);
      approvalBackend = 'human-task';
    } else {
      approvalProvider = new InMemoryApprovalProvider();
      approvalBackend = 'memory';
    }
  }

  const { sink, backend: auditBackend } = options.auditSink
    ? { sink: options.auditSink, backend: 'custom' }
    : resolveAuditSink(options.audit);

  const gatekeeper = new AgentGatekeeper({
    mode: enabled ? (options.mode ?? 'enforce') : 'disabled',
    defaultDecision: options.defaultDecision ?? 'deny',
    policies,
    approvalProvider,
    auditSink: sink,
  });

  const authorizationGate = createToolExecutorGate(gatekeeper, {
    ...options.gate,
    humanTasks: options.humanTasks,
    defaultTenantId: options.tenantId,
    defaultEnvironment: options.environment,
  });

  return {
    enabled,
    gatekeeper,
    approvalProvider,
    authorizationGate: authorizationGate as AgentGatekeeperBundle['authorizationGate'],
    policies,
    approvalBackend,
    auditBackend,
  };
}

export function formatGatekeeperBootLine(
  bundle: AgentGatekeeperBundle,
  extras?: { tenantId?: string; environment?: string }
): string {
  if (!bundle.enabled) return 'Gatekeeper: off (PolicyEngine)';
  const parts = [
    `Gatekeeper: ${bundle.gatekeeper.mode}`,
    'deny',
    `${bundle.policies.length} policies`,
    `approvals=${bundle.approvalBackend}`,
    `audit=${bundle.auditBackend}`,
  ];
  if (extras?.tenantId) parts.push(`tenant=${extras.tenantId}`);
  if (extras?.environment) parts.push(`env=${extras.environment}`);
  return parts.join(' · ');
}
