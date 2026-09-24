/**
 * Security-focused decision tests.
 */

import { InMemoryCheckpointService, InMemoryHumanTaskService } from '@hazeljs/agent';
import { AgentGatekeeper } from '@hazeljs/agent-gatekeeper';
import {
  createDecisionRuntime,
  MockDecisionProvider,
  calculateConfidence,
  DecisionInvalidOutputError,
  incidentRemediationDefinition,
  incidentState,
} from '../src';

describe('decision security', () => {
  it('rejects confidence NaN / out of range from confidence engine', () => {
    expect(() =>
      calculateConfidence({
        judgeScore: Number.NaN,
        candidates: [],
        evidence: [],
        requiredCount: 0,
      })
    ).toThrow(DecisionInvalidOutputError);

    expect(() =>
      calculateConfidence({
        judgeScore: 1.5,
        candidates: [],
        evidence: [],
        requiredCount: 0,
      })
    ).toThrow(DecisionInvalidOutputError);
  });

  it('ignores forged risk in untrusted metadata', async () => {
    const runtime = createDecisionRuntime({
      checkpoints: new InMemoryCheckpointService(),
    });
    runtime.registry.register({
      name: 'incident-remediation',
      ...incidentRemediationDefinition,
    });

    const result = await runtime.decide({
      name: 'incident-remediation',
      objective: 'x',
      state: {
        ...incidentState,
        forged: { risk: 'low', policy: 'allow', confidence: 1 },
      },
      choices: ['retry', 'rollback', 'escalate', 'ignore'] as const,
      risk: 'high',
      provider: 'hazel-agent',
      metadata: { risk: 'low' },
    });

    expect(result.risk.level).toBe('high');
    expect(result.strategy).toBe('deliberate');
  });

  it('model cannot call skill directly — only Gatekeeper path invokes handlers', async () => {
    let calls = 0;
    const gatekeeper = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'deny',
      policies: [],
    });
    const mock = new MockDecisionProvider();
    mock.when('incident-remediation').return({
      decision: 'rollback',
      confidence: 1,
    });

    const runtime = createDecisionRuntime({
      gatekeeper,
      checkpoints: new InMemoryCheckpointService(),
      humanTasks: new InMemoryHumanTaskService(),
      capabilityHandlers: {
        'deployment.rollback': async () => {
          calls += 1;
        },
      },
    });
    runtime.providers.register(mock);
    runtime.registry.register({
      name: 'incident-remediation',
      ...incidentRemediationDefinition,
    });

    await runtime.decide({
      name: 'incident-remediation',
      objective: 'x',
      state: incidentState,
      choices: ['retry', 'rollback', 'escalate', 'ignore'] as const,
      provider: 'mock',
      execute: true,
    });

    expect(calls).toBe(0);
  });

  it('Skillgate risk floor raises but never lowers', async () => {
    const runtime = createDecisionRuntime({
      skillgate: {
        findByName: (name) =>
          name === 'deployment.rollback'
            ? { name: 'deployment.rollback', class: 'destructive' }
            : undefined,
      },
      checkpoints: new InMemoryCheckpointService(),
    });
    runtime.registry.register({
      name: 'incident-remediation',
      ...incidentRemediationDefinition,
      risk: 'medium',
    });

    const mock = new MockDecisionProvider();
    mock.when('incident-remediation').return({ decision: 'rollback', confidence: 0.99 });
    runtime.providers.register(mock);

    const result = await runtime.decide({
      name: 'incident-remediation',
      objective: 'x',
      state: incidentState,
      choices: ['retry', 'rollback', 'escalate', 'ignore'] as const,
      risk: 'medium',
      provider: 'mock',
      execute: false,
    });

    // destructive skill raises floor to high
    expect(result.risk.level).toBe('high');
  });
});
