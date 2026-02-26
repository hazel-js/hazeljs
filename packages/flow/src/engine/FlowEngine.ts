/**
 * FlowEngine - framework-agnostic execution graph engine
 */
import type { PrismaClient } from '../persistence/prisma.js';
import { FlowRunStatus } from '../persistence/prisma.js';
import { randomUUID } from 'crypto';
import type { FlowDefinition, FlowContext } from '../types/FlowTypes.js';
import type { FlowRunRow } from '../persistence/FlowRunRepo.js';
import { FlowDefinitionRepo } from '../persistence/FlowDefinitionRepo.js';
import { FlowRunRepo } from '../persistence/FlowRunRepo.js';
import { FlowEventRepo } from '../persistence/FlowEventRepo.js';
import { IdempotencyRepo } from '../persistence/IdempotencyRepo.js';
import { getFlowPrismaClient } from '../persistence/prismaClient.js';
import { withAdvisoryLock } from './Locks.js';
import { executeNode } from './Executor.js';
import { selectNextNode } from './Transition.js';
import { FlowNotFoundError, RunNotFoundError } from '../types/Errors.js';

export interface FlowEngineOptions {
  prisma?: PrismaClient;
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

export class FlowEngine {
  private readonly prisma: PrismaClient;
  private readonly defRepo: FlowDefinitionRepo;
  private readonly runRepo: FlowRunRepo;
  private readonly eventRepo: FlowEventRepo;
  private readonly idempotencyRepo: IdempotencyRepo;
  private readonly services: Record<string, unknown>;
  private readonly defRegistry = new Map<string, FlowDefinition>();

  constructor(options: FlowEngineOptions = {}) {
    this.prisma = options.prisma ?? getFlowPrismaClient();
    this.defRepo = new FlowDefinitionRepo(this.prisma);
    this.runRepo = new FlowRunRepo(this.prisma);
    this.eventRepo = new FlowEventRepo(this.prisma);
    this.idempotencyRepo = new IdempotencyRepo(this.prisma);
    this.services = options.services ?? {};
  }

  async registerDefinition(def: FlowDefinition): Promise<void> {
    this.defRegistry.set(`${def.flowId}@${def.version}`, def);
    await this.defRepo.save(def);
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
    await this.runRepo.create({
      runId,
      flowId: args.flowId,
      flowVersion: args.version,
      tenantId: args.tenantId,
      input: args.input,
      initialState: args.initialState,
    });

    await this.eventRepo.append(runId, 'RUN_STARTED', {});

    await this.runRepo.update(runId, {
      currentNodeId: def.entry,
    });

    return { runId, status: FlowRunStatus.RUNNING };
  }

  async tick(runId: string): Promise<FlowRunRow> {
    return withAdvisoryLock(this.prisma, runId, () => this.tickCore(runId));
  }

  private async tickCore(runId: string): Promise<FlowRunRow> {
    const run = await this.runRepo.get(runId);
    if (!run) throw new RunNotFoundError(runId);
    if (run.status !== FlowRunStatus.RUNNING && run.status !== FlowRunStatus.WAITING) {
      return run;
    }

    const def = this.getDefinition(run.flowId, run.flowVersion);
    if (!def) throw new FlowNotFoundError(run.flowId, run.flowVersion);

    const currentNodeId = run.currentNodeId ?? def.entry;
    const node = def.nodes[currentNodeId];
    if (!node) {
      await this.runRepo.update(runId, { status: FlowRunStatus.FAILED });
      await this.eventRepo.append(runId, 'RUN_ABORTED', {
        error: { code: 'NODE_NOT_FOUND', message: `Node ${currentNodeId} not found` },
      });
      return (await this.runRepo.get(runId))!;
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

    const { result, cached } = await executeNode(node, ctx, this.eventRepo, this.idempotencyRepo);

    if (result.status === 'error') {
      await this.runRepo.update(runId, {
        status: FlowRunStatus.FAILED,
        currentNodeId: null,
      });
      await this.eventRepo.append(runId, 'RUN_ABORTED', {
        error: result.error,
      });
      return (await this.runRepo.get(runId))!;
    }

    if (result.status === 'wait') {
      let newState = ctx.state;
      if (result.patch) {
        const { applyPatch } = await import('./Executor.js');
        newState = applyPatch(ctx.state, result.patch);
      }
      const newOutputs = { ...ctx.outputs, [currentNodeId]: result.output };
      await this.runRepo.update(runId, {
        status: FlowRunStatus.WAITING,
        stateJson: newState,
        outputsJson: newOutputs,
        currentNodeId,
      });
      await this.eventRepo.append(runId, 'RUN_WAITING', {
        nodeId: currentNodeId,
        reason: result.reason,
        until: result.until,
      });
      return (await this.runRepo.get(runId))!;
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
      await this.runRepo.update(runId, {
        status: FlowRunStatus.FAILED,
        currentNodeId: null,
      });
      await this.eventRepo.append(runId, 'RUN_ABORTED', {
        error: { code, message },
      });
      return (await this.runRepo.get(runId))!;
    }

    if (nextNodeId === null) {
      await this.runRepo.update(runId, {
        status: FlowRunStatus.COMPLETED,
        stateJson: newState,
        outputsJson: newOutputs,
        currentNodeId: null,
      });
      await this.eventRepo.append(runId, 'RUN_COMPLETED', {});
      return (await this.runRepo.get(runId))!;
    }

    await this.runRepo.update(runId, {
      stateJson: newState,
      outputsJson: newOutputs,
      currentNodeId: nextNodeId,
    });
    return (await this.runRepo.get(runId))!;
  }

  async resumeRun(runId: string, payload?: unknown): Promise<FlowRunRow> {
    return withAdvisoryLock(this.prisma, runId, async () => {
      const run = await this.runRepo.get(runId);
      if (!run) throw new RunNotFoundError(runId);
      if (run.status !== FlowRunStatus.WAITING) {
        return run;
      }

      const def = this.getDefinition(run.flowId, run.flowVersion);
      if (!def) throw new FlowNotFoundError(run.flowId, run.flowVersion);

      const currentNodeId = run.currentNodeId!;
      const node = def.nodes[currentNodeId];
      if (!node) {
        await this.runRepo.update(runId, { status: FlowRunStatus.FAILED });
        return (await this.runRepo.get(runId))!;
      }

      // Merge payload into state (e.g. for wait/resume flows)
      let newState = run.stateJson as Record<string, unknown>;
      if (payload != null && typeof payload === 'object') {
        newState = { ...newState, _resumePayload: payload };
      }

      await this.runRepo.update(runId, {
        status: FlowRunStatus.RUNNING,
        stateJson: newState,
      });

      return this.tickCore(runId);
    });
  }

  async getRun(runId: string): Promise<FlowRunRow | null> {
    return this.runRepo.get(runId);
  }

  async getRunningRunIds(): Promise<string[]> {
    const runs = await this.runRepo.findRunning();
    return runs.map((r) => r.runId);
  }

  async listFlows(): Promise<Array<{ flowId: string; version: string; definitionJson: unknown }>> {
    return this.defRepo.list();
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
    return this.eventRepo.getTimeline(runId);
  }
}
