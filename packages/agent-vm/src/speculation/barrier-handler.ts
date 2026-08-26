/**
 * Barrier handling for irreversible effects inside speculative branches.
 */

import { randomUUID } from 'crypto';
import type { ToolMetadata } from '@hazeljs/agent';
import { EffectKind } from '../effects/effect-kind';
import { AgentVmEventType, type AgentVmEventEmitter } from '../events/vm-event.types';
import type { EffectJournal } from '../journal/effect-journal';
import type { EffectExecutionContext } from '../gate/effect-gate';

export type BarrierMode = 'converge' | 'abort' | 'store-buffer';

export interface BarrierDecision {
  defer?: boolean;
  predictedOutput?: unknown;
  converge?: boolean;
  abort?: boolean;
}

export interface BarrierHandlerOptions {
  mode: BarrierMode;
  enableStoreBuffer?: boolean;
  journal: EffectJournal;
  emit?: AgentVmEventEmitter;
}

export interface BarrierContext {
  tool: ToolMetadata;
  input: Record<string, unknown>;
  execCtx: EffectExecutionContext;
  effectKind: EffectKind;
  predict?: (input: Record<string, unknown>) => unknown;
}

export class BarrierHandler {
  constructor(private readonly options: BarrierHandlerOptions) {}

  async handleBarrier(ctx: BarrierContext): Promise<BarrierDecision> {
    const { tool, input, execCtx, predict } = ctx;

    this.options.emit?.({
      type: AgentVmEventType.BARRIER_HIT,
      runId: execCtx.runId,
      branchId: execCtx.branchId,
      agentId: execCtx.agentId,
      timestamp: new Date(),
      data: { toolName: tool.name, mode: this.effectiveMode(predict) },
    });

    const mode = this.effectiveMode(predict);

    if (mode === 'store-buffer' && execCtx.branchId) {
      const predictedOutput = predict?.(input);
      await this.options.journal.deferIntent({
        branchId: execCtx.branchId,
        runId: execCtx.runId,
        toolName: tool.name,
        toolPropertyKey: tool.propertyKey,
        agentId: execCtx.agentId,
        input,
        predictedOutput,
      });

      return { defer: true, predictedOutput };
    }

    if (mode === 'abort') {
      this.options.emit?.({
        type: AgentVmEventType.BARRIER_ABORTED,
        runId: execCtx.runId,
        branchId: execCtx.branchId,
        timestamp: new Date(),
        data: { toolName: tool.name },
      });
      return { abort: true };
    }

    // Default: converge — pause branch until winner is known
    this.options.emit?.({
      type: AgentVmEventType.BARRIER_CONVERGED,
      runId: execCtx.runId,
      branchId: execCtx.branchId,
      timestamp: new Date(),
      data: { toolName: tool.name },
    });
    return { converge: true };
  }

  private effectiveMode(predict?: (input: Record<string, unknown>) => unknown): BarrierMode {
    if (this.options.enableStoreBuffer && predict) {
      return 'store-buffer';
    }
    return this.options.mode;
  }

  static newBranchId(): string {
    return randomUUID();
  }
}
