/**
 * Phase 2 — parent→child reproduction with explicit inheritance policy.
 */

import type {
  AgentBirthProposal,
  AgentGeneDefinition,
  AgentResourceWallet,
  InheritancePolicy,
  OrganismLimits,
  ReproduceRequest,
  RuntimeAgentRecord,
} from '../types/organism.types';
import { DEFAULT_INHERITANCE_POLICY } from '../types/organism.types';
import { OrganismLimitError, OrganismStateError } from '../errors/organism.errors';
import { OrganismEventEmitter, OrganismEventType } from '../events/organism-events';
import type { OrganismRepository } from '../persistence/organism-repository';
import { ConstitutionEnforcer } from '../governance/constitution';
import { BirthEngine } from '../lifecycle/birth-engine';
import { GenealogyManager } from '../genealogy/genealogy-manager';

export interface ReproductionConfig {
  cooldownMs: number;
}

export const DEFAULT_REPRODUCTION_CONFIG: ReproductionConfig = {
  cooldownMs: 30_000,
};

export class ReproductionEngine {
  constructor(
    private readonly events: OrganismEventEmitter,
    private readonly repo: OrganismRepository,
    private readonly birth: BirthEngine,
    private readonly genealogy: GenealogyManager,
    private readonly constitution: ConstitutionEnforcer,
    private readonly organismId: string,
    private readonly now: () => Date = () => new Date(),
    private readonly config: ReproductionConfig = DEFAULT_REPRODUCTION_CONFIG
  ) {}

  resolveInheritance(partial?: InheritancePolicy): InheritancePolicy {
    return {
      ...DEFAULT_INHERITANCE_POLICY,
      ...partial,
      memory: {
        strategy:
          partial?.memory?.strategy ??
          DEFAULT_INHERITANCE_POLICY.memory?.strategy ??
          'relevant-only',
        maxItems: partial?.memory?.maxItems ?? DEFAULT_INHERITANCE_POLICY.memory?.maxItems,
      },
      resources: {
        transferFraction:
          partial?.resources?.transferFraction ??
          DEFAULT_INHERITANCE_POLICY.resources?.transferFraction,
      },
    };
  }

  assertCanReproduce(input: {
    parent: RuntimeAgentRecord;
    gene: AgentGeneDefinition;
    limits: OrganismLimits;
    liveAgents: RuntimeAgentRecord[];
    liveChildCount: number;
  }): void {
    const { parent, gene, limits, liveAgents, liveChildCount } = input;

    if (parent.status === 'terminated' || parent.status === 'failed') {
      throw new OrganismStateError(`Parent ${parent.id} is not active`);
    }
    if (gene.reproduction && gene.reproduction.enabled === false) {
      throw new OrganismLimitError(`Gene ${gene.id} has reproduction disabled`);
    }
    if (parent.generation >= limits.maxGenerationDepth) {
      throw new OrganismLimitError(
        `maxGenerationDepth (${limits.maxGenerationDepth}) reached by parent`
      );
    }
    const geneMax = gene.reproduction?.maxChildren;
    const maxChildren =
      geneMax != null ? Math.min(geneMax, limits.maxChildrenPerAgent) : limits.maxChildrenPerAgent;
    if (liveChildCount >= maxChildren) {
      throw new OrganismLimitError(
        `maxChildrenPerAgent (${maxChildren}) reached for parent ${parent.id}`
      );
    }
    if (liveAgents.length >= limits.maxAgents) {
      throw new OrganismLimitError(`maxAgents (${limits.maxAgents}) reached`);
    }
    if (parent.lastReproductionAt) {
      const elapsed = this.now().getTime() - parent.lastReproductionAt.getTime();
      if (elapsed < this.config.cooldownMs) {
        throw new OrganismLimitError(
          `Reproduction cooldown active (${elapsed}ms < ${this.config.cooldownMs}ms)`
        );
      }
    }
  }

  /**
   * Build child capabilities: parent caps + specialization.
   * Permissions must remain a subset of the parent's permission grants.
   */
  resolveChildCapabilities(
    parent: RuntimeAgentRecord,
    specialization: string[],
    policy: InheritancePolicy
  ): { capabilities: string[]; permissions: string[] } {
    const capabilities = Array.from(new Set([...parent.capabilities, ...specialization]));
    let permissions: string[];
    if (policy.permissions === 'none') {
      permissions = [];
    } else {
      // copy and subset both enforce ⊆ parent (never escalate)
      permissions = [...parent.permissions];
    }
    return { capabilities, permissions };
  }

  transferResources(
    parent: RuntimeAgentRecord,
    policy: InheritancePolicy,
    requestedTokens?: number
  ): { childWallet: AgentResourceWallet; parentWallet: AgentResourceWallet } {
    const fraction = policy.resources?.transferFraction ?? 0.25;
    const parentTokens = parent.wallet.tokensRemaining ?? 0;
    const parentMoney = parent.wallet.moneyRemaining?.amount ?? 0;
    const currency = parent.wallet.moneyRemaining?.currency ?? 'USD';

    let tokens = Math.floor(parentTokens * fraction);
    if (requestedTokens != null) {
      tokens = Math.min(tokens, requestedTokens, parentTokens);
    }
    const money = Math.floor(parentMoney * fraction);

    const childWallet: AgentResourceWallet = {
      tokensRemaining: tokens,
      moneyRemaining: { amount: money, currency },
      computeUnitsRemaining: Math.floor((parent.wallet.computeUnitsRemaining ?? 0) * fraction),
      toolCallsRemaining: Math.floor((parent.wallet.toolCallsRemaining ?? 0) * fraction),
    };

    const parentWallet: AgentResourceWallet = {
      tokensRemaining: parentTokens - tokens,
      moneyRemaining: { amount: parentMoney - money, currency },
      computeUnitsRemaining:
        (parent.wallet.computeUnitsRemaining ?? 0) - (childWallet.computeUnitsRemaining ?? 0),
      toolCallsRemaining:
        (parent.wallet.toolCallsRemaining ?? 0) - (childWallet.toolCallsRemaining ?? 0),
    };

    return { childWallet, parentWallet };
  }

  buildProposal(
    parent: RuntimeAgentRecord,
    request: ReproduceRequest,
    capabilities: string[]
  ): AgentBirthProposal {
    const specialization = request.specialization ?? [];
    const needId = request.needId ?? `specialize-${specialization.join('-') || parent.id}`;
    return {
      reason: request.reason,
      needId,
      requiredCapabilities: capabilities,
      expectedOutcome:
        request.objective ??
        `Specialized descendant of ${parent.name} for ${specialization.join(', ') || 'focused work'}`,
      estimatedCost: 1,
      expectedUtility: parent.utility.score,
      terminationCriteria: request.terminationCriteria ?? [
        `Specialization ${specialization.join(', ') || needId} complete`,
        'Utility score below 0.2 after 5 evaluations',
        'No related tasks for evaluation window',
      ],
      confidence: request.confidence ?? 0.8,
      geneId: parent.geneId,
      specialize: specialization,
      parentAgentId: parent.id,
    };
  }

  async reproduce(input: {
    parent: RuntimeAgentRecord;
    gene: AgentGeneDefinition;
    request: ReproduceRequest;
    limits: OrganismLimits;
    liveAgents: RuntimeAgentRecord[];
    /** When true, child wallet comes from organism pool allocation instead of parent. */
    poolWallet?: AgentResourceWallet;
  }): Promise<{ child: RuntimeAgentRecord; parent: RuntimeAgentRecord }> {
    const policy = this.resolveInheritance(input.request.inheritance);
    const liveChildCount = await this.genealogy.countLiveChildren(
      input.parent.id,
      input.liveAgents
    );
    this.assertCanReproduce({
      parent: input.parent,
      gene: input.gene,
      limits: input.limits,
      liveAgents: input.liveAgents,
      liveChildCount,
    });

    this.constitution.assertAllows('reproduce', {});

    const specialization = input.request.specialization ?? [];
    const { capabilities, permissions } = this.resolveChildCapabilities(
      input.parent,
      specialization,
      policy
    );

    let childWallet: AgentResourceWallet;
    let parentWallet = input.parent.wallet;
    if (input.poolWallet) {
      childWallet = input.poolWallet;
    } else {
      const transfer = this.transferResources(input.parent, policy, input.request.tokens);
      childWallet = transfer.childWallet;
      parentWallet = transfer.parentWallet;
    }

    const proposal = this.buildProposal(input.parent, input.request, capabilities);
    const generation = input.parent.generation + 1;

    input.parent.status = 'reproducing';
    await this.repo.saveAgent(this.organismId, input.parent);

    const child = await this.birth.spawn({
      proposal,
      gene: input.gene,
      wallet: childWallet,
      generation,
      parentAgentId: input.parent.id,
      nameHint: specialization.length
        ? `${specialization
            .map((s) =>
              s
                .split(/[-_]/)
                .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                .join('')
            )
            .join('')}Agent`
        : `${input.parent.name}Child`,
    });

    // Apply inheritance overlays
    child.permissions = permissions;
    child.systemPrompt =
      policy.strategies !== false
        ? [
            input.parent.systemPrompt ?? input.gene.initialPrompt ?? '',
            specialization.length ? `Specialization: ${specialization.join(', ')}` : '',
          ]
            .filter(Boolean)
            .join('\n')
        : input.gene.initialPrompt;
    if (policy.strategies !== false) {
      child.strategyConfig = { ...input.parent.strategyConfig };
    }
    if (policy.modelSettings !== false) {
      child.modelConfig = { ...input.parent.modelConfig };
    }
    child.strategyId = input.parent.strategyId
      ? `${input.parent.strategyId}:g${generation}`
      : `${input.parent.geneId}:g${generation}`;

    await this.repo.saveAgent(this.organismId, child);

    input.parent.wallet = parentWallet;
    input.parent.status = 'active';
    input.parent.lastReproductionAt = this.now();
    await this.repo.saveAgent(this.organismId, input.parent);

    await this.events.emit(OrganismEventType.ORGANISM_AGENT_REPRODUCED, this.organismId, {
      parentAgentId: input.parent.id,
      childAgentId: child.id,
      generation,
      specialization,
      reason: input.request.reason,
      inheritance: policy,
    });

    return { child, parent: input.parent };
  }
}
