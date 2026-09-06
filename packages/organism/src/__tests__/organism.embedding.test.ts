import {
  createOpsOrganism,
  OrganismHostRegistry,
  toAgentOutcomeReport,
  toEnvironmentSignal,
  toIncidentEnvironmentSignal,
  incidentNeedMappings,
} from '../index';

describe('organism embedding boilerplate', () => {
  it('createOpsOrganism starts and observes environment + incident signals', async () => {
    const host = await createOpsOrganism({
      mission: {
        id: 'ops-demo',
        objective: 'Keep operations healthy',
      },
      genes: [
        {
          id: 'generalist',
          capabilities: ['operations', 'analytics'],
        },
      ],
      signalNeedMappings: [
        {
          signalType: 'refunds.increased',
          need: 'refund-analysis',
          requiredCapabilities: ['analytics', 'operations'],
          urgency: 0.9,
          confidence: 0.9,
        },
      ],
      incidentTypes: ['refund_spike'],
      limits: { maxAgents: 5, maxTotalCostPerHour: 5 },
      simulation: true,
      debug: false,
    });

    await host.start();

    await host.observe(
      toEnvironmentSignal({
        type: 'refunds.increased',
        source: 'test',
        severity: 0.9,
        data: { baseline: 0.04, current: 0.09 },
      })
    );

    await host.observe(
      toIncidentEnvironmentSignal({
        incidentType: 'refund_spike',
        severity: 0.85,
        data: { incidentId: 'inc_1' },
      })
    );

    const state = await host.inspect();
    expect(state.status === 'operating' || state.status === 'observing').toBe(true);
    expect(state.agents.length).toBeGreaterThanOrEqual(1);

    const agent = state.agents[0];
    await host.reportOutcome(
      agent.id,
      toAgentOutcomeReport({
        verdict: 'successful',
        confidence: 0.9,
        summary: 'Issue mitigated',
      })
    );

    await host.terminate();
  });

  it('incidentNeedMappings builds investigate-* mappings', () => {
    const mappings = incidentNeedMappings(['room_readiness_issue'], ['housekeeping']);
    expect(mappings).toEqual([
      {
        signalType: 'incident.room_readiness_issue',
        need: 'investigate-room_readiness_issue',
        requiredCapabilities: ['housekeeping'],
        urgency: 0.85,
        confidence: 0.9,
      },
    ]);
  });

  it('OrganismHostRegistry reuses hosts by id', async () => {
    const registry = new OrganismHostRegistry();
    let creates = 0;
    const factory = async () => {
      creates += 1;
      return createOpsOrganism({
        id: 'host_reuse',
        mission: { id: 'm', objective: 'test' },
        genes: [{ id: 'g', capabilities: ['operations'] }],
        simulation: true,
      });
    };

    const a = await registry.getOrCreate('host_reuse', factory);
    await a.start();
    const b = await registry.getOrCreate('host_reuse', factory);
    expect(a).toBe(b);
    expect(creates).toBe(1);
    expect(registry.size).toBe(1);
    await a.terminate();
    registry.clear();
  });
});
