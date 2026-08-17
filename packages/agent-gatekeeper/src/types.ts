/**
 * Core types for Agent Gatekeeper
 */

import type { z } from 'zod';

export type GatekeeperMode = 'enforce' | 'audit' | 'disabled';

export type DefaultDecision = 'allow' | 'deny';

export type ToolClassification = 'read' | 'write' | 'destructive';

export type ToolRiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** Normalized, immutable invocation envelope. Identity comes from trusted runtime context only. */
export interface ToolInvocationContext<TInput = unknown> {
  readonly invocationId: string;
  readonly runId: string;
  readonly agentId: string;
  readonly agentVersion?: string;
  readonly tenantId?: string;
  readonly delegatedUserId?: string;
  readonly sessionId?: string;
  readonly toolName: string;
  readonly input: TInput;
  readonly purpose?: string;
  readonly environment: string;
  readonly timestamp: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly trace?: {
    traceId?: string;
    spanId?: string;
    parentInvocationId?: string;
  };
  /** Trusted agent capabilities from runtime identity (not from tool input). */
  readonly capabilities?: readonly string[];
  /** Trusted roles / trust level from runtime identity. */
  readonly roles?: readonly string[];
  readonly trustLevel?: string;
  /** Resume token when continuing after approval. */
  readonly approvalToken?: string;
  /** Idempotency key for sensitive / resumable tool calls. */
  readonly idempotencyKey?: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'consumed';

export interface ApprovalRequest {
  approvalId: string;
  invocationId: string;
  runId: string;
  agentId: string;
  agentVersion?: string;
  tenantId?: string;
  delegatedUserId?: string;
  toolName: string;
  /** Sanitized argument summary — no secrets. */
  argumentSummary: Record<string, unknown>;
  reason: string;
  policyIds: string[];
  policyVersions: string[];
  createdAt: Date;
  expiresAt: Date;
  riskClassification: ToolRiskLevel;
  idempotencyKey: string;
  invocationFingerprint: string;
  status: ApprovalStatus;
}

export type GatekeeperDecision<TInput = unknown> =
  | { outcome: 'allow'; policyIds: string[]; reason?: string }
  | { outcome: 'deny'; policyIds: string[]; reason: string; code: string }
  | {
      outcome: 'require_approval';
      policyIds: string[];
      reason: string;
      approvalRequest: ApprovalRequest;
    }
  | {
      outcome: 'rewrite';
      policyIds: string[];
      reason: string;
      safeInput: TInput;
    };

export interface PolicyEvaluationContext<TInput = unknown> {
  context: ToolInvocationContext<TInput>;
  input: TInput;
  classification?: ToolClassification;
  riskLevel?: ToolRiskLevel;
}

export interface TimeWindow {
  /** ISO day-of-week 0-6 (Sunday=0) or '*' for any. */
  days?: number[] | '*';
  /** HH:mm in UTC */
  start?: string;
  /** HH:mm in UTC */
  end?: string;
}

export interface AgentGatekeeperPolicy<TInput = unknown> {
  id: string;
  version: string;
  priority?: number;
  metadata?: Record<string, unknown>;
  match?: {
    agents?: string[];
    agentVersions?: string[];
    roles?: string[];
    trustLevels?: string[];
    tenants?: string[];
    delegatedUsers?: string[];
    tools?: string[];
    environments?: string[];
    classifications?: ToolClassification[];
    timeWindows?: TimeWindow[];
  };
  rules?: {
    allowWhen?: (ctx: PolicyEvaluationContext<TInput>) => boolean | Promise<boolean>;
    denyWhen?: (ctx: PolicyEvaluationContext<TInput>) => boolean | Promise<boolean>;
    requireApprovalWhen?: (ctx: PolicyEvaluationContext<TInput>) => boolean | Promise<boolean>;
    rewrite?: (ctx: PolicyEvaluationContext<TInput>) => TInput | Promise<TInput>;
    /** Max transaction amount when input has numeric `amount`. */
    maxTransactionAmount?: number;
    /** Field must equal trusted tenantId when present in input. */
    enforceTenantField?: string;
    /** Strip these fields from input on rewrite. */
    stripFields?: string[];
    /** Redact these fields in audit output. */
    redactFields?: string[];
    /** Rate limit: max invocations per windowMs for this policy scope. */
    rateLimit?: { max: number; windowMs: number };
    /** Cost budget per windowMs. */
    costBudget?: { maxUnits: number; windowMs: number };
    /** Invocation count budget per runId. */
    invocationBudget?: { max: number };
  };
}

export interface ProtectedTool<TInput = unknown, TOutput = unknown> {
  name: string;
  version?: string;
  description?: string;
  inputSchema?: z.ZodType<TInput>;
  outputSchema?: z.ZodType<TOutput>;
  classification: ToolClassification;
  riskLevel?: ToolRiskLevel;
  readOnly?: boolean;
  redactFields?: string[];
  estimatedCostUnits?: number;
  execute: (input: TInput, context: ToolInvocationContext<TInput>) => Promise<TOutput>;
}

export interface GatekeeperExecuteInput<TInput = unknown, TOutput = unknown> {
  context: ToolInvocationContext<TInput>;
  tool: ProtectedTool<TInput, TOutput>;
}

export interface GatekeeperExecuteResult<TOutput = unknown> {
  decision: GatekeeperDecision;
  output?: TOutput;
  durationMs: number;
  /** Sanitized audit snapshot of original input when rewrite occurred. */
  originalInputSnapshot?: Record<string, unknown>;
}

export interface GatekeeperSimulation {
  decision: GatekeeperDecision;
  matchedPolicies: Array<{ id: string; version: string; priority: number }>;
  explanation: string[];
  sanitizedContext: Record<string, unknown>;
  sanitizedInput: Record<string, unknown>;
}

export interface IdGenerator {
  (): string;
}

export interface Clock {
  now(): Date;
}

export interface AuditCriticalityOptions {
  /** When true, audit sink failure fails closed in enforce mode. Default true in enforce. */
  critical?: boolean;
}

export interface AgentGatekeeperOptions {
  mode?: GatekeeperMode;
  defaultDecision?: DefaultDecision;
  policies?: AgentGatekeeperPolicy[];
  approvalProvider?: import('./approval/provider').ApprovalProvider;
  auditSink?: import('./audit/sink').AuditSink;
  audit?: AuditCriticalityOptions;
  clock?: Clock;
  idGenerator?: IdGenerator;
  /** Max ms for async policy predicate evaluation. Default 5000. */
  policyTimeoutMs?: number;
  /** Max rewrite passes before deny. Default 1. */
  maxRewritePasses?: number;
}

export interface ToolExecutorGateInput {
  tool: {
    name: string;
    schema?: z.ZodTypeAny;
    capability?: string;
    requiresApproval?: boolean;
    riskLevel?: ToolRiskLevel;
    readOnly?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    method: Function;
    target: object;
  };
  input: Record<string, unknown>;
  agentId: string;
  sessionId: string;
  userId?: string;
  runId?: string;
  environment?: string;
  tenantId?: string;
  agentVersion?: string;
  capabilities?: string[];
}

export interface ToolExecutorGateResult {
  success: boolean;
  output?: unknown;
  error?: Error;
  duration: number;
  pendingApproval?: boolean;
  requestId?: string;
  metadata?: Record<string, unknown>;
}
