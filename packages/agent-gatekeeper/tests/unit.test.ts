/**
 * Additional unit tests for policy bridge, yaml, security, and edge cases.
 */

import { z } from 'zod';
import {
  AgentGatekeeper,
  GatekeeperConfigurationError,
  GatekeeperExecutionError,
  GatekeeperValidationError,
  InMemoryApprovalProvider,
  InMemoryAuditSink,
  ConsoleAuditSink,
  GatekeeperMetrics,
  CompositeAuditSink,
  fromFunction,
  loadPoliciesFromYaml,
  policiesFromPolicyRules,
  policiesFromDna,
  validatePolicies,
  protectMcpInvoke,
  createApprovalStoreProvider,
  decisionEventType,
  buildArgumentSummary,
  isForbiddenKey,
  stripFields,
  canonicalJson,
  safeClone,
  redactObject,
  sanitizeErrorMessage,
  defaultClock,
} from '../src';

describe('security utilities', () => {
  it('rejects forbidden keys', () => {
    expect(isForbiddenKey('__proto__')).toBe(true);
    expect(isForbiddenKey('name')).toBe(false);
  });

  it('strips nested fields', () => {
    const out = stripFields({ a: 1, b: { c: 2, d: 3 } }, ['b.c']);
    expect((out.b as Record<string, unknown>).c).toBeUndefined();
    expect((out.b as Record<string, unknown>).d).toBe(3);
  });

  it('canonicalizes json deterministically', () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe(canonicalJson({ a: 1, b: 2 }));
  });

  it('safeClone ignores proto keys', () => {
    const malicious = JSON.parse('{"a":1,"__proto__":{"polluted":true}}') as Record<
      string,
      unknown
    >;
    const cloned = safeClone(malicious);
    expect(cloned).toEqual({ a: 1 });
  });

  it('sanitizes error messages', () => {
    expect(sanitizeErrorMessage('Bearer abc123 token')).toContain('[REDACTED]');
  });

  it('redacts nested secrets', () => {
    const out = redactObject({ user: { password: 'secret' } });
    expect(JSON.stringify(out)).not.toContain('secret');
  });
});

describe('policy bridge', () => {
  it('maps deny rules', async () => {
    const policies = policiesFromPolicyRules([
      { id: 'd1', tool: 'x', effect: 'deny', whenInputIncludes: 'blocked' },
    ]);
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'allow',
      policies,
      auditSink: new InMemoryAuditSink(),
    });
    expect(
      (
        await gk.evaluate({
          invocationId: 'i',
          runId: 'r',
          agentId: 'a',
          toolName: 'x',
          input: { msg: 'blocked content' },
          environment: 'dev',
          timestamp: defaultClock().now(),
        })
      ).outcome
    ).toBe('deny');
  });

  it('maps allow rules', async () => {
    const policies = policiesFromPolicyRules([
      { id: 'a1', tool: 'x', effect: 'allow', whenInputIncludes: 'ok' },
    ]);
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'deny',
      policies,
      auditSink: new InMemoryAuditSink(),
    });
    expect(
      (
        await gk.evaluate({
          invocationId: 'i',
          runId: 'r',
          agentId: 'a',
          toolName: 'x',
          input: { msg: 'ok' },
          environment: 'dev',
          timestamp: defaultClock().now(),
        })
      ).outcome
    ).toBe('allow');
  });

  it('maps require_approval rules', async () => {
    const policies = policiesFromPolicyRules([
      { id: 'a1', tool: 'pay', effect: 'require_approval' },
    ]);
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'allow',
      policies,
      auditSink: new InMemoryAuditSink(),
    });
    const sim = await gk.simulate({
      invocationId: 'i',
      runId: 'r',
      agentId: 'a',
      toolName: 'pay',
      input: {},
      environment: 'dev',
      timestamp: defaultClock().now(),
    });
    expect(sim.decision.outcome).toBe('require_approval');
  });

  it('maps mask rules to rewrite', async () => {
    const policies = policiesFromPolicyRules([
      { id: 'm1', tool: '*', effect: 'mask', maskFields: ['secret'] },
    ]);
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'deny',
      policies: [...policies, { id: 'allow', version: '1', rules: { allowWhen: () => true } }],
      auditSink: new InMemoryAuditSink(),
    });
    const tool = fromFunction('t', async (i: { secret?: string; ok: boolean }) => i, {
      classification: 'read',
    });
    const result = await gk.execute({
      context: {
        invocationId: 'i',
        runId: 'r',
        agentId: 'a',
        toolName: 't',
        input: { secret: 'x', ok: true },
        environment: 'dev',
        timestamp: defaultClock().now(),
      },
      tool,
    });
    expect(result.output).toEqual({ secret: '[REDACTED]', ok: true });
  });

  it('loads policies from DNA policy rules', () => {
    const policies = policiesFromDna({
      policies: [{ id: 'legacy', tool: '*', effect: 'allow' }],
    });
    expect(policies.length).toBe(1);
  });
});

describe('yaml loader', () => {
  it('throws on duplicate policy ids', () => {
    expect(() =>
      validatePolicies([
        { id: 'p', version: '1' },
        { id: 'p', version: '2' },
      ])
    ).toThrow(GatekeeperConfigurationError);
  });

  it('throws on missing policy id', () => {
    expect(() => validatePolicies([{ id: '', version: '1' }])).toThrow(
      GatekeeperConfigurationError
    );
  });

  it('throws on invalid yaml', () => {
    expect(() => loadPoliciesFromYaml(':\n  bad: [yaml')).toThrow(GatekeeperConfigurationError);
  });

  it('loads field-based rules', async () => {
    const yaml = `
policies:
  - id: email-policy
    version: "1.0.0"
    match:
      tools: [email.send]
    rules:
      denyWhenFieldEquals:
        - field: external
          value: true
      requireApprovalWhenFieldGt:
        - field: recipients
          threshold: 1
`;
    const loaded = loadPoliciesFromYaml(yaml);
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'deny',
      policies: [
        ...loaded.policies,
        { id: 'allow', version: '1', rules: { allowWhen: () => true } },
      ],
      auditSink: new InMemoryAuditSink(),
    });
    expect(
      (
        await gk.evaluate({
          invocationId: 'i',
          runId: 'r',
          agentId: 'a',
          toolName: 'email.send',
          input: { external: true, recipients: 1 },
          environment: 'dev',
          timestamp: defaultClock().now(),
        })
      ).outcome
    ).toBe('deny');
  });
});

describe('audit and metrics', () => {
  it('composites audit sinks', async () => {
    const a = new InMemoryAuditSink();
    const b = new InMemoryAuditSink();
    const composite = new CompositeAuditSink([a, b]);
    await composite.emit({
      type: 'gatekeeper.evaluation.started',
      timestamp: new Date().toISOString(),
      invocationId: 'i',
      runId: 'r',
      agentId: 'a',
      toolName: 't',
      environment: 'dev',
    });
    expect(a.events).toHaveLength(1);
    expect(b.events).toHaveLength(1);
  });

  it('records metrics', () => {
    const metrics = new GatekeeperMetrics();
    metrics.recordDecision('deny', 'GATEKEEPER_DENIED');
    metrics.recordEvaluationLatency(10);
    metrics.recordToolLatency(20);
    const snap = metrics.snapshot();
    expect(snap.decisionCounts['deny:GATEKEEPER_DENIED']).toBe(1);
    expect(snap.avgEvaluationLatencyMs).toBe(10);
  });

  it('maps decision event types', () => {
    expect(decisionEventType({ outcome: 'allow', policyIds: [] })).toBe(
      'gatekeeper.decision.allowed'
    );
    expect(
      decisionEventType({ outcome: 'rewrite', policyIds: [], reason: 'r', safeInput: {} })
    ).toBe('gatekeeper.decision.rewritten');
  });

  it('console audit sink emits', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    new ConsoleAuditSink().emit({
      type: 'gatekeeper.tool.completed',
      timestamp: new Date().toISOString(),
      invocationId: 'i',
      runId: 'r',
      agentId: 'a',
      toolName: 't',
      environment: 'dev',
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('builds argument summary', () => {
    const summary = buildArgumentSummary({ password: 'x', name: 'a' });
    expect(summary.password).toBe('[REDACTED]');
  });
});

describe('approval store bridge', () => {
  it('creates approval via store provider', async () => {
    const store = {
      records: [] as unknown[],
      create(r: unknown) {
        this.records.push(r);
      },
      get: () => undefined,
      approve: () => true,
      reject: () => true,
    };
    const provider = createApprovalStoreProvider(store);
    const req = await provider.create({
      approvalId: 'apr-1',
      invocationId: 'inv-1',
      runId: 'run-1',
      agentId: 'a',
      toolName: 't',
      argumentSummary: {},
      reason: 'test',
      policyIds: ['p1'],
      policyVersions: ['1'],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
      riskClassification: 'low',
      idempotencyKey: 'k',
      invocationFingerprint: '{}',
      status: 'pending',
    });
    expect(req.approvalId).toBe('apr-1');
    expect(store.records).toHaveLength(1);
  });
});

describe('protectMcpInvoke', () => {
  it('wraps MCP invoke with gatekeeper', async () => {
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'allow',
      auditSink: new InMemoryAuditSink(),
    });
    const wrapped = protectMcpInvoke(
      async (_name, input) => ({ echo: input }),
      gk,
      (toolName, input) => ({
        invocationId: 'i',
        runId: 'r',
        agentId: 'a',
        toolName,
        input,
        environment: 'dev',
        timestamp: defaultClock().now(),
      })
    );
    const out = await wrapped('remote', { q: 1 });
    expect(out).toEqual({ echo: { q: 1 } });
  });
});

describe('disabled mode and execution errors', () => {
  it('bypasses policies in disabled mode', async () => {
    const gk = new AgentGatekeeper({
      mode: 'disabled',
      defaultDecision: 'deny',
      policies: [{ id: 'deny-all', version: '1', rules: { denyWhen: () => true } }],
      auditSink: new InMemoryAuditSink(),
    });
    const tool = fromFunction('t', async () => ({ ok: true }), { classification: 'read' });
    const result = await gk.execute({
      context: {
        invocationId: 'i',
        runId: 'r',
        agentId: 'a',
        toolName: 't',
        input: {},
        environment: 'dev',
        timestamp: defaultClock().now(),
      },
      tool,
    });
    expect(result.output).toEqual({ ok: true });
  });

  it('wraps tool execution failures', async () => {
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'allow',
      auditSink: new InMemoryAuditSink(),
    });
    const tool = fromFunction(
      'fail',
      async () => {
        throw new Error('boom');
      },
      { classification: 'read' }
    );
    await expect(
      gk.execute({
        context: {
          invocationId: 'i',
          runId: 'r',
          agentId: 'a',
          toolName: 'fail',
          input: {},
          environment: 'dev',
          timestamp: defaultClock().now(),
        },
        tool,
      })
    ).rejects.toThrow(GatekeeperExecutionError);
  });

  it('validates output schema', async () => {
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'allow',
      auditSink: new InMemoryAuditSink(),
    });
    const tool = fromFunction('bad-out', async () => ({ bad: true }), {
      classification: 'read',
      outputSchema: z.object({ ok: z.literal(true) }) as unknown as z.ZodType<{ bad: boolean }>,
    });
    await expect(
      gk.execute({
        context: {
          invocationId: 'i',
          runId: 'r',
          agentId: 'a',
          toolName: 'bad-out',
          input: {},
          environment: 'dev',
          timestamp: defaultClock().now(),
        },
        tool,
      })
    ).rejects.toThrow(GatekeeperValidationError);
  });
});

describe('budget cost tracking', () => {
  it('denies when cost budget exceeded', async () => {
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'deny',
      policies: [
        {
          id: 'cost-cap',
          version: '1',
          match: { tools: ['*'] },
          rules: {
            costBudget: { maxUnits: 5, windowMs: 60_000 },
            allowWhen: () => true,
          },
        },
      ],
      auditSink: new InMemoryAuditSink(),
    });
    const ctx = {
      invocationId: 'i',
      runId: 'r',
      agentId: 'a',
      toolName: 'expensive',
      input: {},
      environment: 'dev',
      timestamp: defaultClock().now(),
      metadata: { estimatedCostUnits: 10 },
    };
    expect((await gk.evaluate(ctx)).outcome).toBe('deny');
  });
});

describe('approval provider expiry', () => {
  it('marks expired approvals', async () => {
    const clock = {
      now: () => new Date('2026-01-01T00:00:00Z'),
    };
    const provider = new InMemoryApprovalProvider({ clock });
    await provider.create({
      approvalId: 'exp',
      invocationId: 'i',
      runId: 'r',
      agentId: 'a',
      toolName: 't',
      argumentSummary: {},
      reason: 'r',
      policyIds: [],
      policyVersions: [],
      createdAt: new Date('2025-12-31T23:00:00Z'),
      expiresAt: new Date('2025-12-31T23:30:00Z'),
      riskClassification: 'low',
      idempotencyKey: 'k',
      invocationFingerprint: 'fp',
      status: 'pending',
    });
    const req = await provider.get('exp');
    expect(req?.status).toBe('expired');
  });
});
