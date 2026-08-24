/**
 * Budget slicing across speculative branches.
 */

import type { RunBudget } from '@hazeljs/agent';

export interface BranchBudgetSlice {
  branchIndex: number;
  budget: RunBudget;
}

export function sliceBudgetAcrossBranches(
  parentBudget: RunBudget | undefined,
  branchCount: number
): BranchBudgetSlice[] {
  if (!parentBudget || branchCount <= 0) {
    return Array.from({ length: branchCount }, (_, i) => ({
      branchIndex: i,
      budget: {},
    }));
  }

  const slices: BranchBudgetSlice[] = [];
  for (let i = 0; i < branchCount; i++) {
    slices.push({
      branchIndex: i,
      budget: {
        maxCostUsd:
          parentBudget.maxCostUsd != null
            ? parentBudget.maxCostUsd / branchCount
            : undefined,
        maxTokens:
          parentBudget.maxTokens != null ? Math.floor(parentBudget.maxTokens / branchCount) : undefined,
      },
    });
  }
  return slices;
}

export interface BranchScore {
  branchId: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/** Prune branches below threshold relative to the current leader. */
export function selectBranchesToPrune(
  scores: BranchScore[],
  leader: BranchScore,
  pruneThreshold = 0.15
): string[] {
  const minScore = leader.score * (1 - pruneThreshold);
  return scores.filter((s) => s.branchId !== leader.branchId && s.score < minScore).map((s) => s.branchId);
}
