/**
 * SQL-backed HumanTaskService via Prisma (AOS-014).
 */

import type { CreateHumanTaskInput, HumanTask, HumanTaskService } from './human-task.service';
import type { PrismaAgentRunClientLike } from './sql-run-client.types';

interface HumanTaskRow {
  id: string;
  runId: string;
  type: string;
  status: string;
  toolName: string | null;
  payload: unknown;
  createdAt: Date | string;
  resolvedAt: Date | string | null;
  resolvedBy: string | null;
  metadata: unknown;
}

function fromRow(row: HumanTaskRow): HumanTask {
  return {
    id: row.id,
    runId: row.runId,
    type: row.type as HumanTask['type'],
    status: row.status as HumanTask['status'],
    toolName: row.toolName ?? undefined,
    payload: row.payload ?? undefined,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    resolvedAt: row.resolvedAt
      ? row.resolvedAt instanceof Date
        ? row.resolvedAt
        : new Date(row.resolvedAt)
      : undefined,
    resolvedBy: row.resolvedBy ?? undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? undefined,
  };
}

export class SqlHumanTaskService implements HumanTaskService {
  private seq = 0;

  constructor(private readonly client: PrismaAgentRunClientLike) {
    if (!client?.agentHumanTask) {
      throw new Error('Prisma client with agentHumanTask model is required');
    }
  }

  async create(input: CreateHumanTaskInput): Promise<HumanTask> {
    this.seq += 1;
    const id = input.id ?? `ht_${input.runId}_${Date.now()}_${this.seq}`;
    const createdAt = new Date();
    const row = (await this.client.agentHumanTask.create({
      data: {
        id,
        runId: input.runId,
        type: input.type,
        status: 'pending',
        toolName: input.toolName ?? null,
        payload: input.payload ?? null,
        createdAt,
        metadata: input.metadata ?? null,
      },
    })) as HumanTaskRow;
    return fromRow(row);
  }

  async get(id: string): Promise<HumanTask | undefined> {
    const row = (await this.client.agentHumanTask.findUnique({
      where: { id },
    })) as HumanTaskRow | null;
    return row ? fromRow(row) : undefined;
  }

  async listByRun(runId: string): Promise<HumanTask[]> {
    const rows = (await this.client.agentHumanTask.findMany({
      where: { runId },
      orderBy: { createdAt: 'asc' },
    })) as HumanTaskRow[];
    return rows.map(fromRow);
  }

  async listPending(): Promise<HumanTask[]> {
    const rows = (await this.client.agentHumanTask.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
    })) as HumanTaskRow[];
    return rows.map(fromRow);
  }

  async resolve(
    id: string,
    decision: 'approved' | 'rejected' | 'expired',
    resolvedBy?: string
  ): Promise<HumanTask> {
    const existing = (await this.client.agentHumanTask.findUnique({
      where: { id },
    })) as HumanTaskRow | null;
    if (!existing) {
      throw new Error(`HumanTask not found: ${id}`);
    }
    const row = (await this.client.agentHumanTask.update({
      where: { id },
      data: {
        status: decision,
        resolvedAt: new Date(),
        resolvedBy: resolvedBy ?? null,
      },
    })) as HumanTaskRow;
    return fromRow(row);
  }
}
