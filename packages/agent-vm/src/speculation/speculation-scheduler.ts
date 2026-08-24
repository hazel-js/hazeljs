/**
 * Speculation scheduler — fork K branches, score, commit winner, roll back losers.
 */

import { randomUUID } from 'crypto';
import type { RunBudget } from '@hazeljs/agent';
import { AgentVmEventType, type AgentVmEventEmitter } from '../events/vm-event.types';
import type { EffectGate, EffectExecutionContext } from '../gate/effect-gate';
import type { EffectJournal } from '../journal/effect-journal';
import type { TransactionCoordinator } from '../transaction/transaction-coordinator';
import {
  selectBranchesToPrune,
  sliceBudgetAcrossBranches,
  type BranchScore,
} from './budget-slicer';
import { BranchStateManager } from './branch-state';
import type { BranchExecutionResult, BranchScorer } from './scorers/index';
import { HeuristicScorer, resolveScorer } from './scorers/index';
import type { SpeculateMetadata } from './speculate.decorator';
import type { IAgentStateManager } from '@hazeljs/agent';

export interface SpeculationBranchFn {
  (branchId: string, branchIndex: number, branchBudget?: RunBudget): Promise<unknown>;
}

export interface SpeculationSchedulerOptions {
  journal: EffectJournal;
  coordinator: TransactionCoordinator;
  effectGate: EffectGate;
  stateManager: IAgentStateManager;
  emit?: AgentVmEventEmitter;
  scorer?: BranchScorer | SpeculateMetadata['scorer'];
  judgeFn?: (output: unknown, context?: Record<string, unknown>) => Promise<number> | number;
  customScorerFn?: (result: BranchExecutionResult) => number;
}

export interface SpeculationResult {
  runId: string;
  winnerBranchId: string;
  winnerOutput: unknown;
  scores: BranchScore[];
  prunedBranches: string[];
  rolledBackBranches: string[];
}

export class SpeculationScheduler {
  private readonly branchState: BranchStateManager;
  private executionContext: EffectExecutionContext | undefined;

  constructor(private readonly options: SpeculationSchedulerOptions) {
    this.branchState = new BranchStateManager(options.stateManager);
  }

  /** Run speculative execution with K parallel branches. */
  async speculate(
    runId: string,
    parentExecutionId: string,
    config: SpeculateMetadata,
    branchFn: SpeculationBranchFn,
    context?: {
      agentId?: string;
      sessionId?: string;
      parentBudget?: RunBudget;
      scoreContext?: Record<string, unknown>;
    }
  ): Promise<SpeculationResult> {
    const branchCount = config.branches;
    const concurrency = config.concurrency ?? branchCount;
    const scorer = resolveScorer(config.scorer ?? this.options.scorer ?? 'heuristic', {
      judgeFn: this.options.judgeFn,
      customFn: this.options.customScorerFn,
    });

    this.options.emit?.({
      type: AgentVmEventType.SPECULATION_STARTED,
      runId,
      timestamp: new Date(),
      data: { branchCount, scorer: scorer.name },
    });

    const budgetSlices = sliceBudgetAcrossBranches(context?.parentBudget, branchCount);
    const branchIds = Array.from({ length: branchCount }, () => randomUUID());
    const results: BranchExecutionResult[] = [];
    const pruned = new Set<string>();

    // Fork branch states
    for (const branchId of branchIds) {
      this.branchState.fork(parentExecutionId, branchId);
    }

    const runBranch = async (index: number): Promise<BranchExecutionResult> => {
      const branchId = branchIds[index];
      if (pruned.has(branchId)) {
        return { branchId, output: undefined, metadata: { pruned: true } };
      }

      this.executionContext = {
        runId,
        branchId,
        agentId: context?.agentId ?? 'unknown',
        sessionId: context?.sessionId,
        speculative: true,
      };

      this.options.emit?.({
        type: AgentVmEventType.SPECULATION_BRANCH_STARTED,
        runId,
        branchId,
        timestamp: new Date(),
        data: { branchIndex: index },
      });

      try {
        const output = await branchFn(branchId, index, budgetSlices[index]?.budget);
        const result: BranchExecutionResult = { branchId, output };
        results.push(result);

        this.options.emit?.({
          type: AgentVmEventType.SPECULATION_BRANCH_COMPLETED,
          runId,
          branchId,
          timestamp: new Date(),
          data: { branchIndex: index },
        });

        return result;
      } catch (err) {
        const result: BranchExecutionResult = {
          branchId,
          output: undefined,
          metadata: { error: err instanceof Error ? err.message : String(err) },
        };
        results.push(result);
        return result;
      }
    };

    // Run with concurrency limit
    const pool: Promise<BranchExecutionResult>[] = [];
    const completed: BranchExecutionResult[] = [];

    for (let i = 0; i < branchCount; i++) {
      const task = runBranch(i).then((r) => {
        completed.push(r);
        if (config.prune === 'score' && completed.length >= 2) {
          this.maybePruneEarly(completed, scorer, context?.scoreContext, pruned);
        }
        return r;
      });
      pool.push(task);
      if (pool.length >= concurrency) {
        await Promise.race(pool);
      }
    }

    await Promise.all(pool);

    const scores: BranchScore[] = [];
    for (const result of results) {
      if (pruned.has(result.branchId)) {
        scores.push({ branchId: result.branchId, score: 0, metadata: { pruned: true } });
        continue;
      }
      const score = await scorer.score(result, context?.scoreContext);
      scores.push({ branchId: result.branchId, score, metadata: result.metadata });
    }

    const leader = scores.reduce((best, s) => (s.score > best.score ? s : best), scores[0]);
    const winnerBranchId = leader.branchId;
    const winnerResult = results.find((r) => r.branchId === winnerBranchId);

    // Commit winner state
    this.branchState.commit(winnerBranchId);

    this.options.emit?.({
      type: AgentVmEventType.SPECULATION_COMMITTED,
      runId,
      branchId: winnerBranchId,
      timestamp: new Date(),
      data: { winnerBranchId, score: leader.score },
    });

    // Roll back losers
    const rolledBack: string[] = [];
    for (const branchId of branchIds) {
      if (branchId === winnerBranchId) continue;
      await this.options.coordinator.rollbackBranch(branchId, runId);
      this.branchState.discard(branchId);
      rolledBack.push(branchId);
    }

    this.executionContext = undefined;

    return {
      runId,
      winnerBranchId,
      winnerOutput: winnerResult?.output,
      scores,
      prunedBranches: Array.from(pruned),
      rolledBackBranches: rolledBack,
    };
  }

  /** Expose current execution context for EffectGate. */
  getExecutionContext(): EffectExecutionContext | undefined {
    return this.executionContext;
  }

  getBranchStateManager(): BranchStateManager {
    return this.branchState;
  }

  private async maybePruneEarly(
    completed: BranchExecutionResult[],
    scorer: BranchScorer,
    scoreContext: Record<string, unknown> | undefined,
    pruned: Set<string>
  ): Promise<void> {
    const scores: BranchScore[] = [];
    for (const r of completed) {
      if (pruned.has(r.branchId)) continue;
      const score = await scorer.score(r, scoreContext);
      scores.push({ branchId: r.branchId, score });
    }
    if (scores.length < 2) return;

    const leader = scores.reduce((best, s) => (s.score > best.score ? s : best), scores[0]);
    const toPrune = selectBranchesToPrune(scores, leader);
    for (const id of toPrune) {
      pruned.add(id);
      this.options.emit?.({
        type: AgentVmEventType.SPECULATION_BRANCH_PRUNED,
        branchId: id,
        timestamp: new Date(),
        data: { branchId: id, leaderScore: leader.score },
      });
    }
  }
}

/** Factory for a complete Agent VM runtime stack. */
export interface AgentVmRuntimeOptions extends SpeculationSchedulerOptions {
  emit?: AgentVmEventEmitter;
}

export { createAgentVmRuntime, type AgentVmRuntimeBundle, type CreateAgentVmRuntimeOptions } from '../runtime/create-agent-vm-runtime';
