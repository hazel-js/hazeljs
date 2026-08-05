/**
 * Run budget hard-stop tracker (AOS-012).
 */

import {
  estimateCost,
  DEFAULT_MODEL_PROFILES,
  type ModelCostProfile,
} from '../cost/cost-optimizer';

export interface RunBudget {
  maxCostUsd?: number;
  maxTokens?: number;
}

export class BudgetExceededError extends Error {
  readonly code = 'BUDGET_EXCEEDED';
  constructor(
    message: string,
    public readonly budget: RunBudget,
    public readonly usage: { tokens: number; costUsd: number }
  ) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

export class RunBudgetTracker {
  private tokens = 0;
  private costUsd = 0;

  constructor(
    private readonly budget: RunBudget | undefined,
    private readonly profiles: ModelCostProfile[] = DEFAULT_MODEL_PROFILES
  ) {}

  get usage(): { tokens: number; costUsd: number } {
    return { tokens: this.tokens, costUsd: this.costUsd };
  }

  recordLlmUsage(
    usage?: { promptTokens?: number; completionTokens?: number },
    modelId?: string
  ): void {
    if (!this.budget) return;
    const prompt = usage?.promptTokens ?? 0;
    const completion = usage?.completionTokens ?? 0;
    this.tokens += prompt + completion;
    const profile =
      this.profiles.find((p) => p.id === modelId) ??
      this.profiles.find((p) => p.tier === 'economy') ??
      DEFAULT_MODEL_PROFILES[0];
    this.costUsd += estimateCost(profile, prompt, completion);
    this.assertWithinBudget();
  }

  assertWithinBudget(): void {
    if (!this.budget) return;
    if (this.budget.maxTokens != null && this.tokens > this.budget.maxTokens) {
      throw new BudgetExceededError(
        `Token budget exceeded (${this.tokens} > ${this.budget.maxTokens})`,
        this.budget,
        this.usage
      );
    }
    if (this.budget.maxCostUsd != null && this.costUsd > this.budget.maxCostUsd) {
      throw new BudgetExceededError(
        `Cost budget exceeded ($${this.costUsd.toFixed(6)} > $${this.budget.maxCostUsd})`,
        this.budget,
        this.usage
      );
    }
  }
}
