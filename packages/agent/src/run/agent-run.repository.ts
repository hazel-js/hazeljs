/**
 * AgentRun repository — process store (AOS-001)
 */

import {
  AgentRun,
  AgentRunError,
  AgentRunStatus,
  AgentRunTransitionError,
} from './agent-run.types';
import { assertAgentRunTransition } from './agent-run.transitions';

export interface CreateAgentRunInput {
  id: string;
  agentName: string;
  agentVersion?: string;
  input?: unknown;
  tenantId?: string;
  userId?: string;
  parentRunId?: string;
  rootRunId?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentRunRepository {
  create(input: CreateAgentRunInput): Promise<AgentRun>;
  get(runId: string): Promise<AgentRun | undefined>;
  updateStatus(
    runId: string,
    status: AgentRunStatus,
    patch?: Partial<
      Pick<
        AgentRun,
        | 'output'
        | 'error'
        | 'checkpointId'
        | 'metadata'
        | 'attempt'
        | 'leaseOwner'
        | 'leaseExpiresAt'
        | 'leaseToken'
      >
    >
  ): Promise<AgentRun>;
  list(filter?: { agentName?: string; status?: AgentRunStatus }): Promise<AgentRun[]>;
}

export class InMemoryAgentRunRepository implements AgentRunRepository {
  private readonly runs = new Map<string, AgentRun>();

  async create(input: CreateAgentRunInput): Promise<AgentRun> {
    if (this.runs.has(input.id)) {
      throw new Error(`AgentRun already exists: ${input.id}`);
    }
    const now = new Date();
    const run: AgentRun = {
      id: input.id,
      agentName: input.agentName,
      agentVersion: input.agentVersion,
      status: AgentRunStatus.CREATED,
      input: input.input,
      tenantId: input.tenantId,
      userId: input.userId,
      parentRunId: input.parentRunId,
      rootRunId: input.rootRunId ?? input.id,
      attempt: 1,
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata,
    };
    this.runs.set(run.id, run);
    return { ...run };
  }

  async get(runId: string): Promise<AgentRun | undefined> {
    const run = this.runs.get(runId);
    return run ? { ...run } : undefined;
  }

  async updateStatus(
    runId: string,
    status: AgentRunStatus,
    patch?: Partial<
      Pick<
        AgentRun,
        | 'output'
        | 'error'
        | 'checkpointId'
        | 'metadata'
        | 'attempt'
        | 'leaseOwner'
        | 'leaseExpiresAt'
        | 'leaseToken'
      >
    >
  ): Promise<AgentRun> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`AgentRun not found: ${runId}`);
    }
    assertAgentRunTransition(runId, run.status, status);
    run.status = status;
    run.updatedAt = new Date();
    if (status === AgentRunStatus.RUNNING && !run.startedAt) {
      run.startedAt = run.updatedAt;
    }
    if (
      status === AgentRunStatus.COMPLETED ||
      status === AgentRunStatus.FAILED ||
      status === AgentRunStatus.CANCELLED ||
      status === AgentRunStatus.TIMED_OUT
    ) {
      run.completedAt = run.updatedAt;
    }
    if (patch?.output !== undefined) run.output = patch.output;
    if (patch?.error !== undefined) run.error = patch.error;
    if (patch?.checkpointId !== undefined) run.checkpointId = patch.checkpointId;
    if (patch?.attempt !== undefined) run.attempt = patch.attempt;
    if (patch?.metadata) run.metadata = { ...run.metadata, ...patch.metadata };
    if (patch && 'leaseOwner' in patch) run.leaseOwner = patch.leaseOwner;
    if (patch && 'leaseExpiresAt' in patch) run.leaseExpiresAt = patch.leaseExpiresAt;
    if (patch && 'leaseToken' in patch) run.leaseToken = patch.leaseToken;
    return { ...run };
  }

  async list(filter?: { agentName?: string; status?: AgentRunStatus }): Promise<AgentRun[]> {
    let rows = Array.from(this.runs.values());
    if (filter?.agentName) rows = rows.filter((r) => r.agentName === filter.agentName);
    if (filter?.status) rows = rows.filter((r) => r.status === filter.status);
    return rows.map((r) => ({ ...r }));
  }
}

export type { AgentRunError };
export { AgentRunTransitionError };
