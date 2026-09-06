import { createAgentClassFromDna, exportAgentDna, type AgentRuntime } from '@hazeljs/agent';
import type {
  AgentBirthProposal,
  AgentGeneDefinition,
  AgentGenealogy,
  AgentReputation,
  RuntimeAgentRecord,
  UtilityScore,
} from '../types/organism.types';
import { createEmptyWallet } from '../economy/resource-allocator';
import { OrganismEventEmitter, OrganismEventType } from '../events/organism-events';
import type { OrganismRepository } from '../persistence/organism-repository';
import { CapabilityRegistry } from '../core/capability-registry';
import type { AgentResourceWallet } from '../types/organism.types';

let agentSeq = 0;

function nextAgentId(): string {
  agentSeq += 1;
  return `A${agentSeq}`;
}

export function resetAgentSeqForTests(): void {
  agentSeq = 0;
}

function defaultReputation(agentId: string): AgentReputation {
  return {
    agentId,
    score: 0.5,
    dimensions: {
      usefulness: 0.5,
      reliability: 0.5,
      efficiency: 0.5,
      policyCompliance: 1,
      collaboration: 0.5,
    },
  };
}

function defaultUtility(): UtilityScore {
  return {
    score: 0.5,
    valueGenerated: 0,
    cost: 0,
    riskPenalty: 0,
    confidence: 0.5,
  };
}

/**
 * Birth engine — compiles gene + proposal into DNA and registers with AgentRuntime.
 */
export class BirthEngine {
  constructor(
    private readonly events: OrganismEventEmitter,
    private readonly repo: OrganismRepository,
    private readonly capabilities: CapabilityRegistry,
    private readonly organismId: string,
    private readonly agentRuntime?: AgentRuntime
  ) {}

  async spawn(input: {
    proposal: AgentBirthProposal;
    gene: AgentGeneDefinition;
    wallet: AgentResourceWallet;
    generation?: number;
    parentAgentId?: string;
    nameHint?: string;
  }): Promise<RuntimeAgentRecord> {
    const id = nextAgentId();
    const generation = input.generation ?? 1;
    const specialize = input.proposal.specialize ?? [];
    const capabilities = Array.from(
      new Set([...input.gene.capabilities, ...specialize, ...input.proposal.requiredCapabilities])
    );
    const nameHint =
      input.nameHint ??
      `${input.proposal.needId
        .split(/[-_]/)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join('')}Agent`;
    const dnaAgentName = `${nameHint}_${id}`;
    const objective = input.proposal.expectedOutcome;

    const dna = exportAgentDna({
      name: dnaAgentName,
      description: input.gene.description ?? input.proposal.reason,
      systemPrompt:
        input.gene.initialPrompt ??
        `You are ${dnaAgentName}. Objective: ${objective}. Capabilities: ${capabilities.join(', ')}.`,
      tools: [],
      policies: input.gene.policies,
      mission: { goal: objective },
      metadata: {
        capabilities,
        organismId: this.organismId,
        geneId: input.gene.id,
        needId: input.proposal.needId,
        terminationCriteria: input.proposal.terminationCriteria,
      },
      version: '1.0.0',
    });

    if (this.agentRuntime) {
      const AgentClass = createAgentClassFromDna(dna);
      this.agentRuntime.registerAgent(AgentClass);
    }

    const agent: RuntimeAgentRecord = {
      id,
      name: nameHint,
      objective,
      capabilities,
      geneId: input.gene.id,
      parentAgentId: input.parentAgentId ?? input.proposal.parentAgentId,
      generation,
      status: 'active',
      reputation: defaultReputation(id),
      utility: defaultUtility(),
      wallet: { ...input.wallet },
      birthProposal: input.proposal,
      terminationCriteria: input.proposal.terminationCriteria ?? [],
      createdAt: new Date(),
      evaluationCount: 0,
      criticalResponsibility: false,
      costConsumed: 0,
      tokensConsumed: 0,
      valueGenerated: 0,
      specialize,
      dnaAgentName,
      systemPrompt: dna.systemPrompt,
      permissions: [...capabilities],
      strategyConfig: {},
      modelConfig: {},
      mutations: [],
      strategyId: `${input.gene.id}:g${generation}`,
    };

    const genealogy: AgentGenealogy = {
      agentId: id,
      parentAgentId: agent.parentAgentId,
      rootGeneId: input.gene.id,
      generation,
      children: [],
      createdAt: agent.createdAt,
    };

    await this.repo.saveAgent(this.organismId, agent);
    await this.repo.saveGenealogy(this.organismId, genealogy);

    if (agent.parentAgentId) {
      const parentGene = (await this.repo.listGenealogy(this.organismId)).find(
        (g) => g.agentId === agent.parentAgentId
      );
      if (parentGene) {
        parentGene.children = [...parentGene.children, id];
        await this.repo.saveGenealogy(this.organismId, parentGene);
      }
    }

    this.capabilities.register(id, capabilities);

    await this.events.emit(OrganismEventType.ORGANISM_AGENT_BORN, this.organismId, {
      organismId: this.organismId,
      agentId: id,
      parentAgentId: agent.parentAgentId,
      reason: input.proposal.reason,
      generation,
      geneId: input.gene.id,
      needId: input.proposal.needId,
      name: nameHint,
    });

    return agent;
  }
}

/**
 * Termination engine — release resources, retain genealogy, emit death event.
 */
export class TerminationEngine {
  constructor(
    private readonly events: OrganismEventEmitter,
    private readonly repo: OrganismRepository,
    private readonly capabilities: CapabilityRegistry,
    private readonly organismId: string,
    private readonly releaseWallet: (agent: RuntimeAgentRecord) => void
  ) {}

  async terminate(agentId: string, reason: string): Promise<RuntimeAgentRecord | undefined> {
    const agent = await this.repo.getAgent(this.organismId, agentId);
    if (!agent || agent.status === 'terminated') return agent;

    agent.status = 'termination-pending';
    await this.repo.saveAgent(this.organismId, agent);

    this.releaseWallet(agent);
    this.capabilities.unregister(agentId);

    agent.status = 'terminated';
    agent.terminatedAt = new Date();
    await this.repo.saveAgent(this.organismId, agent);

    const genealogy = (await this.repo.listGenealogy(this.organismId)).find(
      (g) => g.agentId === agentId
    );
    if (genealogy) {
      genealogy.terminatedAt = agent.terminatedAt;
      await this.repo.saveGenealogy(this.organismId, genealogy);
    }

    await this.events.emit(OrganismEventType.ORGANISM_AGENT_TERMINATED, this.organismId, {
      agentId,
      reason,
      finalScore: agent.utility.score,
      totalCost: agent.costConsumed,
      totalValue: agent.valueGenerated,
    });

    return agent;
  }
}

export { createEmptyWallet };
