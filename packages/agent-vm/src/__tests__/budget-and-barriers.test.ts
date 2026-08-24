import 'reflect-metadata';
import { sliceBudgetAcrossBranches, selectBranchesToPrune } from '../speculation/budget-slicer';
import { Atomic, getAtomicMetadata, isAtomicMethod } from '../transaction/atomic.decorator';
import { Speculate, getSpeculateMetadata } from '../speculation/speculate.decorator';
import { BarrierHandler } from '../speculation/barrier-handler';
import { EffectJournal } from '../journal/effect-journal';
import { EffectKind } from '../effects/effect-kind';
import type { ToolMetadata } from '@hazeljs/agent';

class MetaAgent {
  @Atomic({ autoUndoOnFailure: true })
  async run() {
    return 'ok';
  }

  @Speculate({ branches: 2, scorer: 'heuristic' })
  async plan() {
    return 'plan';
  }
}

describe('budget-slicer', () => {
  it('slices parent budget evenly across branches', () => {
    const slices = sliceBudgetAcrossBranches({ maxCostUsd: 0.09, maxTokens: 900 }, 3);
    expect(slices).toHaveLength(3);
    expect(slices[0].budget.maxCostUsd).toBeCloseTo(0.03);
    expect(slices[0].budget.maxTokens).toBe(300);
  });

  it('selects branches below prune threshold', () => {
    const leader = { branchId: 'a', score: 1 };
    const scores = [
      leader,
      { branchId: 'b', score: 0.5 },
      { branchId: 'c', score: 0.1 },
    ];
    const pruned = selectBranchesToPrune(scores, leader, 0.15);
    expect(pruned).toContain('c');
  });
});

describe('metadata decorators', () => {
  it('stores atomic metadata', () => {
    expect(isAtomicMethod(MetaAgent.prototype, 'run')).toBe(true);
    expect(getAtomicMetadata(MetaAgent.prototype, 'run')?.autoUndoOnFailure).toBe(true);
  });

  it('stores speculate metadata', () => {
    const meta = getSpeculateMetadata(MetaAgent.prototype, 'plan');
    expect(meta?.branches).toBe(2);
    expect(meta?.scorer).toBe('heuristic');
  });
});

describe('BarrierHandler store-buffer', () => {
  it('defers irreversible tool with predicted output', async () => {
    const journal = new EffectJournal();
    const handler = new BarrierHandler({
      mode: 'converge',
      enableStoreBuffer: true,
      journal,
    });

    const tool = {
      name: 'charge',
      propertyKey: 'charge',
      target: {},
    } as ToolMetadata;

    const decision = await handler.handleBarrier({
      tool,
      input: { amount: 50 },
      execCtx: { runId: 'r1', branchId: 'b1', agentId: 'a', speculative: true },
      effectKind: EffectKind.IRREVERSIBLE,
      predict: () => ({ charged: true }),
    });

    expect(decision.defer).toBe(true);
    expect(decision.predictedOutput).toEqual({ charged: true });
    const deferred = await journal.getStore().listDeferred('b1');
    expect(deferred).toHaveLength(1);
  });
});
