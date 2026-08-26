/**
 * Token / skill usage ledger. Cost is only computed when a pricing table is supplied.
 */

import {
  DEFAULT_MODEL_PROFILES,
  estimateCost,
  type ModelCostProfile,
} from '../cost/cost-optimizer';

export interface UsageRecord {
  agentId: string;
  at: Date;
  tokens?: number;
  skillName?: string;
  model?: string;
  success?: boolean;
}

export interface UsageTotals {
  tokens: number;
  skillCalls: number;
  estimatedCostUsd?: number;
  byAgent: Record<string, { tokens: number; skillCalls: number; estimatedCostUsd?: number }>;
}

export class UsageLedger {
  private readonly records: UsageRecord[] = [];

  constructor(private readonly profiles: ModelCostProfile[] | undefined = DEFAULT_MODEL_PROFILES) {}

  record(entry: UsageRecord): void {
    this.records.push(entry);
  }

  snapshot(since?: Date): UsageTotals {
    const rows = since ? this.records.filter((r) => r.at >= since) : this.records;
    const byAgent: UsageTotals['byAgent'] = {};
    let tokens = 0;
    let skillCalls = 0;
    let cost = 0;
    let hasCost = false;

    for (const row of rows) {
      const agent = (byAgent[row.agentId] ??= { tokens: 0, skillCalls: 0 });
      if (row.tokens) {
        tokens += row.tokens;
        agent.tokens += row.tokens;
        const usd = this.priceTokens(row.model, row.tokens);
        if (usd != null) {
          hasCost = true;
          cost += usd;
          agent.estimatedCostUsd = (agent.estimatedCostUsd ?? 0) + usd;
        }
      }
      if (row.skillName) {
        skillCalls += 1;
        agent.skillCalls += 1;
      }
    }

    return {
      tokens,
      skillCalls,
      estimatedCostUsd: hasCost ? cost : undefined,
      byAgent,
    };
  }

  private priceTokens(model: string | undefined, tokens: number): number | undefined {
    if (!this.profiles?.length || !model) return undefined;
    const profile = this.profiles.find((p) => p.id === model || p.id.startsWith(model));
    if (!profile) return undefined;
    const half = tokens / 2;
    return estimateCost(profile, half, half);
  }
}
