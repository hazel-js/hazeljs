/**
 * Phase 3 — constrained, auditable mutation (no arbitrary source rewrite).
 */

import type {
  AgentGeneDefinition,
  AgentMutation,
  AgentMutationRecord,
  RuntimeAgentRecord,
} from '../types/organism.types';
import { OrganismLimitError, OrganismStateError } from '../errors/organism.errors';
import { OrganismEventEmitter, OrganismEventType } from '../events/organism-events';
import type { OrganismRepository } from '../persistence/organism-repository';

export interface MutationRequest {
  reason: string;
  mutation: AgentMutation;
}

const DEFAULT_ALLOWED = [
  'promptChanges',
  'addedCapabilities',
  'removedCapabilities',
  'modelConfig',
  'strategyConfig',
];

export class MutationEngine {
  constructor(
    private readonly events: OrganismEventEmitter,
    private readonly repo: OrganismRepository,
    private readonly organismId: string,
    private readonly now: () => Date = () => new Date()
  ) {}

  assertAllowed(gene: AgentGeneDefinition, mutation: AgentMutation): void {
    if (gene.mutation && gene.mutation.enabled === false) {
      throw new OrganismLimitError(`Gene ${gene.id} has mutation disabled`);
    }
    const allowed = new Set(gene.mutation?.allowedProperties ?? DEFAULT_ALLOWED);
    for (const key of Object.keys(mutation) as Array<keyof AgentMutation>) {
      if (mutation[key] !== undefined && !allowed.has(key)) {
        throw new OrganismLimitError(
          `Mutation property "${key}" is not allowed for gene ${gene.id}`
        );
      }
    }
  }

  apply(
    agent: RuntimeAgentRecord,
    request: MutationRequest,
    gene: AgentGeneDefinition
  ): RuntimeAgentRecord {
    if (agent.status === 'terminated' || agent.status === 'failed') {
      throw new OrganismStateError(`Cannot mutate agent ${agent.id} in status ${agent.status}`);
    }
    this.assertAllowed(gene, request.mutation);

    const m = request.mutation;
    if (m.promptChanges?.length) {
      const appendix = m.promptChanges.map((c) => `- ${c}`).join('\n');
      agent.systemPrompt = `${agent.systemPrompt ?? ''}\n## Mutation\n${appendix}`.trim();
    }
    if (m.addedCapabilities?.length) {
      agent.capabilities = Array.from(new Set([...agent.capabilities, ...m.addedCapabilities]));
    }
    if (m.removedCapabilities?.length) {
      const remove = new Set(m.removedCapabilities.map((c) => c.toLowerCase()));
      agent.capabilities = agent.capabilities.filter((c) => !remove.has(c.toLowerCase()));
    }
    if (m.modelConfig) {
      agent.modelConfig = { ...agent.modelConfig, ...m.modelConfig };
    }
    if (m.strategyConfig) {
      agent.strategyConfig = { ...agent.strategyConfig, ...m.strategyConfig };
    }

    const resultingStrategyId = `${agent.strategyId ?? agent.geneId}:m${agent.mutations.length + 1}`;
    const record: AgentMutationRecord = {
      id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      at: this.now(),
      mutation: { ...m },
      reason: request.reason,
      parentStrategyId: agent.strategyId,
      resultingStrategyId,
    };
    agent.mutations = [...agent.mutations, record];
    agent.strategyId = resultingStrategyId;
    agent.lastMutationAt = record.at;

    return agent;
  }

  async mutate(
    agent: RuntimeAgentRecord,
    request: MutationRequest,
    gene: AgentGeneDefinition
  ): Promise<RuntimeAgentRecord> {
    const updated = this.apply({ ...agent, mutations: [...agent.mutations] }, request, gene);
    await this.repo.saveAgent(this.organismId, updated);
    await this.events.emit(OrganismEventType.ORGANISM_AGENT_MUTATED, this.organismId, {
      agentId: updated.id,
      reason: request.reason,
      mutation: request.mutation,
      strategyId: updated.strategyId,
    });
    return updated;
  }
}
