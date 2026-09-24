/**
 * Durable decision checkpoints + execution receipts (composes Agent DurableRunStore interfaces).
 */

import type { CheckpointService, HumanTaskService } from '@hazeljs/agent';
import type { DecisionRunStatus, DecisionResult } from '../types';

export interface DecisionCheckpointPayload {
  kind: 'hazeljs.decision';
  status: DecisionRunStatus;
  result?: DecisionResult;
  machineDecision?: string;
  machineConfidence?: number;
  humanOverride?: {
    decision: string;
    actor: string;
    reason: string;
    at: string;
  };
  executionReceipt?: {
    receiptId: string;
    capability: string;
    at: string;
    output?: unknown;
  };
}

export class DecisionDurableStore {
  constructor(
    private readonly checkpoints?: CheckpointService,
    private readonly humanTasks?: HumanTaskService
  ) {}

  get humanTaskService(): HumanTaskService | undefined {
    return this.humanTasks;
  }

  async save(
    runId: string,
    payload: DecisionCheckpointPayload,
    step?: number
  ): Promise<string | undefined> {
    if (!this.checkpoints) return undefined;
    const cp = await this.checkpoints.save(runId, payload, step);
    return cp.id;
  }

  async loadLatest(runId: string): Promise<DecisionCheckpointPayload | undefined> {
    if (!this.checkpoints) return undefined;
    const list = await this.checkpoints.list(runId);
    if (!list.length) return undefined;
    const last = list[list.length - 1];
    return last.payload as DecisionCheckpointPayload;
  }

  async getExecutionReceipt(
    runId: string
  ): Promise<DecisionCheckpointPayload['executionReceipt'] | undefined> {
    const payload = await this.loadLatest(runId);
    return payload?.executionReceipt;
  }
}
