/**
 * FlowEngine - framework-agnostic execution graph engine
 * Default storage is in-memory (no DB). For DB persistence, pass storage from createPrismaStorage(prisma) via @hazeljs/flow/prisma.
 */
import { randomUUID } from 'crypto';
import type { FlowDefinition, FlowContext, FlowRunStatus } from '../types/FlowTypes.js';
import type { FlowRunRow } from '../persistence/storage.js';
import type { FlowStorage } from '../persistence/storage.js';
import { createMemoryStorage } from '../persistence/memory.js';
import { executeNode } from './Executor.js';
import { selectNextNode } from './Transition.js';
import { FlowNotFoundError, RunNotFoundError } from '../types/Errors.js';

export interface FlowEngineOptions {
  /** Storage (default: in-memory). Use createPrismaStorage(prisma) from @hazeljs/flow/prisma for DB. */
  storage?: FlowStorage;
  services?: Record<string, unknown>;
}

export interface StartRunArgs {
  flowId: string;
  version: string;
  tenantId?: string;
  input: unknown;
  initialState?: Record<string, unknown>;
}

export interface StartRunResult {
  runId: string;
  status: FlowRunStatus;
}

const RUNNING: FlowRunStatus = 'RUNNING';
const WAITING: FlowRunStatus = 'WAITING';
const COMPLETED: FlowRunStatus = 'COMPLETED';
const FAILED: FlowRunStatus = 'FAILED';

export class FlowEngine {
  private readonly storage: FlowStorage;
  private readonly services: Record<string, unknown>;
  private readonly defRegistry = new Map<string, FlowDefinition>();

  constructor(options: FlowEngineOptions = {}) {
    this.storage = options.storage ?? createMemoryStorage();
    this.services = options.services ?? {};
  }

  async registerDefinition(def: FlowDefinition): Promise<void> {
    this.defRegistry.set(`${def.flowId}@${def.version}`, def);
    await this.storage.definitionRepo.save(def);
  }

  private getDefinition(flowId: string, version: string): FlowDefinition | null {
    return this.defRegistry.get(`${flowId}@${version}`) ?? null;
  }

  async startRun(args: StartRunArgs): Promise<StartRunResult> {
    const def = this.getDefinition(args.flowId, args.version);
    if (!def) {
      throw new FlowNotFoundError(args.flowId, args.version);
    }

    const runId = randomUUID();
    await this.storage.runRepo.create({
      runId,
      flowId: args.flowId,
      flowVersion: args.version,
      tenantId: args.tenantId,
      input: args.input,
      initialState: args.initialState,
    });

    await this.storage.eventRepo.append(runId, 'RUN_STARTED', {});

    await this.storage.runRepo.update(runId, {
      currentNodeId: def.entry,
    });

    return { runId, status: RUNNING };
  }

  async tick(runId: string): Promise<FlowRunRow> {
    return this.storage.withLock(runId, () => this.tickCore(runId));
  }

  private async tickCore(runId: string): Promise<FlowRunRow> {
    const run = await this.storage.runRepo.get(runId);
    if (!run) throw new RunNotFoundError(runId);
    if (run.status !== RUNNING && run.status !== WAITING) {
      return run;
    }

    const def = this.getDefinition(run.flowId, run.flowVersion);
    if (!def) throw new FlowNotFoundError(run.flowId, run.flowVersion);

    const currentNodeId = run.currentNodeId ?? def.entry;
    const node = def.nodes[currentNodeId];
    if (!node) {
      await this.storage.runRepo.update(runId, { status: FAILED });
      await this.storage.eventRepo.append(runId, 'RUN_ABORTED', {
        error: { code: 'NODE_NOT_FOUND', message: `Node ${currentNodeId} not found` },
      });
      return (await this.storage.runRepo.get(runId))!;
    }

    const ctx: FlowContext = {
      runId,
      flowId: run.flowId,
      flowVersion: run.flowVersion,
      tenantId: run.tenantId ?? undefined,
      input: run.inputJson as unknown,
      state: run.stateJson as Record<string, unknown>,
      outputs: run.outputsJson as Record<string, unknown>,
      meta: { attempts: {}, startedAt: run.createdAt.toISOString() },
      services: this.services,
    };

    const { result, cached } = await executeNode(
      node,
      ctx,
      this.storage.eventRepo,
      this.storage.idempotencyRepo
    );

    if (result.status === 'error') {
      await this.storage.runRepo.update(runId, {
        status: FAILED,
        currentNodeId: null,
      });
      await this.storage.eventRepo.append(runId, 'RUN_ABORTED', {
        error: result.error,
      });
      return (await this.storage.runRepo.get(runId))!;
    }

    if (result.status === 'wait') {
      let newState = ctx.state;
      if (result.patch) {
        const { applyPatch } = await import('./Executor.js');
        newState = applyPatch(ctx.state, result.patch);
      }
      const newOutputs = { ...ctx.outputs, [currentNodeId]: result.output };
      await this.storage.runRepo.update(runId, {
        status: WAITING,
        stateJson: newState,
        outputsJson: newOutputs,
        currentNodeId,
      });
      await this.storage.eventRepo.append(runId, 'RUN_WAITING', {
        nodeId: currentNodeId,
        reason: result.reason,
        until: result.until,
      });
      return (await this.storage.runRepo.get(runId))!;
    }

    // result.status === 'ok'
    let newState = ctx.state;
    if (result.patch && !cached) {
      const { applyPatch } = await import('./Executor.js');
      newState = applyPatch(ctx.state, result.patch);
    } else if (result.patch && cached) {
      newState = { ...ctx.state, ...result.patch };
    }
    const newOutputs = { ...ctx.outputs, [currentNodeId]: result.output };

    let nextNodeId: string | null;
    try {
      nextNodeId = selectNextNode(currentNodeId, def.edges, {
        ...ctx,
        state: newState,
        outputs: newOutputs,
      });
    } catch (err) {
      const code =
        err instanceof Error && 'code' in err ? (err as { code: string }).code : 'UNKNOWN';
      const message = err instanceof Error ? err.message : String(err);
      await this.storage.runRepo.update(runId, {
        status: FAILED,
        currentNodeId: null,
      });
      await this.storage.eventRepo.append(runId, 'RUN_ABORTED', {
        error: { code, message },
      });
      return (await this.storage.runRepo.get(runId))!;
    }

    if (nextNodeId === null) {
      await this.storage.runRepo.update(runId, {
        status: COMPLETED,
        stateJson: newState,
        outputsJson: newOutputs,
        currentNodeId: null,
      });
      await this.storage.eventRepo.append(runId, 'RUN_COMPLETED', {});
      return (await this.storage.runRepo.get(runId))!;
    }

    await this.storage.runRepo.update(runId, {
      stateJson: newState,
      outputsJson: newOutputs,
      currentNodeId: nextNodeId,
    });
    return (await this.storage.runRepo.get(runId))!;
  }

  async resumeRun(runId: string, payload?: unknown): Promise<FlowRunRow> {
    return this.storage.withLock(runId, async () => {
      const run = await this.storage.runRepo.get(runId);
      if (!run) throw new RunNotFoundError(runId);
      if (run.status !== WAITING) {
        return run;
      }

      const def = this.getDefinition(run.flowId, run.flowVersion);
      if (!def) throw new FlowNotFoundError(run.flowId, run.flowVersion);

      const currentNodeId = run.currentNodeId!;
      const node = def.nodes[currentNodeId];
      if (!node) {
        await this.storage.runRepo.update(runId, { status: FAILED });
        return (await this.storage.runRepo.get(runId))!;
      }

      // Merge payload into state (e.g. for wait/resume flows)
      let newState = run.stateJson as Record<string, unknown>;
      if (payload != null && typeof payload === 'object') {
        newState = { ...newState, _resumePayload: payload };
      }

      await this.storage.runRepo.update(runId, {
        status: RUNNING,
        stateJson: newState,
      });

      return this.tickCore(runId);
    });
  }

  async getRun(runId: string): Promise<FlowRunRow | null> {
    return this.storage.runRepo.get(runId);
  }

  async getRunningRunIds(): Promise<string[]> {
    const runs = await this.storage.runRepo.findRunning();
    return runs.map((r) => r.runId);
  }

  async listFlows(): Promise<Array<{ flowId: string; version: string; definitionJson: unknown }>> {
    return this.storage.definitionRepo.list();
  }

  async getTimeline(runId: string): Promise<
    Array<{
      at: Date;
      type: string;
      nodeId: string | null;
      attempt: number | null;
      payloadJson: unknown;
    }>
  > {
    return this.storage.eventRepo.getTimeline(runId);
  }
}
