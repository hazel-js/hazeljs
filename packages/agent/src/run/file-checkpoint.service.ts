/**
 * File-backed CheckpointService (AOS-006 / restart survival).
 */

import * as fs from 'fs';
import * as path from 'path';
import type { AgentCheckpoint, CheckpointService } from './checkpoint.service';

interface StoredCheckpoint {
  id: string;
  runId: string;
  step?: number;
  payload: unknown;
  createdAt: string;
}

export class FileCheckpointService implements CheckpointService {
  private seq = 0;

  constructor(private readonly filePath: string) {}

  private readAll(): Map<string, AgentCheckpoint[]> {
    try {
      if (!fs.existsSync(this.filePath)) return new Map();
      const raw = fs.readFileSync(this.filePath, 'utf8');
      if (!raw.trim()) return new Map();
      const rows = JSON.parse(raw) as StoredCheckpoint[];
      const map = new Map<string, AgentCheckpoint[]>();
      for (const row of rows) {
        const cp: AgentCheckpoint = {
          ...row,
          createdAt: new Date(row.createdAt),
        };
        const list = map.get(row.runId) ?? [];
        list.push(cp);
        map.set(row.runId, list);
      }
      return map;
    } catch {
      return new Map();
    }
  }

  private writeAll(byRun: Map<string, AgentCheckpoint[]>): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const rows: StoredCheckpoint[] = [];
    for (const list of byRun.values()) {
      for (const cp of list) {
        rows.push({
          id: cp.id,
          runId: cp.runId,
          step: cp.step,
          payload: cp.payload,
          createdAt: cp.createdAt.toISOString(),
        });
      }
    }
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), 'utf8');
    fs.renameSync(tmp, this.filePath);
  }

  async save(runId: string, payload: unknown, step?: number): Promise<AgentCheckpoint> {
    const byRun = this.readAll();
    this.seq += 1;
    const cp: AgentCheckpoint = {
      id: `cp_${runId}_${Date.now()}_${this.seq}`,
      runId,
      step,
      payload,
      createdAt: new Date(),
    };
    const list = byRun.get(runId) ?? [];
    list.push(cp);
    byRun.set(runId, list);
    this.writeAll(byRun);
    return { ...cp };
  }

  async load(runId: string, checkpointId?: string): Promise<AgentCheckpoint | undefined> {
    const list = this.readAll().get(runId) ?? [];
    if (checkpointId) {
      const found = list.find((c) => c.id === checkpointId);
      return found ? { ...found } : undefined;
    }
    const last = list[list.length - 1];
    return last ? { ...last } : undefined;
  }

  async list(runId: string): Promise<AgentCheckpoint[]> {
    return [...(this.readAll().get(runId) ?? [])].map((c) => ({ ...c }));
  }
}
