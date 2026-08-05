/**
 * Minimal checkpoint service (AOS-003) — in-memory; durable adapters later.
 */

export interface AgentCheckpoint {
  id: string;
  runId: string;
  step?: number;
  payload: unknown;
  createdAt: Date;
}

export interface CheckpointService {
  save(runId: string, payload: unknown, step?: number): Promise<AgentCheckpoint>;
  load(runId: string, checkpointId?: string): Promise<AgentCheckpoint | undefined>;
  list(runId: string): Promise<AgentCheckpoint[]>;
}

export class InMemoryCheckpointService implements CheckpointService {
  private readonly byRun = new Map<string, AgentCheckpoint[]>();
  private seq = 0;

  async save(runId: string, payload: unknown, step?: number): Promise<AgentCheckpoint> {
    this.seq += 1;
    const cp: AgentCheckpoint = {
      id: `cp_${runId}_${this.seq}`,
      runId,
      step,
      payload,
      createdAt: new Date(),
    };
    const list = this.byRun.get(runId) ?? [];
    list.push(cp);
    this.byRun.set(runId, list);
    return { ...cp };
  }

  async load(runId: string, checkpointId?: string): Promise<AgentCheckpoint | undefined> {
    const list = this.byRun.get(runId) ?? [];
    if (checkpointId) {
      const found = list.find((c) => c.id === checkpointId);
      return found ? { ...found } : undefined;
    }
    const last = list[list.length - 1];
    return last ? { ...last } : undefined;
  }

  async list(runId: string): Promise<AgentCheckpoint[]> {
    return [...(this.byRun.get(runId) ?? [])].map((c) => ({ ...c }));
  }
}
