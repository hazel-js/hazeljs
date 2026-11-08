import { randomUUID } from 'crypto';
import type { AarRunMetadata, AutonomousRunRecord, AutonomousRunStore } from '../types';

/**
 * Local-first in-memory run store for tests and `hazel dev`.
 * Production should inject a DurableRunStore-backed adapter.
 */
export class MemoryAutonomousRunStore implements AutonomousRunStore {
  private readonly runs = new Map<string, AutonomousRunRecord>();

  async create(input: {
    id: string;
    serviceId: string;
    input?: unknown;
    tenantId?: string;
    metadata: AarRunMetadata;
  }): Promise<AutonomousRunRecord> {
    if (this.runs.has(input.id)) {
      throw new Error(`Autonomous run already exists: ${input.id}`);
    }
    const now = new Date();
    const record: AutonomousRunRecord = {
      id: input.id,
      serviceId: input.serviceId,
      status: 'created',
      input: input.input,
      tenantId: input.tenantId,
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata,
    };
    this.runs.set(record.id, record);
    return { ...record, metadata: { ...record.metadata } };
  }

  async get(runId: string): Promise<AutonomousRunRecord | undefined> {
    const run = this.runs.get(runId);
    return run
      ? { ...run, metadata: { ...run.metadata, timeline: [...(run.metadata.timeline ?? [])] } }
      : undefined;
  }

  async update(
    runId: string,
    patch: {
      status?: string;
      output?: unknown;
      error?: { message: string; code?: string };
      metadata?: AarRunMetadata;
    }
  ): Promise<AutonomousRunRecord> {
    const existing = this.runs.get(runId);
    if (!existing) throw new Error(`Autonomous run not found: ${runId}`);
    const updated: AutonomousRunRecord = {
      ...existing,
      status: patch.status ?? existing.status,
      output: patch.output !== undefined ? patch.output : existing.output,
      error: patch.error ?? existing.error,
      metadata: patch.metadata ?? existing.metadata,
      updatedAt: new Date(),
    };
    this.runs.set(runId, updated);
    return { ...updated, metadata: { ...updated.metadata } };
  }

  async list(filter?: { serviceId?: string; status?: string }): Promise<AutonomousRunRecord[]> {
    let rows = Array.from(this.runs.values());
    if (filter?.serviceId) rows = rows.filter((r) => r.serviceId === filter.serviceId);
    if (filter?.status) rows = rows.filter((r) => r.status === filter.status);
    return rows.map((r) => ({ ...r, metadata: { ...r.metadata } }));
  }
}

/**
 * Bridge Agent DurableRunStore / InMemoryAgentRunRepository into AutonomousRunStore.
 */
export function createAgentBackedRunStore(repo: {
  create(input: {
    id: string;
    agentName: string;
    input?: unknown;
    tenantId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    id: string;
    agentName: string;
    status: string;
    input?: unknown;
    output?: unknown;
    error?: { message: string; code?: string };
    tenantId?: string;
    createdAt: Date;
    updatedAt: Date;
    metadata?: Record<string, unknown>;
  }>;
  get(runId: string): Promise<
    | {
        id: string;
        agentName: string;
        status: string;
        input?: unknown;
        output?: unknown;
        error?: { message: string; code?: string };
        tenantId?: string;
        createdAt: Date;
        updatedAt: Date;
        metadata?: Record<string, unknown>;
      }
    | undefined
  >;
  updateStatus(
    runId: string,
    status: string,
    patch?: {
      output?: unknown;
      error?: { message: string; code?: string };
      metadata?: Record<string, unknown>;
    }
  ): Promise<{
    id: string;
    agentName: string;
    status: string;
    input?: unknown;
    output?: unknown;
    error?: { message: string; code?: string };
    tenantId?: string;
    createdAt: Date;
    updatedAt: Date;
    metadata?: Record<string, unknown>;
  }>;
  list(filter?: { agentName?: string; status?: string }): Promise<
    Array<{
      id: string;
      agentName: string;
      status: string;
      input?: unknown;
      output?: unknown;
      error?: { message: string; code?: string };
      tenantId?: string;
      createdAt: Date;
      updatedAt: Date;
      metadata?: Record<string, unknown>;
    }>
  >;
}): AutonomousRunStore {
  const toRecord = (run: {
    id: string;
    agentName: string;
    status: string;
    input?: unknown;
    output?: unknown;
    error?: { message: string; code?: string };
    tenantId?: string;
    createdAt: Date;
    updatedAt: Date;
    metadata?: Record<string, unknown>;
  }): AutonomousRunRecord => ({
    id: run.id,
    serviceId: run.agentName,
    status: run.status,
    input: run.input,
    output: run.output,
    error: run.error,
    tenantId: run.tenantId,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    metadata: (run.metadata as unknown as AarRunMetadata) ?? {
      kind: 'autonomous',
      serviceId: run.agentName,
      phase: 'created',
      mode: 'observe-only',
    },
  });

  return {
    async create(input: {
      id: string;
      serviceId: string;
      input?: unknown;
      tenantId?: string;
      metadata: AarRunMetadata;
    }): Promise<AutonomousRunRecord> {
      const run = await repo.create({
        id: input.id,
        agentName: input.serviceId,
        input: input.input,
        tenantId: input.tenantId,
        metadata: input.metadata as unknown as Record<string, unknown>,
      });
      return toRecord(run);
    },
    async get(runId: string): Promise<AutonomousRunRecord | undefined> {
      const run = await repo.get(runId);
      return run ? toRecord(run) : undefined;
    },
    async update(
      runId: string,
      patch: {
        status?: string;
        output?: unknown;
        error?: { message: string; code?: string };
        metadata?: AarRunMetadata;
      }
    ): Promise<AutonomousRunRecord> {
      const status = patch.status ?? 'running';
      const run = await repo.updateStatus(runId, status, {
        output: patch.output,
        error: patch.error,
        metadata: patch.metadata as unknown as Record<string, unknown>,
      });
      return toRecord(run);
    },
    async list(filter?: { serviceId?: string; status?: string }): Promise<AutonomousRunRecord[]> {
      const runs = await repo.list({
        agentName: filter?.serviceId,
        status: filter?.status,
      });
      return runs
        .filter((r) => (r.metadata as AarRunMetadata | undefined)?.kind === 'autonomous')
        .map(toRecord);
    },
  };
}

export function newRunId(): string {
  return `aar_${randomUUID()}`;
}
