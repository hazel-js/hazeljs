/**
 * SQL-backed AgentRun repository via Prisma (AOS-014).
 * Works with any Prisma-supported SQL provider — not Postgres-only.
 */

import { AgentRun, AgentRunStatus, AgentRunTransitionError } from './agent-run.types';
import { assertAgentRunTransition } from './agent-run.transitions';
import type { AgentRunRepository, CreateAgentRunInput } from './agent-run.repository';
import type { PrismaAgentRunClientLike } from './sql-run-client.types';

interface AgentRunRow {
  id: string;
  agentName: string;
  agentVersion: string | null;
  status: string;
  input: unknown;
  output: unknown;
  error: unknown;
  tenantId: string | null;
  userId: string | null;
  parentRunId: string | null;
  rootRunId: string;
  attempt: number;
  checkpointId: string | null;
  leaseOwner?: string | null;
  leaseExpiresAt?: Date | string | null;
  leaseToken?: string | null;
  createdAt: Date | string;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  updatedAt: Date | string;
  metadata: unknown;
}

function toDate(value: Date | string | null | undefined): Date | undefined {
  if (value == null) return undefined;
  return value instanceof Date ? value : new Date(value);
}

function fromRow(row: AgentRunRow): AgentRun {
  return {
    id: row.id,
    agentName: row.agentName,
    agentVersion: row.agentVersion ?? undefined,
    status: row.status as AgentRunStatus,
    input: row.input ?? undefined,
    output: row.output ?? undefined,
    error: (row.error as AgentRun['error']) ?? undefined,
    tenantId: row.tenantId ?? undefined,
    userId: row.userId ?? undefined,
    parentRunId: row.parentRunId ?? undefined,
    rootRunId: row.rootRunId,
    attempt: row.attempt,
    checkpointId: row.checkpointId ?? undefined,
    leaseOwner: row.leaseOwner ?? undefined,
    leaseExpiresAt: toDate(row.leaseExpiresAt),
    leaseToken: row.leaseToken ?? undefined,
    createdAt: toDate(row.createdAt)!,
    startedAt: toDate(row.startedAt),
    completedAt: toDate(row.completedAt),
    updatedAt: toDate(row.updatedAt)!,
    metadata: (row.metadata as Record<string, unknown>) ?? undefined,
  };
}

export class SqlAgentRunRepository implements AgentRunRepository {
  constructor(private readonly client: PrismaAgentRunClientLike) {
    if (!client?.agentRun) {
      throw new Error('Prisma client with agentRun model is required');
    }
  }

  async create(input: CreateAgentRunInput): Promise<AgentRun> {
    const existing = (await this.client.agentRun.findUnique({
      where: { id: input.id },
    })) as AgentRunRow | null;
    if (existing) {
      throw new Error(`AgentRun already exists: ${input.id}`);
    }
    const now = new Date();
    const row = (await this.client.agentRun.create({
      data: {
        id: input.id,
        agentName: input.agentName,
        agentVersion: input.agentVersion ?? null,
        status: AgentRunStatus.CREATED,
        input: input.input ?? null,
        output: null,
        error: null,
        tenantId: input.tenantId ?? null,
        userId: input.userId ?? null,
        parentRunId: input.parentRunId ?? null,
        rootRunId: input.rootRunId ?? input.id,
        attempt: 1,
        checkpointId: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        leaseToken: null,
        createdAt: now,
        updatedAt: now,
        metadata: input.metadata ?? null,
      },
    })) as AgentRunRow;
    return fromRow(row);
  }

  async get(runId: string): Promise<AgentRun | undefined> {
    const row = (await this.client.agentRun.findUnique({
      where: { id: runId },
    })) as AgentRunRow | null;
    return row ? fromRow(row) : undefined;
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
    const current = (await this.client.agentRun.findUnique({
      where: { id: runId },
    })) as AgentRunRow | null;
    if (!current) {
      throw new Error(`AgentRun not found: ${runId}`);
    }
    const from = current.status as AgentRunStatus;
    assertAgentRunTransition(runId, from, status);

    const now = new Date();
    const data: Record<string, unknown> = {
      status,
      updatedAt: now,
    };
    if (status === AgentRunStatus.RUNNING && !current.startedAt) {
      data.startedAt = now;
    }
    if (
      status === AgentRunStatus.COMPLETED ||
      status === AgentRunStatus.FAILED ||
      status === AgentRunStatus.CANCELLED ||
      status === AgentRunStatus.TIMED_OUT
    ) {
      data.completedAt = now;
    }
    if (patch?.output !== undefined) data.output = patch.output;
    if (patch?.error !== undefined) data.error = patch.error;
    if (patch?.checkpointId !== undefined) data.checkpointId = patch.checkpointId;
    if (patch?.attempt !== undefined) data.attempt = patch.attempt;
    if (patch?.metadata) {
      const prev = (current.metadata as Record<string, unknown>) ?? {};
      data.metadata = { ...prev, ...patch.metadata };
    }
    if (patch && 'leaseOwner' in patch) data.leaseOwner = patch.leaseOwner ?? null;
    if (patch && 'leaseExpiresAt' in patch) data.leaseExpiresAt = patch.leaseExpiresAt ?? null;
    if (patch && 'leaseToken' in patch) data.leaseToken = patch.leaseToken ?? null;

    const row = (await this.client.agentRun.update({
      where: { id: runId },
      data,
    })) as AgentRunRow;
    return fromRow(row);
  }

  async list(filter?: { agentName?: string; status?: AgentRunStatus }): Promise<AgentRun[]> {
    const where: Record<string, unknown> = {};
    if (filter?.agentName) where.agentName = filter.agentName;
    if (filter?.status) where.status = filter.status;
    const rows = (await this.client.agentRun.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    })) as AgentRunRow[];
    return rows.map(fromRow);
  }
}

export { AgentRunTransitionError };
