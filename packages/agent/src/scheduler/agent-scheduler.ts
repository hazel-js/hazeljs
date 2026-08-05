/**
 * AgentScheduler — enqueue / delay agent jobs (AOS-010).
 */

export type AgentSchedulerJobHandler = (job: AgentSchedulerJob) => void | Promise<void>;

export interface AgentSchedulerJob {
  id: string;
  agentName: string;
  input: string;
  options?: Record<string, unknown>;
  runId?: string;
  scheduledAt: Date;
  executeAt: Date;
}

export interface AgentScheduler {
  enqueue(
    job: Omit<AgentSchedulerJob, 'id' | 'scheduledAt' | 'executeAt'> & { id?: string }
  ): Promise<string>;
  scheduleAt(
    when: Date,
    job: Omit<AgentSchedulerJob, 'id' | 'scheduledAt' | 'executeAt'> & { id?: string }
  ): Promise<string>;
  cancel(jobId: string): Promise<boolean>;
  setHandler(handler: AgentSchedulerJobHandler): void;
}

export class InMemoryAgentScheduler implements AgentScheduler {
  private handler?: AgentSchedulerJobHandler;
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pending = new Map<string, AgentSchedulerJob>();
  private seq = 0;

  setHandler(handler: AgentSchedulerJobHandler): void {
    this.handler = handler;
  }

  async enqueue(
    job: Omit<AgentSchedulerJob, 'id' | 'scheduledAt' | 'executeAt'> & { id?: string }
  ): Promise<string> {
    return this.scheduleAt(new Date(), job);
  }

  async scheduleAt(
    when: Date,
    job: Omit<AgentSchedulerJob, 'id' | 'scheduledAt' | 'executeAt'> & { id?: string }
  ): Promise<string> {
    this.seq += 1;
    const id = job.id ?? `sched_${Date.now()}_${this.seq}`;
    const full: AgentSchedulerJob = {
      ...job,
      id,
      scheduledAt: new Date(),
      executeAt: when,
    };
    this.pending.set(id, full);
    const delay = Math.max(0, when.getTime() - Date.now());
    const timer = setTimeout(() => {
      this.timers.delete(id);
      this.pending.delete(id);
      void this.handler?.(full);
    }, delay);
    if (typeof timer.unref === 'function') timer.unref();
    this.timers.set(id, timer);
    return id;
  }

  async cancel(jobId: string): Promise<boolean> {
    const timer = this.timers.get(jobId);
    if (timer) clearTimeout(timer);
    this.timers.delete(jobId);
    return this.pending.delete(jobId);
  }
}

/**
 * Thin adapter: enqueue/delay via a QueueService-like peer (AOS-010).
 * Caller must wire the worker to invoke the same handler.
 */
export interface QueueServiceLike {
  add(
    queueName: string,
    jobName: string,
    data?: unknown,
    options?: { delay?: number }
  ): Promise<unknown>;
  addDelayed?(queueName: string, jobName: string, data: unknown, delayMs: number): Promise<unknown>;
}

export class QueueAgentScheduler implements AgentScheduler {
  private handler?: AgentSchedulerJobHandler;
  private seq = 0;

  constructor(
    private readonly queue: QueueServiceLike,
    private readonly queueName = 'hazel-agent-runs'
  ) {}

  setHandler(handler: AgentSchedulerJobHandler): void {
    this.handler = handler;
  }

  /** Invoke after a queue worker receives the job payload. */
  async handleQueuePayload(payload: AgentSchedulerJob): Promise<void> {
    await this.handler?.(payload);
  }

  async enqueue(
    job: Omit<AgentSchedulerJob, 'id' | 'scheduledAt' | 'executeAt'> & { id?: string }
  ): Promise<string> {
    return this.scheduleAt(new Date(), job);
  }

  async scheduleAt(
    when: Date,
    job: Omit<AgentSchedulerJob, 'id' | 'scheduledAt' | 'executeAt'> & { id?: string }
  ): Promise<string> {
    this.seq += 1;
    const id = job.id ?? `qsched_${Date.now()}_${this.seq}`;
    const full: AgentSchedulerJob = {
      ...job,
      id,
      scheduledAt: new Date(),
      executeAt: when,
    };
    const delay = Math.max(0, when.getTime() - Date.now());
    if (delay > 0 && this.queue.addDelayed) {
      await this.queue.addDelayed(this.queueName, 'agent.run', full, delay);
    } else {
      await this.queue.add(this.queueName, 'agent.run', full, delay > 0 ? { delay } : undefined);
    }
    return id;
  }

  async cancel(_jobId: string): Promise<boolean> {
    // BullMQ cancel requires job id from queue; leave false for thin adapter.
    return false;
  }
}
