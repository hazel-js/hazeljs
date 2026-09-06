/**
 * Phase 3 — generation evaluation and strategy promotion.
 */

import type {
  EvolutionaryHistoryEntry,
  GenerationEvaluationResult,
  GenerationMemberScore,
  RuntimeAgentRecord,
  UtilityWeights,
} from '../types/organism.types';
import { DEFAULT_UTILITY_WEIGHTS } from '../types/organism.types';
import { OrganismEventEmitter, OrganismEventType } from '../events/organism-events';
import type { OrganismRepository } from '../persistence/organism-repository';
import { MutationEngine, type MutationRequest } from './mutation-engine';
import type { AgentGeneDefinition } from '../types/organism.types';

export class GenerationManager {
  private history: EvolutionaryHistoryEntry[] = [];
  private populations = new Map<string, string[]>();

  registerPopulation(populationId: string, agentIds: string[]): void {
    this.populations.set(populationId, [...agentIds]);
  }

  getPopulation(populationId: string): string[] {
    return [...(this.populations.get(populationId) ?? [])];
  }

  record(entry: EvolutionaryHistoryEntry): void {
    this.history.push(entry);
    if (this.history.length > 200) {
      this.history.splice(0, this.history.length - 200);
    }
  }

  getHistory(limit = 50): EvolutionaryHistoryEntry[] {
    return this.history.slice(-limit);
  }
}

export class EvolutionEngine {
  constructor(
    private readonly events: OrganismEventEmitter,
    private readonly repo: OrganismRepository,
    private readonly generations: GenerationManager,
    private readonly mutationEngine: MutationEngine,
    private readonly organismId: string,
    private readonly weights: UtilityWeights = DEFAULT_UTILITY_WEIGHTS,
    private readonly now: () => Date = () => new Date()
  ) {}

  scoreAgent(agent: RuntimeAgentRecord): number {
    const missionContribution = clamp(agent.utility.score, 0, 1);
    const reliability = agent.reputation.dimensions.reliability;
    const efficiency = agent.reputation.dimensions.efficiency;
    const policyCompliance = agent.reputation.dimensions.policyCompliance;
    const collaboration = agent.reputation.dimensions.collaboration;
    return (
      missionContribution * this.weights.missionContribution +
      reliability * this.weights.reliability +
      efficiency * this.weights.efficiency +
      policyCompliance * this.weights.policyCompliance +
      collaboration * this.weights.collaboration
    );
  }

  async evaluateGeneration(input: {
    population: string[];
    populationId?: string;
  }): Promise<GenerationEvaluationResult> {
    const populationId = input.populationId ?? `pop_${Date.now().toString(36)}`;
    this.generations.registerPopulation(populationId, input.population);

    const members: GenerationMemberScore[] = [];
    const scores: Record<string, number> = {};

    for (const agentId of input.population) {
      const agent = await this.repo.getAgent(this.organismId, agentId);
      if (!agent || agent.status === 'terminated') continue;
      const score = this.scoreAgent(agent);
      scores[agentId] = score;
      members.push({
        agentId,
        score,
        utility: agent.utility.score,
        reputation: agent.reputation.score,
        cost: agent.costConsumed,
        policyCompliance: agent.reputation.dimensions.policyCompliance,
      });
    }

    if (!members.length) {
      return {
        populationId,
        winner: input.population[0] ?? '',
        scores,
        members,
      };
    }

    members.sort((a, b) => b.score - a.score);
    const winner = members[0].agentId;
    const winnerAgent = await this.repo.getAgent(this.organismId, winner);
    const promotedStrategyId = winnerAgent?.strategyId;

    const result: GenerationEvaluationResult = {
      populationId,
      winner,
      scores,
      members,
      promotedStrategyId,
    };

    this.generations.record({
      at: this.now(),
      populationId,
      winnerAgentId: winner,
      scores: { ...scores },
      promotedStrategyId,
    });

    await this.events.emit(OrganismEventType.ORGANISM_GENERATION_CREATED, this.organismId, {
      populationId,
      population: input.population,
    });
    await this.events.emit(OrganismEventType.ORGANISM_STRATEGY_PROMOTED, this.organismId, {
      winner,
      promotedStrategyId,
      scores,
      populationId,
    });

    return result;
  }

  /**
   * Promote winner strategy into a loser via controlled mutation (safe config only).
   */
  async promoteStrategy(input: {
    winnerId: string;
    targetId: string;
    gene: AgentGeneDefinition;
    reason?: string;
  }): Promise<RuntimeAgentRecord> {
    const winner = await this.repo.getAgent(this.organismId, input.winnerId);
    const target = await this.repo.getAgent(this.organismId, input.targetId);
    if (!winner || !target) {
      throw new Error('Winner or target agent not found');
    }

    const request: MutationRequest = {
      reason: input.reason ?? `Promote strategy from ${winner.id}`,
      mutation: {
        strategyConfig: { ...winner.strategyConfig, promotedFrom: winner.id },
        modelConfig: { ...winner.modelConfig },
        promptChanges: [`Adopt winning strategy patterns from ${winner.name}#${winner.id}`],
      },
    };

    return this.mutationEngine.mutate(target, request, input.gene);
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
