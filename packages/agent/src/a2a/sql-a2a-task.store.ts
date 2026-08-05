/**
 * SQL-backed A2A task store via Prisma (AOS-014).
 */

import type { A2ATask } from './a2a.types';
import type { A2ATaskStore } from './a2a-task.store';
import type { PrismaAgentRunClientLike } from '../run/sql-run-client.types';

interface A2ATaskRow {
  id: string;
  taskJson: unknown;
  executionId: string | null;
}

export class SqlA2ATaskStore implements A2ATaskStore {
  constructor(private readonly client: PrismaAgentRunClientLike) {
    if (!client?.agentA2ATask) {
      throw new Error('Prisma client with agentA2ATask model is required');
    }
  }

  async set(task: A2ATask): Promise<void> {
    const existing = (await this.client.agentA2ATask.findUnique({
      where: { id: task.id },
    })) as A2ATaskRow | null;
    if (existing) {
      await this.client.agentA2ATask.update({
        where: { id: task.id },
        data: { taskJson: task },
      });
      return;
    }
    await this.client.agentA2ATask.create({
      data: {
        id: task.id,
        taskJson: task,
        executionId: null,
      },
    });
  }

  async get(taskId: string): Promise<A2ATask | undefined> {
    const row = (await this.client.agentA2ATask.findUnique({
      where: { id: taskId },
    })) as A2ATaskRow | null;
    if (!row) return undefined;
    return { ...(row.taskJson as A2ATask) };
  }

  async delete(taskId: string): Promise<boolean> {
    const existing = (await this.client.agentA2ATask.findUnique({
      where: { id: taskId },
    })) as A2ATaskRow | null;
    if (!existing) return false;
    if (this.client.agentA2ATask.delete) {
      await this.client.agentA2ATask.delete({ where: { id: taskId } });
    } else {
      await this.client.agentA2ATask.update({
        where: { id: taskId },
        data: { taskJson: null, executionId: null },
      });
    }
    return true;
  }

  async list(): Promise<A2ATask[]> {
    const rows = (await this.client.agentA2ATask.findMany({})) as A2ATaskRow[];
    return rows.filter((r) => r.taskJson != null).map((r) => ({ ...(r.taskJson as A2ATask) }));
  }

  async setExecutionMap(taskId: string, executionId: string): Promise<void> {
    const existing = (await this.client.agentA2ATask.findUnique({
      where: { id: taskId },
    })) as A2ATaskRow | null;
    if (existing) {
      await this.client.agentA2ATask.update({
        where: { id: taskId },
        data: { executionId },
      });
      return;
    }
    await this.client.agentA2ATask.create({
      data: {
        id: taskId,
        taskJson: { id: taskId, status: { state: 'unknown' } },
        executionId,
      },
    });
  }

  async getExecutionId(taskId: string): Promise<string | undefined> {
    const row = (await this.client.agentA2ATask.findUnique({
      where: { id: taskId },
    })) as A2ATaskRow | null;
    return row?.executionId ?? undefined;
  }
}
