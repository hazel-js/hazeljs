import { createOrganism, resetAgentSeqForTests, resetBidSeqForTests } from '../index';

async function createOrg(overrides: Record<string, unknown> = {}) {
  return createOrganism({
    mission: { id: 'econ', objective: 'Allocate scarce resources efficiently' },
    genes: [
      {
        id: 'ops',
        capabilities: ['operations', 'analytics'],
        reproduction: { enabled: true },
        mutation: { enabled: true },
      },
    ],
    resources: {
      tokenBudget: 100_000,
      monthlyBudget: { amount: 100, currency: 'USD' },
    },
    limits: {
      maxAgents: 10,
      maxGenerationDepth: 3,
      maxChildrenPerAgent: 2,
      maxSpawnRatePerMinute: 20,
      maxTotalCostPerHour: 50,
    },
    market: { minNetExpectedValue: 0, priceWeight: 0.2 },
    simulation: true,
    debug: false,
    ...overrides,
  });
}

describe('phase 4 agent economy', () => {
  beforeEach(() => {
    resetAgentSeqForTests();
    resetBidSeqForTests();
  });

  it('forecasts utility with opportunity cost under scarcity', async () => {
    const organism = await createOrg({
      resources: {
        tokenBudget: 100_000,
        monthlyBudget: { amount: 100, currency: 'USD' },
      },
    });
    await organism.start();
    // Drain most of the pool to raise scarcity
    const agent = await organism.spawnAgent({
      reason: 'seed',
      objective: 'ops',
      needId: 'ops',
      requiredCapabilities: ['operations'],
      tokens: 90_000,
    });
    const forecast = await organism.forecastUtility({
      agentId: agent.id,
      requested: { tokens: 5_000 },
      expectedValue: 50,
      confidence: 0.8,
    });
    expect(forecast.opportunityCost).toBeGreaterThan(0);
    expect(forecast.reasoningSummary).toContain('scarcity=');
    await organism.terminate();
  });

  it('clears a market and awards the higher-value bid', async () => {
    const organism = await createOrg();
    await organism.start();
    const a = await organism.spawnAgent({
      reason: 'a',
      objective: 'a',
      needId: 'a',
      requiredCapabilities: ['operations'],
      tokens: 1_000,
    });
    const b = await organism.spawnAgent({
      reason: 'b',
      objective: 'b',
      needId: 'b',
      requiredCapabilities: ['analytics'],
      tokens: 1_000,
    });

    organism.placeBid({
      agentId: a.id,
      reason: 'low value sim',
      requested: { tokens: 40_000 },
      expectedValue: 10,
      confidence: 0.4,
      urgency: 0.2,
    });
    organism.placeBid({
      agentId: b.id,
      reason: 'high value analysis',
      requested: { tokens: 40_000 },
      expectedValue: 5_000,
      confidence: 0.9,
      urgency: 0.8,
    });

    const cleared = await organism.clearMarket();
    expect(cleared.awarded.some((w) => w.agentId === b.id)).toBe(true);
    const winner = (await organism.listAgents()).find((x) => x.id === b.id)!;
    expect(winner.wallet.tokensRemaining ?? 0).toBeGreaterThan(1_000);
    await organism.terminate();
  });

  it('denies low-forecast direct resource requests', async () => {
    const organism = await createOrg({
      resources: {
        tokenBudget: 50_000,
        monthlyBudget: { amount: 10, currency: 'USD' },
      },
    });
    await organism.start();
    const agent = await organism.spawnAgent({
      reason: 'seed',
      objective: 'ops',
      needId: 'ops',
      requiredCapabilities: ['operations'],
      tokens: 40_000,
    });
    const result = await organism.requestResourcesForAgent(agent.id, {
      reason: 'wasteful',
      requested: { tokens: 5_000 },
      expectedValue: 0.01,
      confidence: 0.1,
    });
    expect(result.approved).toBe(false);
    expect(result.forecast).toBeDefined();
    await organism.terminate();
  });

  it('negotiates peer resource transfer when forecast is positive', async () => {
    const organism = await createOrg();
    await organism.start();
    const donor = await organism.spawnAgent({
      reason: 'donor',
      objective: 'donor',
      needId: 'd',
      requiredCapabilities: ['operations'],
      tokens: 50_000,
    });
    const receiver = await organism.spawnAgent({
      reason: 'receiver',
      objective: 'receiver',
      needId: 'r',
      requiredCapabilities: ['analytics'],
      tokens: 1_000,
    });

    const result = await organism.negotiate({
      fromAgentId: donor.id,
      toAgentId: receiver.id,
      reason: 'Fund analytics burst',
      transfer: { tokens: 10_000 },
      expectedValue: 2_000,
      confidence: 0.85,
    });
    expect(result.approved).toBe(true);

    const agents = await organism.listAgents();
    const d = agents.find((x) => x.id === donor.id)!;
    const r = agents.find((x) => x.id === receiver.id)!;
    expect(d.wallet.tokensRemaining).toBe(40_000);
    expect(r.wallet.tokensRemaining).toBe(11_000);
    await organism.terminate();
  });

  it('exposes bidding and negotiation on agent context', async () => {
    const organism = await createOrg();
    await organism.start();
    const a = await organism.spawnAgent({
      reason: 'a',
      objective: 'a',
      needId: 'a',
      requiredCapabilities: ['operations'],
      tokens: 20_000,
    });
    const b = await organism.spawnAgent({
      reason: 'b',
      objective: 'b',
      needId: 'b',
      requiredCapabilities: ['analytics'],
      tokens: 1_000,
    });

    const ctx = organism.createAgentContext(a.id);
    ctx.placeBid({
      reason: 'need burst',
      requested: { tokens: 5_000 },
      expectedValue: 800,
      confidence: 0.7,
    });
    expect(organism.listOpenBids().length).toBe(1);

    const nego = await ctx.negotiate({
      toAgentId: b.id,
      reason: 'share tokens',
      transfer: { tokens: 2_000 },
      expectedValue: 500,
      confidence: 0.8,
    });
    expect(nego.approved).toBe(true);
    await organism.terminate();
  });

  it('requestResources with useMarket clears bids', async () => {
    const organism = await createOrg();
    await organism.start();
    const agent = await organism.spawnAgent({
      reason: 'seed',
      objective: 'ops',
      needId: 'ops',
      requiredCapabilities: ['operations'],
      tokens: 1_000,
    });
    const result = await organism.requestResourcesForAgent(agent.id, {
      reason: 'market path',
      requested: { tokens: 10_000 },
      expectedValue: 3_000,
      confidence: 0.9,
      useMarket: true,
    });
    expect(result.approved).toBe(true);
    expect(result.reason).toMatch(/market/i);
    await organism.terminate();
  });
});
