/**
 * Agent OS — durable run process types (AOS-001)
 */

export enum AgentRunStatus {
  CREATED = 'created',
  QUEUED = 'queued',
  RUNNING = 'running',
  WAITING_FOR_HUMAN = 'waiting_for_human',
  WAITING_FOR_TOOL = 'waiting_for_tool',
  WAITING_FOR_AGENT = 'waiting_for_agent',
  WAITING_FOR_MODEL = 'waiting_for_model',
  SUSPENDED = 'suspended',
  RETRYING = 'retrying',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMED_OUT = 'timed_out',
}

export interface AgentRunError {
  message: string;
  code?: string;
  stack?: string;
}

export interface AgentRun {
  id: string;
  agentName: string;
  agentVersion?: string;
  status: AgentRunStatus;
  input?: unknown;
  output?: unknown;
  error?: AgentRunError;
  tenantId?: string;
  userId?: string;
  parentRunId?: string;
  rootRunId: string;
  attempt: number;
  checkpointId?: string;
  /** Worker that currently owns execution (Gamma leases). */
  leaseOwner?: string;
  /** When the lease expires; reclaim after this time. */
  leaseExpiresAt?: Date;
  /** Fencing token for heartbeat / release. */
  leaseToken?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export class AgentRunTransitionError extends Error {
  constructor(
    public readonly runId: string,
    public readonly from: AgentRunStatus,
    public readonly to: AgentRunStatus
  ) {
    super(`Illegal AgentRun transition ${from} → ${to} (run ${runId})`);
    this.name = 'AgentRunTransitionError';
  }
}
