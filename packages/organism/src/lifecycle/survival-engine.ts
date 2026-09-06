import type { RuntimeAgentRecord, SurvivalConfig, SurvivalState } from '../types/organism.types';
import { DEFAULT_SURVIVAL_CONFIG } from '../types/organism.types';

export interface SurvivalVerdict {
  agentId: string;
  state: SurvivalState;
  reason: string;
  shouldTerminate: boolean;
}

/**
 * Survival engine — never kill on a single poor outcome.
 */
export class SurvivalEngine {
  constructor(
    private readonly config: SurvivalConfig = DEFAULT_SURVIVAL_CONFIG,
    private readonly now: () => Date = () => new Date()
  ) {}

  evaluate(agent: RuntimeAgentRecord): SurvivalVerdict {
    if (agent.status === 'terminated') {
      return {
        agentId: agent.id,
        state: 'terminated',
        reason: 'Already terminated',
        shouldTerminate: false,
      };
    }

    if (agent.criticalResponsibility) {
      return {
        agentId: agent.id,
        state: 'healthy',
        reason: 'Critical responsibility protected',
        shouldTerminate: false,
      };
    }

    const ageMs = this.now().getTime() - agent.createdAt.getTime();
    if (ageMs < this.config.minimumEvaluationAgeMs) {
      return {
        agentId: agent.id,
        state: 'healthy',
        reason: `Too young to evaluate (${ageMs}ms < ${this.config.minimumEvaluationAgeMs}ms)`,
        shouldTerminate: false,
      };
    }

    if (agent.evaluationCount < this.config.minimumSampleSize) {
      return {
        agentId: agent.id,
        state: 'watch',
        reason: `Insufficient samples (${agent.evaluationCount} < ${this.config.minimumSampleSize})`,
        shouldTerminate: false,
      };
    }

    if (agent.lastEvaluatedAt) {
      const since = this.now().getTime() - agent.lastEvaluatedAt.getTime();
      if (since < this.config.cooldownMs && agent.utility.score >= this.config.minimumUtility) {
        return {
          agentId: agent.id,
          state: 'healthy',
          reason: 'Within cooldown',
          shouldTerminate: false,
        };
      }
    }

    if (agent.utility.score < this.config.minimumUtility) {
      return {
        agentId: agent.id,
        state: 'candidate-for-termination',
        reason: `Utility ${agent.utility.score.toFixed(3)} below minimum ${this.config.minimumUtility}`,
        shouldTerminate: true,
      };
    }

    if (agent.utility.score < this.config.minimumUtility + 0.15) {
      return {
        agentId: agent.id,
        state: 'watch',
        reason: 'Utility near threshold',
        shouldTerminate: false,
      };
    }

    return {
      agentId: agent.id,
      state: 'healthy',
      reason: 'Utility healthy',
      shouldTerminate: false,
    };
  }
}
