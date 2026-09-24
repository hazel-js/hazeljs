/**
 * Decision Lab + external provider adapter tests.
 */

import {
  createDecisionRuntime,
  createDecisionLab,
  createOpenAiDecisionProvider,
  createJevDecisionProvider,
  MockDecisionProvider,
  incidentRemediationDefinition,
  incidentState,
} from '../src';

describe('DecisionLab', () => {
  it('runs a visualized decision without executing capabilities', async () => {
    let calls = 0;
    const runtime = createDecisionRuntime({
      capabilityHandlers: {
        'deployment.rollback': async () => {
          calls += 1;
        },
      },
    });
    runtime.registry.register({
      name: 'incident-remediation',
      ...incidentRemediationDefinition,
    });
    const lab = createDecisionLab(runtime);

    const out = await lab.run({
      name: 'incident-remediation',
      objective: incidentRemediationDefinition.objective,
      state: incidentState,
      choices: ['retry', 'rollback', 'escalate', 'ignore'] as const,
      risk: 'high',
      provider: 'hazel-agent',
      execute: true, // lab forces this off unless allowExecution
    });

    expect(out.result.decision).toBe('rollback');
    expect(out.graph.some((n) => n.id === 'judge' && n.status === 'done')).toBe(true);
    expect(calls).toBe(0);
    expect(out.audit?.decision).toBe('rollback');
  });

  it('compares providers in shadow mode without execution', async () => {
    const runtime = createDecisionRuntime();
    runtime.registry.register({
      name: 'incident-remediation',
      ...incidentRemediationDefinition,
    });

    const mock = new MockDecisionProvider();
    mock.when('incident-remediation').return({ decision: 'escalate', confidence: 0.8 });
    runtime.providers.register(mock);

    const lab = createDecisionLab(runtime);
    const comparison = await lab.compare(
      {
        name: 'incident-remediation',
        objective: 'x',
        state: incidentState,
        choices: ['retry', 'rollback', 'escalate', 'ignore'] as const,
        risk: 'high',
        execute: true,
      },
      ['hazel-agent', 'mock']
    );

    expect(comparison.executionForbidden).toBe(true);
    expect(comparison.rows).toHaveLength(2);
    expect(comparison.rows[0].decision).toBe('rollback');
    expect(comparison.rows[1].decision).toBe('escalate');
    expect(comparison.agreement).toBe(false);
  });
});

describe('external adapters', () => {
  it('openai adapter returns bounded choice via generateObject', async () => {
    const provider = createOpenAiDecisionProvider({
      generateObject: async () => ({ decision: 'rollback', score: 0.91, evidenceIds: [] }),
    });
    const runtime = createDecisionRuntime();
    runtime.providers.register(provider);

    const result = await runtime.decide({
      objective: 'x',
      state: incidentState,
      choices: ['retry', 'rollback'] as const,
      provider: 'openai',
    });
    expect(result.decision).toBe('rollback');
    expect(result.provider).toBe('openai');
  });

  it('jev adapter requires configuration', async () => {
    const provider = createJevDecisionProvider({});
    const runtime = createDecisionRuntime();
    runtime.providers.register(provider);
    await expect(
      runtime.decide({
        objective: 'x',
        state: {},
        choices: ['a', 'b'] as const,
        provider: 'jev',
      })
    ).rejects.toThrow(/not configured/);
  });
});
