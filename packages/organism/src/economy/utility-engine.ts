import type {
  AgentOutcomeReport,
  AgentReputation,
  RuntimeAgentRecord,
  UtilityScore,
  UtilityWeights,
} from '../types/organism.types';
import { DEFAULT_UTILITY_WEIGHTS as WEIGHTS } from '../types/organism.types';
import { OrganismEventEmitter, OrganismEventType } from '../events/organism-events';

export class UtilityEngine {
  constructor(
    private readonly events: OrganismEventEmitter,
    private readonly organismId: string,
    private readonly weights: UtilityWeights = WEIGHTS
  ) {}

  evaluate(agent: RuntimeAgentRecord, report?: AgentOutcomeReport): UtilityScore {
    const valueGenerated = report?.metrics?.valueGenerated ?? agent.valueGenerated;
    const cost = report?.metrics?.cost ?? agent.costConsumed;
    const riskPenalty = report?.metrics?.riskPenalty ?? 0;
    const confidence = report?.metrics?.confidence ?? agent.utility.confidence;

    const missionContribution = clamp(
      valueGenerated / Math.max(1, valueGenerated + cost * 10),
      0,
      1
    );
    const efficiency = cost <= 0 ? 1 : clamp(valueGenerated / (valueGenerated + cost * 50), 0, 1);
    const reliability = clamp(agent.reputation.dimensions.reliability, 0, 1);
    const policyCompliance = clamp(agent.reputation.dimensions.policyCompliance, 0, 1);
    const collaboration = clamp(agent.reputation.dimensions.collaboration, 0, 1);

    const score =
      missionContribution * this.weights.missionContribution +
      reliability * this.weights.reliability +
      efficiency * this.weights.efficiency +
      policyCompliance * this.weights.policyCompliance +
      collaboration * this.weights.collaboration -
      riskPenalty;

    const utility: UtilityScore = {
      score: clamp(score, 0, 1),
      valueGenerated,
      cost,
      riskPenalty,
      confidence: clamp(confidence, 0, 1),
    };

    void this.events.emit(OrganismEventType.ORGANISM_UTILITY_CALCULATED, this.organismId, {
      agentId: agent.id,
      utility,
    });

    return utility;
  }
}

export class ReputationEngine {
  constructor(
    private readonly events: OrganismEventEmitter,
    private readonly organismId: string
  ) {}

  update(agent: RuntimeAgentRecord, report: AgentOutcomeReport): AgentReputation {
    const value = report.metrics?.valueGenerated ?? 0;
    const confidence = report.metrics?.confidence ?? 0.5;
    const cost = report.metrics?.cost ?? 0;

    const usefulnessDelta = clamp(value / 1000, -0.1, 0.15);
    const efficiencyDelta = cost > value * 0.1 ? -0.05 : 0.03;
    const reliabilityDelta = confidence >= 0.7 ? 0.04 : -0.03;

    const dims = { ...agent.reputation.dimensions };
    dims.usefulness = clamp(dims.usefulness + usefulnessDelta, 0, 1);
    dims.efficiency = clamp(dims.efficiency + efficiencyDelta, 0, 1);
    dims.reliability = clamp(dims.reliability + reliabilityDelta, 0, 1);

    const score =
      dims.usefulness * 0.3 +
      dims.reliability * 0.25 +
      dims.efficiency * 0.2 +
      dims.policyCompliance * 0.15 +
      dims.collaboration * 0.1;

    const reputation: AgentReputation = {
      agentId: agent.id,
      score: clamp(score, 0, 1),
      dimensions: dims,
    };

    void this.events.emit(OrganismEventType.ORGANISM_REPUTATION_CHANGED, this.organismId, {
      agentId: agent.id,
      reputation,
    });

    return reputation;
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
