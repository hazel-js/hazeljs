/**
 * Human tasks for HITL / tool approval (AOS-006 foundation).
 * Durable flow bridge will resolve these without holding a worker.
 */

export type HumanTaskType = 'tool_approval' | 'user_input' | 'review';
export type HumanTaskStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface HumanTask {
  id: string;
  runId: string;
  type: HumanTaskType;
  status: HumanTaskStatus;
  toolName?: string;
  payload?: unknown;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateHumanTaskInput {
  id?: string;
  runId: string;
  type: HumanTaskType;
  toolName?: string;
  payload?: unknown;
  metadata?: Record<string, unknown>;
}

export interface HumanTaskService {
  create(input: CreateHumanTaskInput): Promise<HumanTask>;
  get(id: string): Promise<HumanTask | undefined>;
  listByRun(runId: string): Promise<HumanTask[]>;
  /** Pending (and optionally resolved) tasks across all runs — Approval Center. */
  listPending?(): Promise<HumanTask[]>;
  resolve(
    id: string,
    decision: 'approved' | 'rejected' | 'expired',
    resolvedBy?: string
  ): Promise<HumanTask>;
}

export class InMemoryHumanTaskService implements HumanTaskService {
  private readonly tasks = new Map<string, HumanTask>();
  private seq = 0;

  async create(input: CreateHumanTaskInput): Promise<HumanTask> {
    this.seq += 1;
    const id = input.id ?? `ht_${input.runId}_${this.seq}`;
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
    this.tasks.set(id, task);
    return { ...task };
  }

  async get(id: string): Promise<HumanTask | undefined> {
    const t = this.tasks.get(id);
    return t ? { ...t } : undefined;
  }

  async listByRun(runId: string): Promise<HumanTask[]> {
    return Array.from(this.tasks.values())
      .filter((t) => t.runId === runId)
      .map((t) => ({ ...t }));
  }

  async listPending(): Promise<HumanTask[]> {
    return Array.from(this.tasks.values())
      .filter((t) => t.status === 'pending')
      .map((t) => ({ ...t }));
  }

  async resolve(
    id: string,
    decision: 'approved' | 'rejected' | 'expired',
    resolvedBy?: string
  ): Promise<HumanTask> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`HumanTask not found: ${id}`);
    }
    task.status = decision;
    task.resolvedAt = new Date();
    task.resolvedBy = resolvedBy;
    return { ...task };
  }
}
