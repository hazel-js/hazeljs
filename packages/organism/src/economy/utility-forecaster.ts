/**
 * Phase 4 — utility forecasting and opportunity-cost estimates.
 */

import type {
  OpportunityCostEstimate,
  OrganismRecord,
  ResourceRequest,
  RuntimeAgentRecord,
  UtilityForecast,
} from '../types/organism.types';
import { OrganismEventEmitter, OrganismEventType } from '../events/organism-events';

export class UtilityForecaster {
  constructor(
    private readonly events: OrganismEventEmitter,
    private readonly organismId: string
  ) {}

  /**
   * Deterministic forecast: expected value × confidence − opportunity cost,
   * adjusted by reputation and scarcity.
   */
  forecast(input: {
    agent: RuntimeAgentRecord;
    record: OrganismRecord;
    requested: ResourceRequest;
    expectedValue: number;
    confidence: number;
    urgency?: number;
  }): UtilityForecast {
    const { agent, record, requested, expectedValue, confidence } = input;
    const urgency = input.urgency ?? 0.5;
    const opportunity = this.opportunityCost(record, requested);
    const reputationBoost = 0.5 + agent.reputation.score * 0.5;
    const adjustedValue = expectedValue * clamp(confidence, 0, 1) * reputationBoost;
    const estimatedCost =
      (requested.tokens ?? 0) * 0.00001 + (requested.money ?? 0) + opportunity.total * 0.1;
    const netExpectedValue = adjustedValue - opportunity.total - estimatedCost;
    const expectedUtility = clamp(
      (netExpectedValue / Math.max(1, expectedValue + opportunity.total)) * (0.5 + urgency * 0.5),
      0,
      1
    );

    const forecast: UtilityForecast = {
      agentId: agent.id,
      expectedUtility,
      expectedValue,
      estimatedCost,
      opportunityCost: opportunity.total,
      netExpectedValue,
      confidence: clamp(confidence, 0, 1),
      reasoningSummary: `net=${netExpectedValue.toFixed(2)} (value=${adjustedValue.toFixed(2)} - opp=${opportunity.total.toFixed(2)} - cost=${estimatedCost.toFixed(2)}); scarcity=${opportunity.scarcityMultiplier.toFixed(2)}`,
    };

    void this.events.emit(OrganismEventType.ORGANISM_UTILITY_FORECAST, this.organismId, forecast);
    return forecast;
  }

  opportunityCost(record: OrganismRecord, requested: ResourceRequest): OpportunityCostEstimate {
    const tokenBudget = Math.max(
      1,
      (record.resources.tokenBudget ?? record.pool.tokensRemaining) || 1
    );
    const moneyBudget = Math.max(
      1,
      (record.resources.monthlyBudget?.amount ?? record.pool.moneyRemaining.amount) || 1
    );
    const tokenUtil = 1 - record.pool.tokensRemaining / tokenBudget;
    const moneyUtil = 1 - record.pool.moneyRemaining.amount / moneyBudget;
    const utilization = Math.max(tokenUtil, moneyUtil);
    const scarcityMultiplier = utilization < 0.7 ? 1 : 1 + (utilization - 0.7) * 5;

    const tokens = (requested.tokens ?? 0) * 0.00002 * scarcityMultiplier;
    const money = (requested.money ?? 0) * scarcityMultiplier;
    return {
      tokens,
      money,
      scarcityMultiplier,
      total: tokens + money,
    };
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
