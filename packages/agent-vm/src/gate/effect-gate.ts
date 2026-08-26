/**
 * Effect gate — enforces effect lattice rules at tool execution time.
 */

import { randomUUID } from 'crypto';
import type { ToolEffectContext, ToolEffectDecision } from '@hazeljs/agent';
import type { ToolMetadata } from '@hazeljs/agent';
import { EffectKind, isSpeculationSafe } from '../effects/effect-kind';
import { getPredictFn, inferEffectKind } from '../effects/infer';
import { AgentVmEventType, type AgentVmEventEmitter } from '../events/vm-event.types';
import type { EffectJournal } from '../journal/effect-journal';
import type { BarrierMode } from '../speculation/barrier-handler';
import { BarrierHandler } from '../speculation/barrier-handler';

export interface EffectGateOptions {
  journal: EffectJournal;
  emit?: AgentVmEventEmitter;
  /** Current execution mode — linear vs speculative branch. */
  getExecutionContext?: () => EffectExecutionContext | undefined;
  barrierMode?: BarrierMode;
  enableStoreBuffer?: boolean;
}

export interface EffectExecutionContext {
  runId: string;
  branchId?: string;
  agentId: string;
  sessionId?: string;
  speculative: boolean;
  /** Set true when speculation should abort to linear execution. */
  abortSpeculation?: boolean;
}

export class EffectGate {
  private readonly barrierHandler: BarrierHandler;

  constructor(private readonly options: EffectGateOptions) {
    this.barrierHandler = new BarrierHandler({
      mode: options.barrierMode ?? 'converge',
      enableStoreBuffer: options.enableStoreBuffer ?? false,
      journal: options.journal,
      emit: options.emit,
    });
  }

  /** Called by ToolExecutor before invoking a tool. */
  async beforeToolExecute(ctx: ToolEffectContext): Promise<ToolEffectDecision> {
    const execCtx = this.options.getExecutionContext?.() ?? {
      runId: ctx.runId ?? ctx.executionId,
      agentId: ctx.agentId,
      sessionId: ctx.sessionId,
      speculative: Boolean(ctx.branchId),
    };

    const tool = ctx.tool as ToolMetadata;
    const kind = inferEffectKind(tool);

    if (!execCtx.speculative) {
      return { allow: true, effectKind: kind };
    }

    if (isSpeculationSafe(kind)) {
      return { allow: true, effectKind: kind };
    }

    const decision = await this.barrierHandler.handleBarrier({
      tool,
      input: ctx.input,
      execCtx,
      effectKind: kind,
      predict: getPredictFn(tool),
    });

    if (decision.defer) {
      return {
        allow: true,
        effectKind: kind,
        deferred: true,
        predictedOutput: decision.predictedOutput,
      };
    }

    if (decision.converge) {
      return {
        allow: false,
        effectKind: kind,
        reason: 'Irreversible tool requires branch convergence',
        barrier: true,
      };
    }

    if (decision.abort) {
      execCtx.abortSpeculation = true;
      return {
        allow: false,
        effectKind: kind,
        reason: 'Speculation aborted at irreversible barrier',
        abortSpeculation: true,
      };
    }

    return { allow: false, effectKind: kind, reason: 'Effect not allowed in speculative branch' };
  }

  /** Called by ToolExecutor after a successful tool invocation. */
  async afterToolExecute(
    ctx: ToolEffectContext & { output: unknown; deferred?: boolean }
  ): Promise<void> {
    if (ctx.deferred) {
      return;
    }

    const execCtx = this.options.getExecutionContext?.() ?? {
      runId: ctx.runId ?? ctx.executionId,
      branchId: ctx.branchId,
      agentId: ctx.agentId,
      sessionId: ctx.sessionId,
      speculative: Boolean(ctx.branchId),
    };

    const tool = ctx.tool as ToolMetadata;
    const kind = inferEffectKind(tool);

    if (kind === EffectKind.REVERSIBLE) {
      const entry = await this.options.journal.record({
        runId: execCtx.runId,
        branchId: execCtx.branchId,
        agentId: execCtx.agentId,
        sessionId: execCtx.sessionId,
        tool,
        input: ctx.input,
        output: ctx.output,
        effectKind: kind,
      });

      if (entry) {
        this.options.emit?.({
          type: AgentVmEventType.EFFECT_JOURNALED,
          runId: execCtx.runId,
          branchId: execCtx.branchId,
          agentId: execCtx.agentId,
          timestamp: new Date(),
          data: { entryId: entry.id, toolName: entry.toolName },
        });
      }
    }
  }

  /** Drain deferred irreversible intents when a branch wins speculation. */
  async drainBranchIntents(
    branchId: string,
    executeTool: (intent: {
      toolName: string;
      toolPropertyKey: string;
      input: Record<string, unknown>;
    }) => Promise<unknown>
  ): Promise<void> {
    const intents = await this.options.journal.drainDeferred(branchId);
    for (const intent of intents) {
      await executeTool({
        toolName: intent.toolName,
        toolPropertyKey: intent.toolPropertyKey,
        input: intent.input,
      });
    }
  }

  static newRunId(): string {
    return randomUUID();
  }
}
