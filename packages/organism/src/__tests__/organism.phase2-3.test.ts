import {
  createOrganism,
  resetAgentSeqForTests,
  OrganismLimitError,
  DEFAULT_INHERITANCE_POLICY,
} from '../index';

async function createOrg(overrides: Record<string, unknown> = {}) {
  return createOrganism({
    mission: {
      id: 'm',
      objective: 'Operate with adaptive specialists',
    },
    genes: [
      {
        id: 'commerce-generalist',
        capabilities: ['commerce', 'customer-support', 'analytics'],
        reproduction: { enabled: true, maxChildren: 3 },
        mutation: { enabled: true },
        initialPrompt: 'You are a commerce generalist.',
      },
      {
        id: 'no-repro',
        capabilities: ['research'],
        reproduction: { enabled: false },
        mutation: { enabled: false },
      },
    ],
    resources: {
      tokenBudget: 500_000,
      monthlyBudget: { amount: 200, currency: 'USD' },
    },
    limits: {
      maxAgents: 10,
      maxGenerationDepth: 3,
      maxChildrenPerAgent: 2,
      maxSpawnRatePerMinute: 20,
      maxTotalCostPerHour: 50,
    },
    reproduction: { cooldownMs: 0 },
    simulation: true,
    debug: false,
    ...overrides,
  });
}

describe('phase 2 reproduction', () => {
  beforeEach(() => {
    resetAgentSeqForTests();
  });

  it('reproduces a specialized child with parent lineage', async () => {
    const organism = await createOrg();
    await organism.start();
    const parent = await organism.spawnAgent({
      reason: 'seed',
      objective: 'Handle commerce',
      needId: 'commerce',
      requiredCapabilities: ['commerce', 'analytics'],
      geneId: 'commerce-generalist',
      tokens: 100_000,
    });

    const child = await organism.reproduceAgent(parent.id, {
      reason: 'Need Swedish VAT expertise',
      specialization: ['swedish-tax', 'vat'],
      tokens: 20_000,
    });

    expect(child.parentAgentId).toBe(parent.id);
    expect(child.generation).toBe(2);
    expect(child.capabilities).toEqual(
      expect.arrayContaining(['commerce', 'analytics', 'swedish-tax', 'vat'])
    );
    expect(child.permissions.every((p) => parent.permissions.includes(p))).toBe(true);

    const tree = await organism.formatGenealogy();
    expect(tree).toContain(parent.id);
    expect(tree).toContain(child.id);

    const gene = await organism.getGenealogy();
    const parentGene = gene.find((g) => g.agentId === parent.id);
    expect(parentGene?.children).toContain(child.id);

    await organism.terminate();
  });

  it('enforces maxChildrenPerAgent', async () => {
    const organism = await createOrg({
      limits: {
        maxAgents: 10,
        maxGenerationDepth: 5,
        maxChildrenPerAgent: 1,
        maxSpawnRatePerMinute: 20,
        maxTotalCostPerHour: 50,
      },
    });
    await organism.start();
    const parent = await organism.spawnAgent({
      reason: 'seed',
      objective: 'parent',
      needId: 'p',
      requiredCapabilities: ['commerce'],
      geneId: 'commerce-generalist',
      tokens: 80_000,
    });
    await organism.reproduceAgent(parent.id, {
      reason: 'first child',
      specialization: ['returns'],
    });
    await expect(
      organism.reproduceAgent(parent.id, {
        reason: 'second child',
        specialization: ['vat'],
      })
    ).rejects.toThrow(/maxChildrenPerAgent/);
    await organism.terminate();
  });

  it('enforces maxGenerationDepth', async () => {
    const organism = await createOrg({
      limits: {
        maxAgents: 10,
        maxGenerationDepth: 2,
        maxChildrenPerAgent: 3,
        maxSpawnRatePerMinute: 20,
        maxTotalCostPerHour: 50,
      },
      reproduction: { cooldownMs: 0 },
    });
    await organism.start();
    const a1 = await organism.spawnAgent({
      reason: 'seed',
      objective: 'g1',
      needId: 'g1',
      requiredCapabilities: ['commerce'],
      geneId: 'commerce-generalist',
      tokens: 100_000,
    });
    const a2 = await organism.reproduceAgent(a1.id, {
      reason: 'g2',
      specialization: ['vat'],
    });
    await expect(
      organism.reproduceAgent(a2.id, {
        reason: 'g3',
        specialization: ['deep'],
      })
    ).rejects.toThrow(/maxGenerationDepth/);
    await organism.terminate();
  });

  it('blocks reproduction when gene disables it', async () => {
    const organism = await createOrg();
    await organism.start();
    const parent = await organism.spawnAgent({
      reason: 'seed',
      objective: 'research',
      needId: 'r',
      requiredCapabilities: ['research'],
      geneId: 'no-repro',
      tokens: 10_000,
    });
    await expect(
      organism.reproduceAgent(parent.id, { reason: 'should fail', specialization: ['x'] })
    ).rejects.toThrow(OrganismLimitError);
    await organism.terminate();
  });

  it('inherits resource fraction from parent wallet', async () => {
    const organism = await createOrg();
    await organism.start();
    const parent = await organism.spawnAgent({
      reason: 'seed',
      objective: 'commerce',
      needId: 'c',
      requiredCapabilities: ['commerce'],
      geneId: 'commerce-generalist',
      tokens: 100_000,
    });
    // Force parent-wallet transfer path (no request.tokens and parent has tokens)
    const child = await organism.reproduceAgent(parent.id, {
      reason: 'split budget',
      specialization: ['pricing'],
      inheritance: {
        ...DEFAULT_INHERITANCE_POLICY,
        resources: { transferFraction: 0.5 },
      },
    });
    const refreshedParent = (await organism.listAgents()).find((a) => a.id === parent.id)!;
    // When poolWallet is used because request.tokens undefined but we still may allocate...
    // Reproduce without tokens uses parent transfer when parentTokens > 0 and !request.tokens
    expect(child.wallet.tokensRemaining ?? 0).toBeGreaterThan(0);
    expect(
      (refreshedParent.wallet.tokensRemaining ?? 0) + (child.wallet.tokensRemaining ?? 0)
    ).toBeLessThanOrEqual(100_000 + 25_000);
    await organism.terminate();
  });

  it('exposes reproduce on agent context', async () => {
    const organism = await createOrg();
    await organism.start();
    const parent = await organism.spawnAgent({
      reason: 'seed',
      objective: 'commerce',
      needId: 'c',
      requiredCapabilities: ['commerce'],
      geneId: 'commerce-generalist',
      tokens: 80_000,
    });
    const ctx = organism.createAgentContext(parent.id);
    const child = await ctx.reproduce({
      reason: 'Need sizing expertise',
      specialization: ['sizing'],
    });
    expect(child.parentAgentId).toBe(parent.id);
    await organism.terminate();
  });
});

describe('phase 3 evolution', () => {
  beforeEach(() => {
    resetAgentSeqForTests();
  });

  it('mutates strategy config and records audit history', async () => {
    const organism = await createOrg();
    await organism.start();
    const agent = await organism.spawnAgent({
      reason: 'seed',
      objective: 'pricing',
      needId: 'pricing',
      requiredCapabilities: ['commerce'],
      geneId: 'commerce-generalist',
    });
    const mutated = await organism.mutateAgent(agent.id, {
      reason: 'Try lower temperature planning',
      mutation: {
        modelConfig: { temperature: 0.2 },
        strategyConfig: { planning: 'decompose-first' },
        promptChanges: ['Prefer stepwise plans'],
        addedCapabilities: ['experimentation'],
      },
    });
    expect(mutated.modelConfig.temperature).toBe(0.2);
    expect(mutated.strategyConfig.planning).toBe('decompose-first');
    expect(mutated.capabilities).toContain('experimentation');
    expect(mutated.mutations).toHaveLength(1);
    expect(mutated.systemPrompt).toContain('Prefer stepwise plans');
    await organism.terminate();
  });

  it('rejects mutation when gene disables it', async () => {
    const organism = await createOrg();
    await organism.start();
    const agent = await organism.spawnAgent({
      reason: 'seed',
      objective: 'research',
      needId: 'r',
      requiredCapabilities: ['research'],
      geneId: 'no-repro',
    });
    await expect(
      organism.mutateAgent(agent.id, {
        reason: 'x',
        mutation: { promptChanges: ['nope'] },
      })
    ).rejects.toThrow(/mutation disabled/);
    await organism.terminate();
  });

  it('evaluates a generation and selects a winner', async () => {
    const organism = await createOrg();
    await organism.start();
    const v1 = await organism.spawnAgent({
      reason: 'v1',
      objective: 'pricing-v1',
      needId: 'pricing-v1',
      requiredCapabilities: ['commerce'],
      geneId: 'commerce-generalist',
    });
    const v2 = await organism.spawnAgent({
      reason: 'v2',
      objective: 'pricing-v2',
      needId: 'pricing-v2',
      requiredCapabilities: ['commerce'],
      geneId: 'commerce-generalist',
    });
    const v3 = await organism.spawnAgent({
      reason: 'v3',
      objective: 'pricing-v3',
      needId: 'pricing-v3',
      requiredCapabilities: ['commerce'],
      geneId: 'commerce-generalist',
    });

    await organism.reportOutcome(v1.id, {
      result: 'ok',
      metrics: { valueGenerated: 100, cost: 10, confidence: 0.5 },
    });
    await organism.reportOutcome(v2.id, {
      result: 'great',
      metrics: { valueGenerated: 2000, cost: 5, confidence: 0.95 },
    });
    await organism.reportOutcome(v3.id, {
      result: 'meh',
      metrics: { valueGenerated: 50, cost: 20, confidence: 0.4 },
    });

    const result = await organism.evaluateGeneration({
      population: [v1.id, v2.id, v3.id],
      populationId: 'pricing',
    });
    expect(result.winner).toBe(v2.id);
    expect(result.scores[v2.id]).toBeGreaterThan(result.scores[v1.id]);
    expect(organism.getEvolutionaryHistory()).toHaveLength(1);
    await organism.terminate();
  });

  it('promotes winning strategy into losers when requested', async () => {
    const organism = await createOrg();
    await organism.start();
    const a = await organism.spawnAgent({
      reason: 'a',
      objective: 'a',
      needId: 'a',
      requiredCapabilities: ['commerce'],
      geneId: 'commerce-generalist',
    });
    const b = await organism.spawnAgent({
      reason: 'b',
      objective: 'b',
      needId: 'b',
      requiredCapabilities: ['commerce'],
      geneId: 'commerce-generalist',
    });
    await organism.reportOutcome(a.id, {
      result: 'win',
      metrics: { valueGenerated: 5000, cost: 1, confidence: 0.99 },
    });
    await organism.reportOutcome(b.id, {
      result: 'lose',
      metrics: { valueGenerated: 1, cost: 10, confidence: 0.2 },
    });

    await organism.evaluateGeneration({
      population: [a.id, b.id],
      promoteToLosers: true,
    });
    const loser = (await organism.listAgents()).find((x) => x.id === b.id)!;
    expect(loser.mutations.length).toBeGreaterThan(0);
    expect(String(loser.strategyConfig.promotedFrom)).toBe(a.id);
    await organism.terminate();
  });
});
