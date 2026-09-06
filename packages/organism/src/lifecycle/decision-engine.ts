import type {
  AgentBirthProposal,
  DetectedNeed,
  OrganismDecision,
  RuntimeAgentRecord,
} from '../types/organism.types';
import { CapabilityRegistry } from '../core/capability-registry';
import type { AgentGeneDefinition } from '../types/organism.types';

/**
 * Deterministic decision engine: reuse → specialize → spawn → observe.
 */
export class DecisionEngine {
  constructor(private readonly capabilities: CapabilityRegistry) {}

  decide(input: {
    need: DetectedNeed;
    liveAgents: RuntimeAgentRecord[];
    genes: AgentGeneDefinition[];
    canSpawn: boolean;
    spawnBlockReason?: string;
  }): OrganismDecision {
    const { need, liveAgents, genes, canSpawn, spawnBlockReason } = input;

    const capable = this.capabilities.findCapableAgents(need.requiredCapabilities, liveAgents);
    if (capable.length > 0) {
      const best = capable.sort((a, b) => b.reputation.score - a.reputation.score)[0];
      return {
        action: 'delegate',
        reasoningSummary: `Capable agent ${best.id} already covers ${need.requiredCapabilities.join(', ')}`,
        confidence: Math.min(0.95, need.confidence + 0.05),
        targetAgentId: best.id,
        requiredCapabilities: need.requiredCapabilities,
        needId: need.need,
      };
    }

    const partial = this.capabilities.findPartialAgents(need.requiredCapabilities, liveAgents);
    const gene = this.selectGene(need.requiredCapabilities, genes);

    if (partial.length > 0 && gene) {
      const parent = partial[0];
      const missing = need.requiredCapabilities.filter(
        (c) => !parent.capabilities.map((x) => x.toLowerCase()).includes(c.toLowerCase())
      );
      if (!canSpawn) {
        return {
          action: 'observe',
          reasoningSummary: `Would specialize for ${need.need} but spawn blocked: ${spawnBlockReason}`,
          confidence: 0.4,
          needId: need.need,
        };
      }
      const proposal: AgentBirthProposal = {
        reason: need.reason,
        needId: need.need,
        requiredCapabilities: need.requiredCapabilities,
        expectedOutcome: `Address need ${need.need}`,
        estimatedCost: 1,
        expectedUtility: need.urgency,
        terminationCriteria: [
          `Need ${need.need} resolved`,
          'Utility score below 0.2 after 5 evaluations',
          'No related tasks for evaluation window',
        ],
        confidence: need.confidence,
        geneId: gene.id,
        specialize: missing,
        parentAgentId: parent.id,
      };
      return {
        action: 'specialize',
        reasoningSummary: `Partial agent ${parent.id} exists; spawn specialized agent for missing ${missing.join(', ')}`,
        confidence: need.confidence,
        targetAgentId: parent.id,
        requiredCapabilities: need.requiredCapabilities,
        resourceRequest: { tokens: 50_000 },
        birthProposal: proposal,
        needId: need.need,
      };
    }

    if (!gene) {
      return {
        action: 'observe',
        reasoningSummary: `No gene covers required capabilities ${need.requiredCapabilities.join(', ')}`,
        confidence: 0.5,
        requiredCapabilities: need.requiredCapabilities,
        needId: need.need,
      };
    }

    if (!canSpawn) {
      return {
        action: 'observe',
        reasoningSummary: `Need ${need.need} requires spawn but blocked: ${spawnBlockReason}`,
        confidence: 0.4,
        needId: need.need,
      };
    }

    const proposal: AgentBirthProposal = {
      reason: need.reason,
      needId: need.need,
      requiredCapabilities: need.requiredCapabilities,
      expectedOutcome: `Address need ${need.need}`,
      estimatedCost: 1,
      expectedUtility: need.urgency,
      terminationCriteria: [
        `Need ${need.need} resolved`,
        'Utility score below 0.2 after 5 evaluations',
        'No related tasks for evaluation window',
      ],
      confidence: need.confidence,
      geneId: gene.id,
      specialize: need.requiredCapabilities.filter(
        (c) => !gene.capabilities.map((g) => g.toLowerCase()).includes(c.toLowerCase())
      ),
    };

    return {
      action: 'spawn',
      reasoningSummary: `No capable agent for ${need.need}; spawning from gene ${gene.id}`,
      confidence: need.confidence,
      requiredCapabilities: need.requiredCapabilities,
      resourceRequest: { tokens: 50_000 },
      birthProposal: proposal,
      needId: need.need,
    };
  }

  selectGene(required: string[], genes: AgentGeneDefinition[]): AgentGeneDefinition | undefined {
    if (!genes.length) return undefined;
    const needed = required.map((c) => c.toLowerCase());
    let best: AgentGeneDefinition | undefined;
    let bestScore = -1;
    let bestRatio = -1;
    let bestPrimaryHit = false;
    const primary = needed[0];
    for (const gene of genes) {
      const caps = new Set(gene.capabilities.map((c) => c.toLowerCase()));
      const score = needed.filter((n) => caps.has(n)).length;
      const ratio = score / Math.max(1, gene.capabilities.length);
      const primaryHit = primary ? caps.has(primary) : false;
      const better =
        score > bestScore ||
        (score === bestScore && ratio > bestRatio) ||
        (score === bestScore && ratio === bestRatio && primaryHit && !bestPrimaryHit);
      if (better) {
        bestScore = score;
        bestRatio = ratio;
        bestPrimaryHit = primaryHit;
        best = gene;
      }
    }
    return best ?? genes[0];
  }
}
