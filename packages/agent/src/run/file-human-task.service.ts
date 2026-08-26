/**
 * File-backed HumanTaskService (AOS-006 / restart survival).
 */

import * as fs from 'fs';
import * as path from 'path';
import type { CreateHumanTaskInput, HumanTask, HumanTaskService } from './human-task.service';

interface StoredTask {
  id: string;
  runId: string;
  type: HumanTask['type'];
  status: HumanTask['status'];
  toolName?: string;
  payload?: unknown;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  metadata?: Record<string, unknown>;
}

export class FileHumanTaskService implements HumanTaskService {
  private seq = 0;

  constructor(private readonly filePath: string) {}

  private readAll(): Map<string, HumanTask> {
    try {
      if (!fs.existsSync(this.filePath)) return new Map();
      const raw = fs.readFileSync(this.filePath, 'utf8');
      if (!raw.trim()) return new Map();
      const rows = JSON.parse(raw) as StoredTask[];
      const map = new Map<string, HumanTask>();
      for (const row of rows) {
        map.set(row.id, {
          ...row,
          createdAt: new Date(row.createdAt),
          resolvedAt: row.resolvedAt ? new Date(row.resolvedAt) : undefined,
        });
      }
      return map;
    } catch {
      return new Map();
    }
  }

  private writeAll(tasks: Map<string, HumanTask>): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const rows: StoredTask[] = Array.from(tasks.values()).map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      resolvedAt: t.resolvedAt?.toISOString(),
    }));
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), 'utf8');
    fs.renameSync(tmp, this.filePath);
  }

  async create(input: CreateHumanTaskInput): Promise<HumanTask> {
    const tasks = this.readAll();
    this.seq += 1;
    const id = input.id ?? `ht_${input.runId}_${Date.now()}_${this.seq}`;
    const task: HumanTask = {
      id,
      runId: input.runId,
      type: input.type,
      status: 'pending',
      toolName: input.toolName,
      payload: input.payload,
      createdAt: new Date(),
      metadata: input.metadata,
    };
    tasks.set(id, task);
    this.writeAll(tasks);
    return { ...task };
  }

  async get(id: string): Promise<HumanTask | undefined> {
    const t = this.readAll().get(id);
    return t ? { ...t } : undefined;
  }

  async listByRun(runId: string): Promise<HumanTask[]> {
    return Array.from(this.readAll().values())
      .filter((t) => t.runId === runId)
      .map((t) => ({ ...t }));
  }

  async listPending(): Promise<HumanTask[]> {
    return Array.from(this.readAll().values())
      .filter((t) => t.status === 'pending')
      .map((t) => ({ ...t }));
  }

  async resolve(
    id: string,
    decision: 'approved' | 'rejected' | 'expired',
    resolvedBy?: string
  ): Promise<HumanTask> {
    const tasks = this.readAll();
    const task = tasks.get(id);
    if (!task) {
      throw new Error(`HumanTask not found: ${id}`);
    }
    task.status = decision;
    task.resolvedAt = new Date();
    task.resolvedBy = resolvedBy;
    tasks.set(id, task);
    this.writeAll(tasks);
    return { ...task };
  }
}
