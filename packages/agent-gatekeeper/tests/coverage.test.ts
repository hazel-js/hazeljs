/**
 * Coverage-focused tests for remaining policy, adapter, budget, and security branches.
 */

import { z } from 'zod';
import {
  AgentGatekeeper,
  BudgetTracker,
  FailingAuditSink,
  GatekeeperConfigurationError,
  GatekeeperDeniedError,
  GatekeeperError,
  GatekeeperErrorCodes,
  GatekeeperExecutionError,
  InMemoryApprovalProvider,
  InMemoryAuditSink,
  buildApprovalRequest,
  canonicalJson,
  createApprovalStoreProvider,
  createHumanTaskProvider,
  createToolExecutorGate,
  defaultClock,
  defaultIdGenerator,
  evaluatePolicies,
  fromFunction,
  fromHazelTool,
  fromSkillgate,
  loadPoliciesFromFileSync,
  loadPoliciesFromYaml,
  matchToolPattern,
  parseYamlPolicies,
  policiesFromDna,
  policiesFromPolicyRules,
  protectMcpInvoke,
  redactObject,
  redactValue,
  safeClone,
  sanitizeContextForAudit,
  sanitizeErrorMessage,
  stripFields,
  validatePolicies,
  yamlEntryToPolicy,
  GatekeeperMetrics,
} from '../src';
import type { ToolInvocationContext } from '../src';

function ctx(overrides: Partial<ToolInvocationContext> = {}): ToolInvocationContext {
  return {
    invocationId: 'inv',
    runId: 'run',
    agentId: 'agent-a',
    toolName: 'tool.x',
    input: {},
    environment: 'development',
    timestamp: new Date('2026-01-15T12:00:00Z'),
    ...overrides,
  };
}

describe('policy match filters', () => {
  it('filters by agent version, roles, trust, tenant, delegated user, env, class, and time', async () => {
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'deny',
      auditSink: new InMemoryAuditSink(),
      policies: [
        {
          id: 'narrow',
          version: '1',
          match: {
            agents: ['agent-a'],
            agentVersions: ['2.0.0'],
            roles: ['operator'],
            trustLevels: ['high'],
            tenants: ['t1'],
            delegatedUsers: ['u1'],
            tools: ['tool.x'],
            environments: ['production'],
            classifications: ['write'],
            timeWindows: [{ days: [4], start: '11:00', end: '13:00' }],
          },
          rules: { allowWhen: () => true },
        },
      ],
    });

    const missVersion = await gk.evaluate(
      ctx({
        agentVersion: '1.0.0',
        roles: ['operator'],
        trustLevel: 'high',
        tenantId: 't1',
        delegatedUserId: 'u1',
        environment: 'production',
      }),
      'write'
    );
    expect(missVersion.outcome).toBe('deny');

    const missRole = await gk.evaluate(
      ctx({
        agentVersion: '2.0.0',
        roles: ['viewer'],
        trustLevel: 'high',
        tenantId: 't1',
        delegatedUserId: 'u1',
        environment: 'production',
      }),
      'write'
    );
    expect(missRole.outcome).toBe('deny');

    const missTrust = await gk.evaluate(
      ctx({
        agentVersion: '2.0.0',
        roles: ['operator'],
        trustLevel: 'low',
        tenantId: 't1',
        delegatedUserId: 'u1',
        environment: 'production',
      }),
      'write'
    );
    expect(missTrust.outcome).toBe('deny');

    const missTenant = await gk.evaluate(
      ctx({
        agentVersion: '2.0.0',
        roles: ['operator'],
        trustLevel: 'high',
        tenantId: 'other',
        delegatedUserId: 'u1',
        environment: 'production',
      }),
      'write'
    );
    expect(missTenant.outcome).toBe('deny');

    const missUser = await gk.evaluate(
      ctx({
        agentVersion: '2.0.0',
        roles: ['operator'],
        trustLevel: 'high',
        tenantId: 't1',
        delegatedUserId: 'other',
        environment: 'production',
      }),
      'write'
    );
    expect(missUser.outcome).toBe('deny');

    const missEnv = await gk.evaluate(
      ctx({
        agentVersion: '2.0.0',
        roles: ['operator'],
        trustLevel: 'high',
        tenantId: 't1',
        delegatedUserId: 'u1',
        environment: 'staging',
      }),
      'write'
    );
    expect(missEnv.outcome).toBe('deny');

    const missClass = await gk.evaluate(
      ctx({
        agentVersion: '2.0.0',
        roles: ['operator'],
        trustLevel: 'high',
        tenantId: 't1',
        delegatedUserId: 'u1',
        environment: 'production',
      }),
      'read'
    );
    expect(missClass.outcome).toBe('deny');

    const missTime = await gk.evaluate(
      ctx({
        agentVersion: '2.0.0',
        roles: ['operator'],
        trustLevel: 'high',
        tenantId: 't1',
        delegatedUserId: 'u1',
        environment: 'production',
        timestamp: new Date('2026-01-15T02:00:00Z'),
      }),
      'write'
    );
    expect(missTime.outcome).toBe('deny');

    const missDay = await gk.evaluate(
      ctx({
        agentVersion: '2.0.0',
        roles: ['operator'],
        trustLevel: 'high',
        tenantId: 't1',
        delegatedUserId: 'u1',
        environment: 'production',
        timestamp: new Date('2026-01-16T12:00:00Z'),
      }),
      'write'
    );
    expect(missDay.outcome).toBe('deny');

    const hit = await gk.evaluate(
      ctx({
        agentVersion: '2.0.0',
        roles: ['operator'],
        trustLevel: 'high',
        tenantId: 't1',
        delegatedUserId: 'u1',
        environment: 'production',
      }),
      'write'
    );
    expect(hit.outcome).toBe('allow');
  });

  it('denies when roles are required but missing on context', async () => {
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'deny',
      auditSink: new InMemoryAuditSink(),
      policies: [
        {
          id: 'needs-role',
          version: '1',
          match: { roles: ['admin'] },
          rules: { allowWhen: () => true },
        },
      ],
    });
    expect((await gk.evaluate(ctx())).outcome).toBe('deny');
  });

  it('matches any-day time windows', async () => {
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'deny',
      auditSink: new InMemoryAuditSink(),
      policies: [
        {
          id: 'any-day',
          version: '1',
          match: { timeWindows: [{ days: '*', start: '00:00', end: '23:59' }] },
          rules: { allowWhen: () => true },
        },
      ],
    });
    expect((await gk.evaluate(ctx())).outcome).toBe('allow');
  });
});

describe('policy evaluation branches', () => {
  it('denies when allowWhen fails', async () => {
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'deny',
      auditSink: new InMemoryAuditSink(),
      policies: [{ id: 'allow-fail', version: '1', rules: { allowWhen: () => false } }],
    });
    expect((await gk.evaluate(ctx())).outcome).toBe('deny');
  });

  it('fails closed when a policy predicate throws', async () => {
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'allow',
      auditSink: new InMemoryAuditSink(),
      policies: [
        {
          id: 'boom',
          version: '1',
          rules: {
            allowWhen: () => {
              throw new Error('predicate exploded');
            },
          },
        },
      ],
    });
    const decision = await gk.evaluate(ctx());
    expect(decision.outcome).toBe('deny');
    if (decision.outcome === 'deny') {
      expect(decision.code).toBe(GatekeeperErrorCodes.POLICY);
    }
  });

  it('continues after policy failure in audit mode', async () => {
    const result = await evaluatePolicies({
      policies: [
        {
          id: 'boom',
          version: '1',
          rules: {
            allowWhen: () => {
              throw new Error('predicate exploded');
            },
          },
        },
      ],
      evalCtx: { context: ctx(), input: {} },
      mode: 'audit',
      defaultDecision: 'allow',
      budgetTracker: new BudgetTracker(),
      nowMs: Date.now(),
      policyTimeoutMs: 1000,
      rewritePass: 0,
      maxRewritePasses: 1,
    });
    expect(result.decision.outcome).toBe('allow');
  });

  it('enforces invocation budgets', async () => {
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'deny',
      auditSink: new InMemoryAuditSink(),
      policies: [
        {
          id: 'inv-cap',
          version: '1',
          match: { tools: ['*'] },
          rules: { invocationBudget: { max: 1 }, allowWhen: () => true },
        },
      ],
    });
    expect((await gk.evaluate(ctx())).outcome).toBe('allow');
    expect((await gk.evaluate(ctx())).outcome).toBe('deny');
  });

  it('rewrites and strips fields', async () => {
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'deny',
      auditSink: new InMemoryAuditSink(),
      policies: [
        {
          id: 'strip',
          version: '1',
          match: { tools: ['*'] },
          rules: {
            rewrite: ({ input }) => ({ ...(input as Record<string, unknown>), extra: 1 }),
            stripFields: ['secret'],
            allowWhen: () => true,
          },
        },
      ],
    });
    const tool = fromFunction('tool.x', async (input: Record<string, unknown>) => input, {
      classification: 'read',
    });
    const result = await gk.execute<Record<string, unknown>, Record<string, unknown>>({
      context: ctx({ input: { secret: 'x', keep: true } }) as ToolInvocationContext<
        Record<string, unknown>
      >,
      tool,
    });
    expect(result.output).toEqual({ keep: true, extra: 1 });
  });

  it('overrides require-approval in audit mode', async () => {
    const audit = new InMemoryAuditSink();
    const gk = new AgentGatekeeper({
      mode: 'audit',
      defaultDecision: 'deny',
      auditSink: audit,
      policies: [
        {
          id: 'need-approval',
          version: '1',
          rules: { requireApprovalWhen: () => true, allowWhen: () => true },
        },
      ],
    });
    const tool = fromFunction('tool.x', async () => ({ ok: true }), { classification: 'write' });
    const result = await gk.execute({ context: ctx(), tool });
    expect(result.output).toEqual({ ok: true });
  });

  it('simulates approval for destructive tools', async () => {
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'deny',
      auditSink: new InMemoryAuditSink(),
      policies: [
        {
          id: 'need-approval',
          version: '1',
          rules: { requireApprovalWhen: () => true, allowWhen: () => true },
        },
      ],
    });
    const sim = await gk.simulate(ctx(), 'destructive');
    expect(sim.decision.outcome).toBe('require_approval');
  });

  it('defaults to allow when configured', async () => {
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'allow',
      auditSink: new InMemoryAuditSink(),
    });
    expect((await gk.evaluate(ctx())).outcome).toBe('allow');
  });

  it('denies max transaction amount', async () => {
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'deny',
      auditSink: new InMemoryAuditSink(),
      policies: [
        {
          id: 'tx',
          version: '1',
          rules: { maxTransactionAmount: 10, allowWhen: () => true },
        },
      ],
    });
    expect((await gk.evaluate(ctx({ input: { amount: 50 } }))).outcome).toBe('deny');
  });
});

describe('security remaining branches', () => {
  it('clones dates, arrays, null, and depth-limited objects', () => {
    expect(safeClone(null)).toBeNull();
    expect(safeClone(undefined)).toBeUndefined();
    const date = new Date('2026-01-01T00:00:00Z');
    expect(safeClone(date).getTime()).toBe(date.getTime());
    expect(safeClone([1, { a: 2 }])).toEqual([1, { a: 2 }]);
    const nested: Record<string, unknown> = { a: 1 };
    let cursor = nested;
    for (let i = 0; i < 40; i++) {
      cursor.child = { a: i };
      cursor = cursor.child as Record<string, unknown>;
    }
    expect(safeClone(nested)).toBeDefined();
  });

  it('strips missing nested paths and top-level fields', () => {
    expect(stripFields({ a: 1 }, ['missing.x'])).toEqual({ a: 1 });
    expect(stripFields({ a: 1, b: 2 }, ['b'])).toEqual({ a: 1 });
  });

  it('redacts values of all kinds', () => {
    expect(redactValue('ab')).toBe('[REDACTED]');
    expect(redactValue('abcdef')).toBe('ab…[REDACTED]');
    expect(redactValue(12)).toBe(0);
    expect(redactValue(['xy'])).toEqual(['[REDACTED]']);
    expect(redactValue({ password: 'abc' })).toEqual({ password: '[REDACTED]' });
    expect(redactValue(true)).toBeNull();
  });

  it('redacts arrays of objects and extra fields', () => {
    const out = redactObject({ items: [{ name: 'n', ssn: '111' }], note: 'ok' }, ['note']);
    expect((out.items as Array<Record<string, unknown>>)[0].ssn).toBe('[REDACTED]');
    expect(out.note).toBe('[REDACTED]');
  });

  it('matches multi-segment wildcards', () => {
    expect(matchToolPattern('alpha.beta.gamma', 'a*b*a')).toBe(true);
    expect(matchToolPattern('nope', 'a*b*c')).toBe(false);
  });

  it('canonicalizes arrays, null, and primitives', () => {
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson(undefined)).toBe('null');
    expect(canonicalJson(3)).toBe('3');
    expect(canonicalJson([2, 1])).toBe('[2,1]');
  });

  it('sanitizes remaining secret patterns', () => {
    expect(sanitizeErrorMessage('api_key=abc password=xyz')).toContain('[REDACTED]');
  });

  it('generates incremental ids', () => {
    const gen = defaultIdGenerator();
    expect(gen()).not.toEqual(gen());
  });
});

describe('yaml remaining fields', () => {
  it('loads every declarative rule field', () => {
    const yaml = `
mode: audit
defaultDecision: allow
policies:
  - id: full
    version: "1.0.0"
    priority: 9
    metadata: { owner: ops }
    match:
      agents: [a]
      tools: [t]
    rules:
      maxTransactionAmount: 20
      enforceTenantField: tenantId
      stripFields: [secret]
      redactFields: [token]
      rateLimit: { max: 3, windowMs: 1000 }
      costBudget: { maxUnits: 5, windowMs: 1000 }
      invocationBudget: { max: 2 }
`;
    const loaded = loadPoliciesFromYaml(yaml);
    expect(loaded.mode).toBe('audit');
    expect(loaded.policies[0].rules?.maxTransactionAmount).toBe(20);
    expect(loaded.policies[0].rules?.rateLimit?.max).toBe(3);
    expect(loaded.policies[0].rules?.costBudget?.maxUnits).toBe(5);
    expect(loaded.policies[0].rules?.invocationBudget?.max).toBe(2);
  });

  it('rejects non-object yaml documents and missing versions', () => {
    expect(() => parseYamlPolicies('null')).toThrow(GatekeeperConfigurationError);
    expect(() => validatePolicies([{ id: 'x', version: '' }])).toThrow(
      GatekeeperConfigurationError
    );
  });

  it('loads policies from a file-like source', () => {
    const fs = {
      readFileSync: () => 'policies:\n  - id: p\n    version: "1"\n',
    };
    const loaded = loadPoliciesFromFileSync(fs, 'agent-gatekeeper.yaml');
    expect(loaded.policies[0].id).toBe('p');
  });

  it('converts a yaml entry without rules', () => {
    const policy = yamlEntryToPolicy({ id: 'bare', version: '1' });
    expect(policy.rules).toBeUndefined();
  });
});

describe('policy bridge remaining branches', () => {
  it('maps deny without whenInputIncludes and with reason', async () => {
    const policies = policiesFromPolicyRules([
      { id: 'deny-all', tool: '*', effect: 'deny', reason: 'blocked' },
    ]);
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'allow',
      policies,
      auditSink: new InMemoryAuditSink(),
    });
    expect((await gk.evaluate(ctx())).outcome).toBe('deny');
  });

  it('maps require_approval with whenInputIncludes', async () => {
    const policies = policiesFromPolicyRules([
      { id: 'appr', tool: 'pay', effect: 'require_approval', whenInputIncludes: 'wire' },
    ]);
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'allow',
      policies,
      auditSink: new InMemoryAuditSink(),
    });
    const hit = await gk.simulate(ctx({ toolName: 'pay', input: { type: 'wire' } }));
    expect(hit.decision.outcome).toBe('require_approval');
    const miss = await gk.simulate(ctx({ toolName: 'pay', input: { type: 'card' } }));
    expect(miss.decision.outcome).toBe('allow');
  });

  it('maps allow without matcher and empty DNA policies', async () => {
    const policies = policiesFromPolicyRules([{ id: 'allow-all', tool: 'x', effect: 'allow' }]);
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'deny',
      policies,
      auditSink: new InMemoryAuditSink(),
    });
    expect((await gk.evaluate(ctx({ toolName: 'x' }))).outcome).toBe('allow');
    expect(policiesFromDna({})).toEqual([]);
    expect(
      policiesFromDna({ policies: [null, 5, { id: 'legacy', tool: '*', effect: 'allow' }] })
    ).toHaveLength(1);
  });
});

describe('approvals remaining states', () => {
  it('covers get/resolve/consume edge cases', async () => {
    const clock = { now: () => new Date('2026-01-01T00:00:00Z') };
    const provider = new InMemoryApprovalProvider({ clock, idGenerator: () => 'apr' });
    expect(await provider.get('missing')).toBeUndefined();
    expect(await provider.resolve('missing', 'approved')).toBeUndefined();
    expect((await provider.consume('missing', 'fp')).valid).toBe(false);

    const req = buildApprovalRequest(
      {
        invocationId: 'i',
        runId: 'r',
        agentId: 'a',
        toolName: 't',
        input: { amount: 1 },
        reason: 'need',
        policyIds: ['p'],
        policyVersions: ['1'],
        riskClassification: 'high',
        idempotencyKey: 'k',
      },
      clock,
      () => 'apr-1',
      1000
    );
    await provider.create(req);
    const pendingConsume = await provider.consume('apr-1', req.invocationFingerprint);
    expect(pendingConsume.valid).toBe(false);

    await provider.resolve('apr-1', 'rejected');
    const already = await provider.resolve('apr-1', 'approved');
    expect(already?.status).toBe('rejected');
    expect((await provider.consume('apr-1', req.invocationFingerprint)).reason).toBe(
      'Approval rejected'
    );
  });

  it('marks consume as expired', async () => {
    let now = new Date('2026-01-01T00:00:00Z');
    const provider = new InMemoryApprovalProvider({ clock: { now: () => now } });
    await provider.create({
      approvalId: 'exp2',
      invocationId: 'i',
      runId: 'r',
      agentId: 'a',
      toolName: 't',
      argumentSummary: {},
      reason: 'r',
      policyIds: [],
      policyVersions: [],
      createdAt: now,
      expiresAt: new Date('2026-01-01T00:01:00Z'),
      riskClassification: 'low',
      idempotencyKey: 'k',
      invocationFingerprint: 'fp',
      status: 'approved',
    });
    now = new Date('2026-01-01T00:02:00Z');
    expect((await provider.consume('exp2', 'fp')).reason).toBe('Approval expired');
  });

  it('bridges approve and reject to the backing store', async () => {
    const records = new Map<string, unknown>();
    const calls: string[] = [];
    const store = {
      create(r: { requestId: string }) {
        records.set(r.requestId, r);
      },
      get(id: string) {
        return records.get(id);
      },
      approve: () => {
        calls.push('approve');
        return true;
      },
      reject: () => {
        calls.push('reject');
        return true;
      },
    };
    const provider = createApprovalStoreProvider(store);
    const req = await provider.create({
      approvalId: 'apr-store',
      invocationId: 'i',
      runId: 'r',
      agentId: 'a',
      toolName: 't',
      argumentSummary: {},
      reason: 'r',
      policyIds: ['p'],
      policyVersions: ['1'],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
      riskClassification: 'low',
      idempotencyKey: 'k',
      invocationFingerprint: 'fp',
      status: 'pending',
    });
    await provider.resolve(req.approvalId, 'approved', 'ops');
    await provider.resolve(req.approvalId, 'rejected');
    expect(calls).toEqual(['approve', 'reject']);
    expect((await provider.get(req.approvalId))?.status).toBe('approved');
  });

  it('bridges human task service create/resolve', async () => {
    const tasks = new Map<
      string,
      { id: string; status: string; payload?: unknown; metadata?: unknown }
    >();
    const humanTasks = {
      async create(input: { id?: string; payload?: unknown; metadata?: unknown }) {
        const id = input.id ?? 'ht-1';
        tasks.set(id, { id, status: 'pending', payload: input.payload, metadata: input.metadata });
        return { id };
      },
      async get(id: string) {
        return tasks.get(id);
      },
      async resolve(id: string, decision: string) {
        const task = tasks.get(id);
        if (task) task.status = decision;
        return { status: decision };
      },
    };
    const provider = createHumanTaskProvider(humanTasks);
    const req = await provider.create({
      approvalId: 'ht-apr',
      invocationId: 'i',
      runId: 'r',
      agentId: 'a',
      toolName: 't',
      argumentSummary: {},
      reason: 'r',
      policyIds: ['p'],
      policyVersions: ['1'],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
      riskClassification: 'low',
      idempotencyKey: 'k',
      invocationFingerprint: 'fp',
      status: 'pending',
    });
    await provider.resolve(req.approvalId, 'approved', 'ops');
    expect(tasks.size).toBe(1);
    expect((await provider.get(req.approvalId))?.status).toBe('approved');
  });
});

describe('adapters remaining branches', () => {
  it('classifies hazel tools as destructive and skillgate admin as critical', async () => {
    class Svc {
      async run(input: { n: number }) {
        return input.n;
      }
    }
    const svc = new Svc();
    const destructive = fromHazelTool({
      name: 'drop',
      method: svc.run,
      target: svc,
      riskLevel: 'critical',
    });
    expect(destructive.classification).toBe('destructive');
    expect(destructive.riskLevel).toBe('critical');
    expect(
      await destructive.execute(
        { n: 2 },
        ctx({ input: { n: 2 } }) as ToolInvocationContext<{ n: number }>
      )
    ).toBe(2);

    const write = fromHazelTool({ name: 'write', method: svc.run, target: svc });
    expect(write.classification).toBe('write');

    const admin = fromSkillgate(
      {
        name: 'admin',
        description: 'admin',
        class: 'admin',
        readOnly: false,
        requiresApproval: true,
      },
      async () => ({ ok: true })
    );
    expect(admin.classification).toBe('destructive');
    expect(admin.riskLevel).toBe('critical');
    expect(
      await admin.execute({}, ctx() as ToolInvocationContext<Record<string, unknown>>)
    ).toEqual({
      ok: true,
    });

    const dest = fromSkillgate(
      {
        name: 'destroy',
        description: 'd',
        class: 'destructive',
        readOnly: false,
        requiresApproval: true,
      },
      async () => ({ ok: true })
    );
    expect(dest.classification).toBe('destructive');
  });

  it('createToolExecutorGate succeeds and maps denials', async () => {
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'allow',
      auditSink: new InMemoryAuditSink(),
    });
    const gate = createToolExecutorGate(gk, (input) =>
      ctx({
        agentId: input.agentId,
        toolName: input.tool.name,
        input: input.input,
        runId: input.runId,
        sessionId: input.sessionId,
      })
    );
    class Svc {
      async run() {
        return { ok: true };
      }
    }
    const svc = new Svc();
    const ok = await gate.execute({
      tool: { name: 'tool.x', method: svc.run, target: svc },
      input: {},
      agentId: 'agent-a',
      sessionId: 's',
      runId: 'run',
    });
    expect(ok.success).toBe(true);

    const denyGk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'deny',
      auditSink: new InMemoryAuditSink(),
    });
    const denyGate = createToolExecutorGate(denyGk);
    const denied = await denyGate.execute({
      tool: { name: 'tool.x', method: svc.run, target: svc },
      input: {},
      agentId: 'agent-a',
      sessionId: 's',
    });
    expect(denied.success).toBe(false);
    expect(denied.error).toBeInstanceOf(GatekeeperDeniedError);
  });

  it('protectMcpInvoke forwards metadata', async () => {
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'allow',
      auditSink: new InMemoryAuditSink(),
    });
    const wrapped = protectMcpInvoke(
      async (_name, input) => input,
      gk,
      (toolName, input) =>
        ctx({ toolName, input }) as ToolInvocationContext<Record<string, unknown>>,
      () => ({ classification: 'read' })
    );
    expect(await wrapped('remote', { q: 1 })).toEqual({ q: 1 });
  });
});

describe('budget tracker remaining branches', () => {
  it('resets windows and invocation counters', async () => {
    const tracker = new BudgetTracker();
    const key = { scope: 'cost', policyId: 'p1' };
    const now = Date.now();
    expect((await tracker.checkCostBudget(key, 3, 10, 1000, now)).allowed).toBe(true);
    expect((await tracker.checkCostBudget(key, 8, 10, 1000, now)).allowed).toBe(false);
    expect((await tracker.checkCostBudget(key, 1, 10, 1000, now + 2000)).allowed).toBe(true);
    expect((await tracker.checkInvocationBudget('run', 'p1', 1)).allowed).toBe(true);
    expect((await tracker.checkInvocationBudget('run', 'p1', 1)).allowed).toBe(false);
    tracker.reset();
    expect((await tracker.checkInvocationBudget('run', 'p1', 1)).allowed).toBe(true);
    expect(
      (await tracker.checkRateLimit({ scope: 'rate', policyId: 'p1' }, 1, 10, now)).allowed
    ).toBe(true);
    expect(
      (await tracker.checkRateLimit({ scope: 'rate', policyId: 'p1' }, 1, 10, now + 20)).allowed
    ).toBe(true);
  });
});

describe('audit, metrics, errors, and execute extras', () => {
  it('resets metrics and sanitizes context', () => {
    const metrics = new GatekeeperMetrics();
    metrics.recordDecision('allow');
    metrics.reset();
    expect(metrics.snapshot().decisionCounts).toEqual({});
    expect(metrics.snapshot().avgToolLatencyMs).toBe(0);
    const sanitized = sanitizeContextForAudit(
      ctx({ purpose: 'refund', sessionId: 's', agentVersion: '1', input: { password: 'x' } }),
      ['password']
    );
    expect(sanitized.purpose).toBe('refund');
  });

  it('uses default FailingAuditSink message', () => {
    expect(() => new FailingAuditSink().emit()).toThrow('Audit sink failure');
  });

  it('constructs remaining error types', () => {
    const cfg = new GatekeeperConfigurationError('bad');
    expect(cfg.code).toBe(GatekeeperErrorCodes.CONFIG);
    const exec = new GatekeeperExecutionError('fail');
    expect(exec.code).toBe(GatekeeperErrorCodes.EXECUTION);
    const base = new GatekeeperError('x', GatekeeperErrorCodes.TENANT);
    expect(base.code).toBe(GatekeeperErrorCodes.TENANT);
  });

  it('redacts tool output fields', async () => {
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'allow',
      auditSink: new InMemoryAuditSink(),
    });
    const tool = fromFunction('tool.x', async () => ({ secret: 'abc', ok: true }), {
      classification: 'read',
      redactFields: ['secret'],
    });
    const result = await gk.execute({ context: ctx(), tool });
    expect(result.output).toEqual({ secret: '[REDACTED]', ok: true });
  });

  it('swallows non-critical audit failures outside enforce', async () => {
    const gk = new AgentGatekeeper({
      mode: 'disabled',
      defaultDecision: 'deny',
      auditSink: new FailingAuditSink(),
      audit: { critical: false },
    });
    const tool = fromFunction('tool.x', async () => ({ ok: true }), { classification: 'read' });
    const result = await gk.execute({ context: ctx(), tool });
    expect(result.output).toEqual({ ok: true });
  });

  it('uses default console sink constructor path', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const gk = new AgentGatekeeper({ mode: 'enforce', defaultDecision: 'allow' });
    expect(gk.mode).toBe('enforce');
    log.mockRestore();
  });

  it('wraps non-error tool failures', async () => {
    const gk = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'allow',
      auditSink: new InMemoryAuditSink(),
    });
    const tool = fromFunction(
      'fail',
      async () => {
        throw 'boom';
      },
      { classification: 'read' }
    );
    await expect(gk.execute({ context: ctx(), tool })).rejects.toThrow(GatekeeperExecutionError);
  });
});
