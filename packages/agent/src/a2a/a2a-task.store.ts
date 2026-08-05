/**
 * Durable A2A task store (AOS-009).
 */

import * as fs from 'fs';
import * as path from 'path';
import type { A2ATask } from './a2a.types';

export interface A2ATaskStore {
  set(task: A2ATask): Promise<void>;
  get(taskId: string): Promise<A2ATask | undefined>;
  delete(taskId: string): Promise<boolean>;
  list(): Promise<A2ATask[]>;
  setExecutionMap(taskId: string, executionId: string): Promise<void>;
  getExecutionId(taskId: string): Promise<string | undefined>;
}

export class InMemoryA2ATaskStore implements A2ATaskStore {
  private readonly tasks = new Map<string, A2ATask>();
  private readonly execMap = new Map<string, string>();

  async set(task: A2ATask): Promise<void> {
    this.tasks.set(task.id, task);
  }

  async get(taskId: string): Promise<A2ATask | undefined> {
    const t = this.tasks.get(taskId);
    return t ? { ...t } : undefined;
  }

  async delete(taskId: string): Promise<boolean> {
    this.execMap.delete(taskId);
    return this.tasks.delete(taskId);
  }

  async list(): Promise<A2ATask[]> {
    return Array.from(this.tasks.values()).map((t) => ({ ...t }));
  }

  async setExecutionMap(taskId: string, executionId: string): Promise<void> {
    this.execMap.set(taskId, executionId);
  }

  async getExecutionId(taskId: string): Promise<string | undefined> {
    return this.execMap.get(taskId);
  }
}

interface StoredFile {
  tasks: A2ATask[];
  execMap: Record<string, string>;
}

export class FileA2ATaskStore implements A2ATaskStore {
  constructor(private readonly filePath: string) {}

  private read(): StoredFile {
    try {
      if (!fs.existsSync(this.filePath)) return { tasks: [], execMap: {} };
      const raw = fs.readFileSync(this.filePath, 'utf8');
      if (!raw.trim()) return { tasks: [], execMap: {} };
      return JSON.parse(raw) as StoredFile;
    } catch {
      return { tasks: [], execMap: {} };
    }
  }

  private write(data: StoredFile): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, this.filePath);
  }

  async set(task: A2ATask): Promise<void> {
    const data = this.read();
    const idx = data.tasks.findIndex((t) => t.id === task.id);
    if (idx >= 0) data.tasks[idx] = task;
    else data.tasks.push(task);
    this.write(data);
  }

  async get(taskId: string): Promise<A2ATask | undefined> {
    return this.read().tasks.find((t) => t.id === taskId);
  }

  async delete(taskId: string): Promise<boolean> {
    const data = this.read();
    const before = data.tasks.length;
    data.tasks = data.tasks.filter((t) => t.id !== taskId);
    delete data.execMap[taskId];
    this.write(data);
    return data.tasks.length < before;
  }

  async list(): Promise<A2ATask[]> {
    return this.read().tasks;
  }

  async setExecutionMap(taskId: string, executionId: string): Promise<void> {
    const data = this.read();
    data.execMap[taskId] = executionId;
    this.write(data);
  }

  async getExecutionId(taskId: string): Promise<string | undefined> {
    return this.read().execMap[taskId];
  }
}
