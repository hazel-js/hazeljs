/**
 * SQL-backed CheckpointService via Prisma (AOS-014).
 */

import type { AgentCheckpoint, CheckpointService } from './checkpoint.service';
import type { PrismaAgentRunClientLike } from './sql-run-client.types';

interface CheckpointRow {
  id: string;
  runId: string;
  step: number | null;
  payload: unknown;
  createdAt: Date | string;
}

export class SqlCheckpointService implements CheckpointService {
  private seq = 0;

  constructor(private readonly client: PrismaAgentRunClientLike) {
    if (!client?.agentRunCheckpoint) {
      throw new Error('Prisma client with agentRunCheckpoint model is required');
    }
  }

  async save(runId: string, payload: unknown, step?: number): Promise<AgentCheckpoint> {
    this.seq += 1;
    const id = `cp_${runId}_${Date.now()}_${this.seq}`;
    const createdAt = new Date();
    const row = (await this.client.agentRunCheckpoint.create({
      data: {
        id,
        runId,
        step: step ?? null,
        payload: payload ?? null,
        createdAt,
      },
    })) as CheckpointRow;
    return {
      id: row.id,
      runId: row.runId,
      step: row.step ?? undefined,
      payload: row.payload,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    };
  }

  async load(runId: string, checkpointId?: string): Promise<AgentCheckpoint | undefined> {
    if (checkpointId) {
      const row = (await this.client.agentRunCheckpoint.findUnique({
        where: { id: checkpointId },
      })) as CheckpointRow | null;
      if (!row || row.runId !== runId) return undefined;
      return {
        id: row.id,
        runId: row.runId,
        step: row.step ?? undefined,
        payload: row.payload,
        createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
      };
    }
    const rows = (await this.client.agentRunCheckpoint.findMany({
      where: { runId },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })) as CheckpointRow[];
    const row = rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      runId: row.runId,
      step: row.step ?? undefined,
      payload: row.payload,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    };
  }

  async list(runId: string): Promise<AgentCheckpoint[]> {
    const rows = (await this.client.agentRunCheckpoint.findMany({
      where: { runId },
      orderBy: { createdAt: 'asc' },
    })) as CheckpointRow[];
    return rows.map((row) => ({
      id: row.id,
      runId: row.runId,
      step: row.step ?? undefined,
      payload: row.payload,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    }));
  }
}
