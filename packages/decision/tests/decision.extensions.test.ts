/**
 * Ensemble, cache, history, and routing extension tests.
 */

import {
  createDecisionRuntime,
  createEnsembleDecisionProvider,
  resolveEnsemble,
  DecisionCache,
  DecisionHistory,
  createCostAwareRouter,
  MockDecisionProvider,
  DecisionInvalidOutputError,
  projectDecisionFlow,
  buildDecisionFlowDefinition,
  fitCalibration,
  fitCalibrationFromHistory,
  applyCalibration,
} from '../src';

describe('ensemble', () => {
  it('majority picks the winning decision', () => {
    const result = resolveEnsemble({
      choices: ['a', 'b', 'c'] as const,
      votes: [
        { source: 'j1', decision: 'a', score: 0.8 },
        { source: 'j2', decision: 'a', score: 0.7 },
        { source: 'j3', decision: 'b', score: 0.9 },
      ],
      strategy: 'majority',
    });
    expect(result.decision).toBe('a');
    expect(result.agreement).toBe(false);
  });

  it('unanimous disagreement requires review', () => {
    const result = resolveEnsemble({
      choices: ['a', 'b'] as const,
      votes: [
        { source: 'j1', decision: 'a', score: 0.9 },
        { source: 'j2', decision: 'b', score: 0.9 },
      ],
      strategy: 'unanimous',
    });
    expect(result.needsReview).toBe(true);
  });

  it('rejects votes outside choices', () => {
    expect(() =>
      resolveEnsemble({
        choices: ['a', 'b'] as const,
        votes: [{ source: 'j1', decision: 'hack' as 'a', score: 1 }],
      })
    ).toThrow(DecisionInvalidOutputError);
  });

  it('ensemble provider consenses sub-providers', async () => {
    const mk = (name: string, decision: 'retry' | 'rollback', score: number) => {
      const mock = new MockDecisionProvider();
      mock.setDefault({ decision, confidence: score, score });
      return {
        name,
        decide: mock.decide.bind(mock),
      } as import('../src').DecisionProvider;
    };
    const ensemble = createEnsembleDecisionProvider({
      providers: [mk('judge-a', 'rollback', 0.9), mk('judge-b', 'rollback', 0.85)],
      strategy: 'majority',
    });
    const runtime = createDecisionRuntime();
    runtime.providers.register(ensemble);
    const result = await runtime.decide({
      objective: 'x',
      state: {},
      choices: ['retry', 'rollback'] as const,
      provider: 'ensemble',
    });
    expect(result.decision).toBe('rollback');
    expect(result.confidenceDetail.type).toBe('ensemble');
  });
});

describe('DecisionCache', () => {
  it('is opt-in and never invokes capabilities on hit', async () => {
    let calls = 0;
    const cache = new DecisionCache({ ttlMs: 60_000 });
    const runtime = createDecisionRuntime({
      cache,
      capabilityHandlers: {
        'deployment.rollback': async () => {
          calls += 1;
        },
      },
    });

    const req = {
      objective: 'cache-test',
      state: { x: 1 },
      choices: ['retry', 'rollback'] as const,
      provider: 'mock' as const,
      cache: true,
      execute: false,
    };
    const mock = runtime.providers.get('mock') as MockDecisionProvider;
    mock.setDefault({ decision: 'rollback', confidence: 0.95 });

    const first = await runtime.decide(req);
    const second = await runtime.decide(req);
    expect(first.decision).toBe('rollback');
    expect(second.decision).toBe('rollback');
    expect((second as { cached?: boolean }).cached).toBe(true);
    expect(calls).toBe(0);
    expect(cache.size()).toBe(1);
  });
});

describe('DecisionHistory', () => {
  it('stores records without feeding models', async () => {
    const history = new DecisionHistory();
    const runtime = createDecisionRuntime({ history });
    const mock = runtime.providers.get('mock') as MockDecisionProvider;
    mock.setDefault({ decision: 'approve', confidence: 0.8 });

    const result = await runtime.decide({
      name: 'refund-approval',
      objective: 'refund',
      state: { amount: 10 },
      choices: ['approve', 'reject'] as const,
      provider: 'mock',
    });
    expect(history.size()).toBe(1);
    runtime.evaluate({
      decisionId: result.id,
      expectedDecision: 'approve',
      actualOutcome: 'ok',
    });
    const rows = history.query({ name: 'refund-approval' });
    expect(rows[0].evaluation?.expectedDecision).toBe('approve');

    const trends = history.trends({ name: 'refund-approval' });
    expect(trends.total).toBe(1);
    expect(trends.byDecision.approve).toBe(1);
    expect(trends.accuracy).toBe(1);
    expect(trends.promptInjectionForbidden).toBe(true);
  });
});

describe('cost-aware router', () => {
  it('prefers economy for low risk', () => {
    const hook = createCostAwareRouter([
      { name: 'hazel-agent', costTier: 'balanced' },
      { name: 'local', costTier: 'economy' },
      { name: 'openai', costTier: 'premium', minRisk: 'high' },
    ]);
    expect(
      hook({
        risk: { level: 'low' },
        available: ['hazel-agent', 'local', 'openai'],
      })
    ).toBe('local');
    expect(
      hook({
        risk: { level: 'critical' },
        available: ['hazel-agent', 'local', 'openai'],
      })
    ).toBe('openai');
  });
});

describe('projectDecisionFlow', () => {
  it('projects deliberate stages for high risk', () => {
    const graph = projectDecisionFlow({ risk: 'high', strategy: 'auto' });
    expect(graph.strategy).toBe('deliberate');
    expect(graph.entry).toBe('route');
    const enabled = graph.nodes.filter((n) => n.enabled).map((n) => n.id);
    expect(enabled).toEqual(
      expect.arrayContaining(['evidence', 'candidates', 'judge', 'critic', 'policy'])
    );
    expect(enabled).not.toContain('hitl');
  });

  it('includes HITL for critical', () => {
    const graph = projectDecisionFlow({ risk: 'critical' });
    expect(graph.strategy).toBe('human-required');
    expect(graph.nodes.find((n) => n.id === 'hitl')?.enabled).toBe(true);
  });

  it('builds a FlowDefinition stub with handlers', async () => {
    const projection = projectDecisionFlow({ risk: 'low', strategy: 'fast' });
    const def = buildDecisionFlowDefinition(projection, {
      judge: async () => ({ status: 'ok', output: { decision: 'retry' } }),
    });
    expect(def.entry).toBe('route');
    expect(def.nodes.judge).toBeDefined();
    const out = await def.nodes.judge!.handler({
      input: {},
      state: {},
      outputs: {},
    });
    expect(out.output).toEqual({ decision: 'retry' });
  });
});

describe('calibration', () => {
  it('fits reliability bins and applies mapping', () => {
    const samples = [
      ...Array.from({ length: 20 }, () => ({ reported: 0.9, correct: 1 })),
      ...Array.from({ length: 20 }, () => ({ reported: 0.9, correct: 0 })),
      ...Array.from({ length: 10 }, () => ({ reported: 0.2, correct: 0 })),
    ];
    const model = fitCalibration(samples, { bins: 5 });
    expect(model.n).toBe(50);
    expect(model.authorizesExecution).toBe(false);
    expect(model.promptInjectionForbidden).toBe(true);
    expect(model.bins.length).toBeGreaterThan(0);
    const mapped = applyCalibration(0.9, model);
    expect(mapped).toBeGreaterThanOrEqual(0);
    expect(mapped).toBeLessThanOrEqual(1);
  });

  it('is opt-in on decide and never authorizes', async () => {
    const history = new DecisionHistory();
    const runtime = createDecisionRuntime({ history });
    const mock = runtime.providers.get('mock') as MockDecisionProvider;
    mock.setDefault({ decision: 'approve', confidence: 0.95 });

    for (let i = 0; i < 8; i++) {
      const r = await runtime.decide({
        name: 'refund-approval',
        objective: 'refund',
        state: { amount: i },
        choices: ['approve', 'reject'] as const,
        provider: 'mock',
      });
      runtime.evaluate({
        decisionId: r.id,
        expectedDecision: i % 2 === 0 ? 'approve' : 'reject',
      });
    }

    const model = fitCalibrationFromHistory(history, { name: 'refund-approval', bins: 5 });
    runtime.setCalibration(model);

    const raw = await runtime.decide({
      name: 'refund-approval',
      objective: 'refund',
      state: { amount: 99 },
      choices: ['approve', 'reject'] as const,
      provider: 'mock',
    });
    expect(raw.confidenceDetail.calibrated).toBe(false);

    const cal = await runtime.decide({
      name: 'refund-approval',
      objective: 'refund',
      state: { amount: 100 },
      choices: ['approve', 'reject'] as const,
      provider: 'mock',
      calibrate: true,
    });
    expect(cal.confidenceDetail.type).toBe('calibrated');
    expect(cal.confidenceDetail.calibrated).toBe(true);
    // Policy still evaluated independently — calibration is reporting only
    expect(cal.policy.outcome).toBeDefined();
  });
});
