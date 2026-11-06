/**
 * External runtime governance boundary types.
 * Opt-in — does not change AgentGatekeeper.evaluate / execute.
 */

export interface RuntimeCapabilityManifest {
  start: boolean;
  status: boolean;
  cancel: boolean;
  events: boolean;
  resume: boolean;
  toolMediation: boolean;
  approvalContinuation: boolean;
  hostedComputerUse: boolean;
  hostedShell: boolean;
}

export type GovernedRunStatus =
  | 'starting'
  | 'running'
  | 'waiting_approval'
  | 'cancel_requested'
  | 'cancelled'
  | 'succeeded'
  | 'failed'
  | 'unknown';

export type CancelState = 'none' | 'requested' | 'acknowledged';

export interface TrustedCallerContext {
  readonly tenantId: string;
  readonly actorId: string;
  readonly runId: string;
  readonly capabilities: readonly string[];
  readonly policyVersion: string;
  readonly roles?: readonly string[];
  readonly trustLevel?: string;
  readonly environment?: string;
  readonly traceId?: string;
  /** Delegation depth for the current caller (0 = root). */
  readonly delegationDepth?: number;
}

export interface GovernedToolRequest {
  toolName: string;
  /** Model-supplied args — never trusted for identity. */
  input: unknown;
  idempotencyKey: string;
  /** Optional advisory classification from Decision Plane. */
  classification?: 'read' | 'write' | 'destructive';
  approvalToken?: string;
}

export type ToolAttemptStatus = 'dispatched' | 'succeeded' | 'unknown' | 'failed';

export interface ToolAttemptRecord {
  idempotencyKey: string;
  tenantId: string;
  runId: string;
  toolName: string;
  argumentDigest: string;
  status: ToolAttemptStatus;
  createdAt: Date;
  updatedAt: Date;
  outcome?: unknown;
  error?: string;
}

export interface DelegationGrant {
  grantId: string;
  parentRunId: string;
  tenantId: string;
  actorId: string;
  capabilities: readonly string[];
  budgetUsd: number;
  spentUsd: number;
  maxConcurrency: number;
  depth: number;
  expiresAt: Date;
  createdAt: Date;
}

export interface GovernedRunRecord {
  runId: string;
  tenantId: string;
  actorId: string;
  adapter: string;
  status: GovernedRunStatus;
  cancelState: CancelState;
  providerSessionId?: string;
  policyVersion: string;
  capabilities: readonly string[];
  createdAt: Date;
  updatedAt: Date;
  lastError?: string;
}

export class ExternalRuntimeUnavailableError extends Error {
  readonly code = 'EXTERNAL_RUNTIME_UNAVAILABLE';
  constructor(
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ExternalRuntimeUnavailableError';
  }
}

export class GovernedCapabilityError extends Error {
  readonly code = 'GOVERNED_CAPABILITY_REJECTED';
  constructor(
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'GovernedCapabilityError';
  }
}

export class StaleApprovalError extends Error {
  readonly code = 'STALE_APPROVAL';
  constructor(
    message: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'StaleApprovalError';
  }
}

export function assertGovernedManifest(manifest: RuntimeCapabilityManifest): void {
  if (!manifest.toolMediation) {
    throw new GovernedCapabilityError(
      'Governed mode requires toolMediation. Adapter rejected before start.',
      { manifest }
    );
  }
  if (manifest.hostedComputerUse) {
    throw new GovernedCapabilityError(
      'Governed mode rejects hostedComputerUse. Adapter rejected before start.',
      { manifest }
    );
  }
  if (manifest.hostedShell) {
    throw new GovernedCapabilityError(
      'Governed mode rejects hostedShell. Adapter rejected before start.',
      { manifest }
    );
  }
}
