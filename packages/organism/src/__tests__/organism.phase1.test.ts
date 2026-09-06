import {
  createOrganism,
  resetAgentSeqForTests,
  Mission,
  AgentGene,
  Constitution,
  applyMissionMetricUpdates,
  createMissionProgress,
  OrganismConstitutionError,
  OrganismEventType,
  ConstitutionEnforcer,
  SurvivalEngine,
  getMissionMetadata,
  getAgentGeneMetadata,
  getConstitutionMetadata,
  type MissionDefinition,
} from '../index';

describe('mission', () => {
  const mission: MissionDefinition = {
    id: 'm1',
    objective: 'Grow profit',
    successCriteria: [
      { name: 'csat', operator: 'gte', target: 90 },
      { name: 'refund_rate', operator: 'lte', target: 0.05 },
      { name: 'profit', operator: 'maximize' },
    ],
  };

  it('registers progress and completes when target criteria met', () => {
    let progress = createMissionProgress(mission);
    expect(progress.completed).toBe(false);
    progress = applyMissionMetricUpdates(progress, mission, {
      csat: 91,
      refund_rate: 0.04,
      profit: 1000,
    });
    expect(progress.criteriaMet.csat).toBe(true);
    expect(progress.criteriaMet.refund_rate).toBe(true);
    expect(progress.completed).toBe(true);
  });

  it('supports @Mission decorator metadata', () => {
    @Mission({ id: 'decorated', objective: 'Test' })
    class M {}
    expect(getMissionMetadata(M)?.id).toBe('decorated');
  });
});

describe('organism phase 1 runtime', () => {
  beforeEach(() => {
    resetAgentSeqForTests();
  });

  async function createTestOrganism(overrides: Record<string, unknown> = {}) {
    return createOrganism({
      mission: {
        id: 'support',
        objective: 'Operate customer support while maintaining 90% CSAT',
        successCriteria: [{ name: 'csat', operator: 'gte', target: 90 }],
        constraints: ['Never expose customer PII'],
      },
      genes: [
        {
          id: 'commerce-generalist',
          capabilities: ['commerce', 'customer-support'],
        },
        {
          id: 'analysis-gene',
          capabilities: ['analytics', 'analysis'],
        },
      ],
      constitution: {
        id: 'c1',
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
      },
      resources: {
        tokenBudget: 200_000,
        monthlyBudget: { amount: 100, currency: 'USD' },
      },
      limits: {
        maxAgents: 3,
        maxGenerationDepth: 3,
        maxChildrenPerAgent: 2,
        maxSpawnRatePerMinute: 5,
        maxTotalCostPerHour: 50,
      },
      signalNeedMappings: [
        {
          signalType: 'refunds.increased',
          need: 'refund-analysis',
          requiredCapabilities: ['analytics', 'commerce'],
          urgency: 0.9,
          confidence: 0.9,
        },
      ],
      survival: {
        minimumUtility: 0.3,
        minimumEvaluationAgeMs: 1,
        minimumSampleSize: 2,
        cooldownMs: 0,
      },
      debug: false,
      simulation: true,
      ...overrides,
    });
  }

  it('starts and emits organism.started', async () => {
    const organism = await createTestOrganism();
    const events: string[] = [];
    organism.events.on(OrganismEventType.ORGANISM_STARTED, (e) => {
      events.push(e.type);
    });
    await organism.start();
    expect(organism.status).toBe('operating');
    expect(events).toContain(OrganismEventType.ORGANISM_STARTED);
    await organism.terminate();
  });

  it('spawns agent on refund need with correct gene and generation', async () => {
    const organism = await createTestOrganism();
    await organism.start();
    const decision = await organism.observe({
      type: 'refunds.increased',
      source: 'analytics',
      severity: 0.95,
      relevance: 1,
      data: { baseline: 0.04, current: 0.07 },
    });
    expect(decision?.action).toBe('spawn');
    const agents = await organism.listAgents();
    expect(agents).toHaveLength(1);
    expect(agents[0].generation).toBe(1);
    expect(agents[0].geneId).toBe('analysis-gene');
    expect(agents[0].capabilities.map((c) => c.toLowerCase())).toEqual(
      expect.arrayContaining(['analytics', 'commerce'])
    );
    expect(agents[0].birthProposal.needId).toBe('refund-analysis');
    await organism.terminate();
  });

  it('reuses capable agent instead of spawning duplicate', async () => {
    const organism = await createTestOrganism();
    await organism.start();
    await organism.observe({
      type: 'refunds.increased',
      source: 'analytics',
      severity: 0.95,
      relevance: 1,
      data: { baseline: 0.04, current: 0.07 },
    });
    const decision2 = await organism.observe({
      type: 'refunds.increased',
      source: 'analytics',
      severity: 0.95,
      relevance: 1,
      data: { baseline: 0.04, current: 0.08 },
    });
    expect(decision2?.action).toBe('delegate');
    expect(await organism.listAgents()).toHaveLength(1);
    await organism.terminate();
  });

  it('ignores irrelevant low-severity signals', async () => {
    const organism = await createTestOrganism({ relevanceThreshold: 0.8 });
    await organism.start();
    const decision = await organism.observe({
      type: 'weather.sunny',
      source: 'weather',
      severity: 0.05,
      relevance: 0.05,
      data: {},
    });
    expect(decision?.action).toBe('observe');
    expect(await organism.listAgents()).toHaveLength(0);
    await organism.terminate();
  });

  it('denies spawn when token budget exhausted', async () => {
    const organism = await createTestOrganism({
      resources: {
        tokenBudget: 0,
        monthlyBudget: { amount: 100, currency: 'USD' },
      },
    });
    await organism.start();
    await expect(
      organism.spawnAgent({
        reason: 'test',
        objective: 'Do work',
        needId: 'x',
        requiredCapabilities: ['analytics'],
        tokens: 1000,
      })
    ).rejects.toThrow(/Insufficient tokens|OrganismStateError|RESOURCE/i);
    await organism.terminate();
  });

  it('releases tokens on termination', async () => {
    const organism = await createTestOrganism();
    await organism.start();
    const before = organism.getRecord().pool.tokensRemaining;
    const agent = await organism.spawnAgent({
      reason: 'test',
      objective: 'Analyze',
      needId: 'refund-analysis',
      requiredCapabilities: ['analytics'],
      tokens: 40_000,
    });
    expect(organism.getRecord().pool.tokensRemaining).toBe(before - 40_000);
    await organism.terminateAgent(agent.id, { reason: 'low_value' });
    expect(organism.getRecord().pool.tokensRemaining).toBe(before);
    await organism.terminate();
  });

  it('enforces maxAgents', async () => {
    const organism = await createTestOrganism({
      limits: {
        maxAgents: 1,
        maxGenerationDepth: 3,
        maxChildrenPerAgent: 2,
        maxSpawnRatePerMinute: 20,
        maxTotalCostPerHour: 50,
      },
    });
    await organism.start();
    await organism.spawnAgent({
      reason: 'a',
      objective: 'a',
      needId: 'n1',
      requiredCapabilities: ['analytics'],
    });
    await expect(
      organism.spawnAgent({
        reason: 'b',
        objective: 'b',
        needId: 'n2',
        requiredCapabilities: ['commerce'],
      })
    ).rejects.toThrow(/maxAgents/);
    await organism.terminate();
  });

  it('kill switch blocks spawning', async () => {
    const organism = await createTestOrganism();
    await organism.start();
    await organism.emergencyStop();
    await expect(
      organism.spawnAgent({
        reason: 'x',
        objective: 'x',
        needId: 'x',
        requiredCapabilities: ['analytics'],
      })
    ).rejects.toThrow();
  });

  it('pause and resume work', async () => {
    const organism = await createTestOrganism();
    await organism.start();
    await organism.pause();
    expect(organism.status).toBe('paused');
    const d = await organism.observe({
      type: 'refunds.increased',
      source: 'a',
      severity: 1,
      relevance: 1,
    });
    expect(d).toBeUndefined();
    await organism.resume();
    expect(organism.status).toBe('operating');
    await organism.terminate();
  });

  it('constitution rejects PII exposure', async () => {
    const organism = await createTestOrganism();
    await organism.start();
    const enforcer = new ConstitutionEnforcer(
      organism.getRecord().constitution,
      organism.events,
      organism.id
    );
    expect(() => enforcer.assertAllows('tool', { exposesPii: true })).toThrow(
      OrganismConstitutionError
    );
    await organism.terminate();
  });

  it('survival terminates low utility after min samples and age', async () => {
    const organism = await createTestOrganism();
    await organism.start();
    const agent = await organism.spawnAgent({
      reason: 'spawn',
      objective: 'temp',
      needId: 'temp',
      requiredCapabilities: ['analytics'],
    });
    await organism.reportOutcome(agent.id, {
      result: 'poor',
      metrics: { valueGenerated: 0, cost: 20, confidence: 0.2 },
    });
    await organism.reportOutcome(agent.id, {
      result: 'poor2',
      metrics: { valueGenerated: 0, cost: 20, confidence: 0.2 },
    });
    organism.clock.useAccelerated(Date.now());
    organism.clock.advance(120_000);
    await organism.runSurvivalCycle();
    const after = await organism.listAgents();
    const terminated = after.find((a) => a.id === agent.id);
    expect(terminated?.status).toBe('terminated');
    await organism.terminate();
  });

  it('protects critical agents from survival termination', async () => {
    const organism = await createTestOrganism();
    await organism.start();
    const agent = await organism.spawnAgent({
      reason: 'spawn',
      objective: 'critical',
      needId: 'c',
      requiredCapabilities: ['commerce'],
    });
    const record = (await organism.listAgents())[0];
    record.criticalResponsibility = true;
    // force low utility via outcomes then mark critical in repo via report path:
    // re-fetch and patch through terminate protection by setting flag before survival
    const live = await organism.listAgents();
    live[0].criticalResponsibility = true;
    const engine = new SurvivalEngine({
      minimumUtility: 0.9,
      minimumEvaluationAgeMs: 0,
      minimumSampleSize: 0,
      cooldownMs: 0,
    });
    live[0].utility.score = 0.01;
    live[0].evaluationCount = 10;
    live[0].criticalResponsibility = true;
    const verdict = engine.evaluate(live[0]);
    expect(verdict.shouldTerminate).toBe(false);
    expect(agent.id).toBeDefined();
    await organism.terminate();
  });

  it('updates mission progress from outcomes', async () => {
    const organism = await createTestOrganism();
    await organism.start();
    const agent = await organism.spawnAgent({
      reason: 'spawn',
      objective: 'support',
      needId: 'support',
      requiredCapabilities: ['customer-support'],
    });
    await organism.reportOutcome(agent.id, {
      result: 'CSAT improved',
      metrics: { valueGenerated: 100, confidence: 0.9 },
      missionMetricUpdates: { csat: 92 },
    });
    expect(organism.getRecord().missionProgress.metrics.csat).toBe(92);
    expect(organism.getRecord().missionProgress.completed).toBe(true);
    await organism.terminate();
  });

  it('inspect and genealogy APIs work', async () => {
    const organism = await createTestOrganism();
    await organism.start();
    await organism.spawnAgent({
      reason: 'spawn',
      objective: 'x',
      needId: 'x',
      requiredCapabilities: ['analytics'],
    });
    const state = await organism.inspect();
    expect(state.agents.length).toBe(1);
    const graph = await organism.getGraph();
    expect(graph.nodes.length).toBe(1);
    const gene = await organism.getGenealogy();
    expect(gene[0].rootGeneId).toBe('analysis-gene');
    await organism.terminate();
  });

  it('decorator AgentGene and Constitution register', () => {
    @AgentGene({ id: 'g', capabilities: ['x'] })
    class G {}
    @Constitution({ id: 'c', rules: [] })
    class C {}
    expect(getAgentGeneMetadata(G)?.id).toBe('g');
    expect(getConstitutionMetadata(C)?.id).toBe('c');
  });
});
