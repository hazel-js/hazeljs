/**
 * Ecommerce organism simulation demo (Phase 1).
 *
 * Run: npx ts-node --transpile-only examples/ecommerce-organism/run.ts
 * (from packages/organism after build, or via jest-integrated path)
 */

import {
  AgentGene,
  Constitution,
  Environment,
  Mission,
  createOrganism,
  resetAgentSeqForTests,
  type EnvironmentSignal,
} from '../../src';

@Mission({
  id: 'ecommerce-ops',
  objective: 'Run a simulated ecommerce store support and operations function',
  successCriteria: [
    { name: 'csat', operator: 'gte', target: 90 },
    { name: 'refund_rate', operator: 'lte', target: 0.05 },
  ],
  constraints: ['Never expose customer PII', 'Remain within operating budget'],
})
class EcommerceMission {}

@Constitution({
  id: 'commerce-constitution',
  rules: [
    {
      id: 'privacy',
      rule: 'Never expose customer personally identifiable information',
      severity: 'critical',
    },
    {
      id: 'refund-limit',
      rule: 'Refunds above $200 require human approval',
      severity: 'high',
    },
    {
      id: 'budget',
      rule: 'Never exceed allocated operational budget',
      severity: 'critical',
    },
  ],
})
class EcommerceConstitution {}

@Environment({ id: 'ecommerce-environment' })
class EcommerceEnvironment {}

@AgentGene({
  id: 'commerce-generalist',
  capabilities: ['commerce', 'customer-support', 'operations'],
  initialPrompt: 'You are a commerce generalist agent.',
  reproduction: { enabled: true },
  mutation: { enabled: true },
})
class CommerceGene {}

@AgentGene({
  id: 'analysis-gene',
  capabilities: ['analytics', 'analysis'],
  initialPrompt: 'You analyze operational metrics.',
})
class AnalysisGene {}

@AgentGene({
  id: 'research-gene',
  capabilities: ['research'],
  initialPrompt: 'You research product and market issues.',
})
class ResearchGene {}

@AgentGene({
  id: 'support-gene',
  capabilities: ['customer-support'],
  initialPrompt: 'You handle customer support.',
})
class SupportGene {}

const SIGNAL_MAPPINGS = [
  {
    signalType: 'refunds.increased',
    need: 'refund-analysis',
    requiredCapabilities: ['analytics', 'commerce'],
    urgency: 0.88,
    confidence: 0.93,
  },
  {
    signalType: 'support.volume_spike',
    need: 'support-surge',
    requiredCapabilities: ['customer-support'],
    urgency: 0.7,
    confidence: 0.85,
  },
  {
    signalType: 'inventory.low',
    need: 'inventory-ops',
    requiredCapabilities: ['commerce', 'operations'],
    urgency: 0.75,
    confidence: 0.8,
  },
  {
    signalType: 'checkout.failure_rate',
    need: 'checkout-recovery',
    requiredCapabilities: ['commerce', 'operations'],
    urgency: 0.9,
    confidence: 0.9,
  },
];

export async function runEcommerceOrganismDemo(opts: {
  log?: (line: string) => void;
} = {}): Promise<void> {
  resetAgentSeqForTests();
  const log = opts.log ?? ((line: string) => console.log(line));

  const organism = await createOrganism({
    mission: EcommerceMission,
    constitution: EcommerceConstitution,
    environment: EcommerceEnvironment,
    genes: [CommerceGene, AnalysisGene, ResearchGene, SupportGene],
    resources: {
      tokenBudget: 500_000,
      monthlyBudget: { amount: 500, currency: 'USD' },
    },
    limits: {
      maxAgents: 10,
      maxGenerationDepth: 3,
      maxChildrenPerAgent: 3,
      maxSpawnRatePerMinute: 10,
      maxTotalCostPerHour: 50,
    },
    signalNeedMappings: SIGNAL_MAPPINGS,
    survival: {
      minimumUtility: 0.25,
      minimumEvaluationAgeMs: 1,
      minimumSampleSize: 2,
      cooldownMs: 0,
    },
    debug: true,
    simulation: true,
  });

  // Route logs
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    log(args.map(String).join(' '));
  };

  try {
    await organism.start();

    // Day 1 — normal complaint (may spawn support if needed)
    await organism.observe({
      type: 'customer.complaint',
      source: 'support',
      severity: 0.4,
      relevance: 0.5,
      data: { topic: 'shipping delay' },
    });

    // Day 3 — refund spike → need refund-analysis → birth
    await organism.observe({
      type: 'refunds.increased',
      source: 'analytics',
      severity: 0.9,
      relevance: 0.95,
      data: { baseline: 0.041, current: 0.073 },
    } as Partial<EnvironmentSignal> & Pick<EnvironmentSignal, 'type' | 'source'>);

    const agents = await organism.listAgents();
    const refundAgent = agents.find((a) =>
      a.capabilities.map((c) => c.toLowerCase()).includes('analytics')
    );

    if (refundAgent) {
      await organism.reportOutcome(refundAgent.id, {
        result: '68% of returns linked to sizing confusion',
        metrics: { valueGenerated: 250, confidence: 0.91, cost: 2 },
        evidence: ['68% of refund complaints mention incorrect sizing'],
        missionMetricUpdates: { refund_rate: 0.048, csat: 91 },
      });

      const sizingAgent = await organism.reproduceAgent(refundAgent.id, {
        reason: 'Need sizing research specialization',
        specialization: ['sizing', 'product-research'],
        objective: 'Research sizing guide issues and recommend changes',
        tokens: 25_000,
      });
      log(
        `[REPRODUCTION] ${sizingAgent.name}#${sizingAgent.id} born parent: ${refundAgent.name}#${refundAgent.id} generation: ${sizingAgent.generation}`
      );

      await organism.reportOutcome(sizingAgent.id, {
        result: 'Size guide experiment proposed',
        metrics: { valueGenerated: 400, confidence: 0.88, cost: 3 },
        missionMetricUpdates: { refund_rate: 0.048, csat: 91 },
      });

      // After mission improves, low-utility agents are released
      await organism.reportOutcome(refundAgent.id, {
        result: 'No further refund anomalies',
        metrics: { valueGenerated: 0, confidence: 0.4, cost: 5 },
      });
      await organism.reportOutcome(refundAgent.id, {
        result: 'Idle',
        metrics: { valueGenerated: 0, confidence: 0.3, cost: 5 },
      });
      await organism.reportOutcome(sizingAgent.id, {
        result: 'No active work',
        metrics: { valueGenerated: 0, confidence: 0.3, cost: 4 },
      });
      await organism.reportOutcome(sizingAgent.id, {
        result: 'Idle',
        metrics: { valueGenerated: 0, confidence: 0.2, cost: 4 },
      });

      organism.clock.useAccelerated(Date.now());
      organism.clock.advance(120_000);
      await organism.runSurvivalCycle();

      const tree = await organism.formatGenealogy();
      log(`[GENEALOGY]\n${tree}`);
    }

    const state = await organism.inspect();
    log(`[INSPECT] status=${state.status} agents=${state.agents.length}`);
    await organism.terminate();
  } finally {
    console.log = originalLog;
  }
}

if (require.main === module) {
  runEcommerceOrganismDemo().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
