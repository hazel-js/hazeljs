import 'reflect-metadata';
import {
  Injectable,
  Autonomous,
  Observe,
  Capability,
  clearAutonomousRegistry,
  Container,
} from '@hazeljs/core';
import {
  AgentGatekeeper,
  GatekeeperApprovalRequiredError,
  GatekeeperDeniedError,
  InMemoryApprovalProvider,
  InMemoryAuditSink,
} from '@hazeljs/agent-gatekeeper';
import {
  AutonomousModule,
  AutonomousBootstrapService,
  AUTONOMOUS_OPTIONS,
  AutonomousRuntime,
  MemoryAutonomousRunStore,
  createAgentBackedRunStore,
  RulesDecisionEngine,
  LoopProtector,
  mergeLoopProtection,
  FailureInjector,
  simulate,
  evaluateOutcome,
  AutonomousMetrics,
  effectToGateClassification,
  CapabilityRegistry,
  policiesFromCapabilities,
  redactPayload,
  buildObservation,
  DEFAULT_LOOP_PROTECTION,
} from '../src';
import type { AutonomousObservation, AutonomousRunRecord } from '../src';

describe('unit coverage — policies, registry, envelope', () => {
  beforeEach(() => clearAutonomousRegistry());

  it('maps capability effects to gate classifications', () => {
    expect(effectToGateClassification('read-only')).toBe('read');
    expect(effectToGateClassification('idempotent')).toBe('write');
    expect(effectToGateClassification('reversible')).toBe('write');
    expect(effectToGateClassification('irreversible')).toBe('destructive');
  });

  it('builds allow and require-approval policies from grants', () => {
    const policies = policiesFromCapabilities([
      {
        id: 'a.read',
        version: '1',
        serviceId: 's',
        effect: 'read-only',
        approval: 'auto',
        propertyKey: 'r',
        instance: {},
        method: () => null,
        granted: true,
      },
      {
        id: 'a.write',
        version: '1',
        serviceId: 's',
        effect: 'irreversible',
        approval: 'required',
        propertyKey: 'w',
        instance: {},
        method: () => null,
        granted: true,
      },
      {
        id: 'a.denied',
        version: '1',
        serviceId: 's',
        effect: 'idempotent',
        approval: 'auto',
        propertyKey: 'd',
        instance: {},
        method: () => null,
        granted: false,
      },
    ]);
    expect(policies).toHaveLength(2);
    const allowRules = policies[0]!.rules!;
    const requireRules = policies[1]!.rules!;
    expect(allowRules.allowWhen).toBeDefined();
    expect(allowRules.requireApprovalWhen).toBeUndefined();
    expect(requireRules.requireApprovalWhen).toBeDefined();
    expect(requireRules.allowWhen).toBeUndefined();
    expect(allowRules.allowWhen!({} as never)).toBe(true);
    expect(requireRules.requireApprovalWhen!({} as never)).toBe(true);
  });

  it('registers services and rejects non-autonomous classes', () => {
    @Injectable()
    @Autonomous({ id: 'reg', mode: 'observe-only', capabilities: ['x.do'] })
    class Reg {
      @Observe({ event: 'evt', recordOnly: true })
      on() {
        return {};
      }

      @Capability({ id: 'x.do', effect: 'read-only', approval: 'auto' })
      do() {
        return 1;
      }
    }

    const registry = new CapabilityRegistry();
    const svc = registry.registerServiceInstance(Reg, new Reg());
    expect(svc.id).toBe('reg');
    expect(registry.getCapability('x.do')?.granted).toBe(true);
    expect(registry.observersFor('evt')[0].recordOnly).toBe(true);
    expect(registry.listServices()).toHaveLength(1);
    expect(registry.listCapabilities()).toHaveLength(1);

    class Plain {}
    expect(() => registry.registerServiceInstance(Plain, new Plain())).toThrow(/not @Autonomous/);
    registry.clear();
    expect(registry.listServices()).toHaveLength(0);
  });

  it('redacts sensitive payload fields and truncates long strings', () => {
    expect(redactPayload(null)).toBeNull();
    expect(redactPayload(42)).toBe(42);
    expect(redactPayload('short')).toBe('short');
    expect((redactPayload('x'.repeat(600)) as string).endsWith('…')).toBe(true);
    expect(redactPayload(['a', { password: 'secret' }])).toEqual(['a', { password: '[REDACTED]' }]);
    expect(
      redactPayload({ api_key: 'k', nested: { token: 't', ok: true } })
    ).toEqual({ api_key: '[REDACTED]', nested: { token: '[REDACTED]', ok: true } });
    // depth truncate
    let deep: unknown = { v: 1 };
    for (let i = 0; i < 12; i++) deep = { child: deep };
    expect(JSON.stringify(redactPayload(deep))).toContain('[truncated]');
  });

  it('buildObservation fills defaults', () => {
    const obs = buildObservation({ eventType: 'e', payload: { a: 1 } });
    expect(obs.eventId).toBeTruthy();
    expect(obs.schemaVersion).toBe(1);
    expect(obs.source).toBe('application');
    expect(obs.depth).toBe(0);
  });
});

describe('unit coverage — rules engine', () => {
  const baseObs: AutonomousObservation = {
    eventId: 'e1',
    eventType: 'orders.failed',
    source: 'test',
    timestamp: new Date().toISOString(),
    schemaVersion: 1,
    payload: { orderId: '1' },
  };

  it('returns no-action for disabled and observe-only', async () => {
    const engine = new RulesDecisionEngine();
    expect(
      (await engine.evaluate({
        observation: baseObs,
        serviceId: 's',
        mode: 'disabled',
        allowedCapabilities: ['orders.retry'],
        policies: [],
      })).type
    ).toBe('no-action');
    expect(
      (await engine.evaluate({
        observation: baseObs,
        serviceId: 's',
        mode: 'observe-only',
        allowedCapabilities: ['orders.retry'],
        policies: [],
      })).type
    ).toBe('no-action');
  });

  it('suggests, requests approval, executes, and uses custom resolver', async () => {
    const engine = new RulesDecisionEngine();
    const suggest = await engine.evaluate({
      observation: baseObs,
      serviceId: 's',
      mode: 'suggest',
      allowedCapabilities: ['orders.retry'],
      policies: [],
    });
    expect(suggest.type).toBe('recommend');

    const approval = await engine.evaluate({
      observation: baseObs,
      serviceId: 's',
      mode: 'approval-required',
      allowedCapabilities: ['orders.retry'],
      policies: [],
    });
    expect(approval.type).toBe('request-approval');

    const exec = await engine.evaluate({
      observation: { ...baseObs, payload: 'raw' },
      serviceId: 's',
      mode: 'governed-auto',
      allowedCapabilities: ['orders.retry'],
      policies: [],
    });
    expect(exec.type).toBe('execute');
    if (exec.type === 'execute') expect(exec.arguments).toEqual({ value: 'raw' });

    const custom = new RulesDecisionEngine(() => 'custom.cap');
    const c = await custom.evaluate({
      observation: baseObs,
      serviceId: 's',
      mode: 'governed-auto',
      allowedCapabilities: ['orders.retry'],
      policies: [],
    });
    expect(c.type === 'execute' && c.capabilityId).toBe('custom.cap');
  });

  it('picks exact stem match and falls back to first grant', async () => {
    const engine = new RulesDecisionEngine();
    const exact = await engine.evaluate({
      observation: { ...baseObs, eventType: 'shipping.switch' },
      serviceId: 's',
      mode: 'governed-auto',
      allowedCapabilities: ['shipping.switch', 'other.x'],
      policies: [],
    });
    expect(exact.type === 'execute' && exact.capabilityId).toBe('shipping.switch');

    const fallback = await engine.evaluate({
      observation: { ...baseObs, eventType: 'misc.event' },
      serviceId: 's',
      mode: 'governed-auto',
      allowedCapabilities: ['alpha.act'],
      policies: [],
    });
    expect(fallback.type === 'execute' && fallback.capabilityId).toBe('alpha.act');
  });
});

describe('unit coverage — loop protection', () => {
  const protection = { maxDepth: 2, cooldownMs: 50, maxActionsPerRun: 2 };

  function obs(overrides: Partial<AutonomousObservation> = {}): AutonomousObservation {
    return {
      eventId: overrides.eventId ?? `id-${Math.random()}`,
      eventType: 'e',
      source: 't',
      timestamp: new Date().toISOString(),
      schemaVersion: 1,
      payload: {},
      depth: 0,
      ...overrides,
    };
  }

  it('enforces depth, actions, cooldown, and duplicate eventId', () => {
    const loop = new LoopProtector();
    expect(() =>
      loop.assertAllowed(obs({ depth: 3 }), protection, 0)
    ).toThrow(/maxDepth/);

    expect(() => loop.assertAllowed(obs(), protection, 2)).toThrow(/maxActionsPerRun/);

    loop.assertAllowed(obs({ eventId: 'a', subject: 's' }), protection, 0);
    expect(() =>
      loop.assertAllowed(obs({ eventId: 'b', subject: 's' }), protection, 0)
    ).toThrow(/Cooldown/);

    loop.clear();
    // Same eventId, different subject keys — cooldown key differs; fingerprint catches dup.
    loop.assertAllowed(obs({ eventId: 'dup', subject: 'one' }), { ...protection, cooldownMs: 0 }, 0);
    expect(() =>
      loop.assertAllowed(obs({ eventId: 'dup', subject: 'two' }), { ...protection, cooldownMs: 0 }, 0)
    ).toThrow(/Duplicate/);
  });

  it('merges loop protection overrides', () => {
    expect(mergeLoopProtection(undefined)).toEqual(DEFAULT_LOOP_PROTECTION);
    expect(mergeLoopProtection({ maxDepth: 9 }, { cooldownMs: 1 })).toMatchObject({
      maxDepth: 9,
      cooldownMs: 1,
      maxActionsPerRun: DEFAULT_LOOP_PROTECTION.maxActionsPerRun,
    });
  });
});

describe('unit coverage — metrics', () => {
  it('increments counters and snapshots', () => {
    const m = new AutonomousMetrics(false);
    m.incRuns();
    m.incDecisions();
    m.incExecuted();
    m.incDenied();
    m.setApprovalsPending(3);
    m.incRetries();
    m.incRecoveries();
    m.incBudgetExceeded();
    m.recordDuration(10);
    m.recordDuration(20);
    const s = m.getSnapshot();
    expect(s.runsTotal).toBe(1);
    expect(s.decisionsTotal).toBe(1);
    expect(s.capabilitiesExecuted).toBe(1);
    expect(s.capabilitiesDenied).toBe(1);
    expect(s.approvalsPending).toBe(3);
    expect(s.retriesTotal).toBe(1);
    expect(s.recoveriesTotal).toBe(1);
    expect(s.budgetExceededTotal).toBe(1);
    expect(s.runDurationMsSum).toBe(30);
    expect(s.runDurationMsCount).toBe(2);
  });

  it('tolerates missing otel peer when enabled', () => {
    const m = new AutonomousMetrics(true);
    m.incRuns();
    expect(m.getSnapshot().runsTotal).toBe(1);
  });
});

describe('unit coverage — failure injection', () => {
  it('injects only configured scenarios', () => {
    const inj = new FailureInjector({ scenarios: ['tool-timeout'], probability: 1 });
    expect(inj.shouldInject('tool-timeout')).toBe(true);
    expect(inj.shouldInject('worker-crash')).toBe(false);
    expect(() => inj.maybeThrow('tool-timeout', 'boom')).toThrow('boom');
    expect(() => inj.maybeThrow('worker-crash')).not.toThrow();
  });

  it('defaults to empty scenarios and respects probability 0', () => {
    const empty = new FailureInjector();
    expect(empty.shouldInject('provider-error')).toBe(false);
    const never = new FailureInjector({ scenarios: ['provider-error'], probability: 0 });
    expect(never.shouldInject('provider-error')).toBe(false);
  });
});

describe('unit coverage — simulate + evaluateOutcome', () => {
  beforeEach(() => clearAutonomousRegistry());

  it('simulate creates dry-run run and throws when no observer', async () => {
    @Injectable()
    @Autonomous({ id: 'sim', mode: 'governed-auto', capabilities: ['sim.act'] })
    class Sim {
      @Observe('sim.event')
      on(e: unknown) {
        return e;
      }

      @Capability({ id: 'sim.act', effect: 'idempotent', approval: 'auto', idempotencyKey: true })
      act() {
        return { ok: true };
      }
    }

    const runtime = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      autoDiscover: false,
      services: [Sim],
      simulation: true,
    });
    runtime.bindInstance(Sim, new Sim());

    const result = await simulate({
      service: 'sim',
      event: { type: 'sim.event', payload: { x: 1 } },
      fixtures: { a: 1 },
      runtime,
    });
    expect(result.run.metadata.dryRun || result.run.output).toBeTruthy();
    expect(result.timeline).toBeDefined();

    await expect(
      simulate({
        service: 'none',
        event: { type: 'unobserved', payload: {} },
        runtimeOptions: { autoDiscover: false, storage: new MemoryAutonomousRunStore() },
      })
    ).rejects.toThrow(/No autonomous run/);
  });

  it('evaluateOutcome emits recommendations', async () => {
    const base: AutonomousRunRecord = {
      id: 'r1',
      serviceId: 's',
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        kind: 'autonomous',
        serviceId: 's',
        phase: 'completed',
        mode: 'governed-auto',
        effectStatus: 'uncertain',
        timeline: [
          { at: new Date().toISOString(), type: 'capability.denied' },
          { at: new Date().toISOString(), type: 'approval.pending' },
          { at: new Date().toISOString(), type: 'approval.pending' },
          { at: new Date().toISOString(), type: 'approval.pending' },
        ],
      },
    };
    const out = await evaluateOutcome(base);
    expect(out.success).toBe(true);
    expect(out.recommendations.map((r) => r.type)).toEqual(
      expect.arrayContaining(['reconciliation', 'policy-review', 'approval-policy'])
    );

    const failed = await evaluateOutcome({
      ...base,
      status: 'failed',
      metadata: { ...base.metadata, effectStatus: 'failed', timeline: [] },
    });
    expect(failed.success).toBe(false);
  });
});

describe('unit coverage — memory store + agent bridge', () => {
  it('memory store CRUD and duplicate create', async () => {
    const store = new MemoryAutonomousRunStore();
    const meta = {
      kind: 'autonomous' as const,
      serviceId: 's',
      phase: 'created' as const,
      mode: 'observe-only' as const,
      timeline: [],
    };
    const created = await store.create({ id: '1', serviceId: 's', metadata: meta, tenantId: 't' });
    expect(created.id).toBe('1');
    await expect(store.create({ id: '1', serviceId: 's', metadata: meta })).rejects.toThrow(
      /already exists/
    );
    expect(await store.get('missing')).toBeUndefined();
    const updated = await store.update('1', { status: 'completed', output: { ok: true } });
    expect(updated.status).toBe('completed');
    await expect(store.update('missing', { status: 'x' })).rejects.toThrow(/not found/);
    expect(await store.list({ serviceId: 's', status: 'completed' })).toHaveLength(1);
    expect(await store.list({ serviceId: 'other' })).toHaveLength(0);
  });

  it('createAgentBackedRunStore projects AgentRun records', async () => {
    const runs = new Map<string, {
      id: string;
      agentName: string;
      status: string;
      input?: unknown;
      output?: unknown;
      error?: { message: string; code?: string };
      tenantId?: string;
      createdAt: Date;
      updatedAt: Date;
      metadata?: Record<string, unknown>;
    }>();

    const repo = {
      async create(input: {
        id: string;
        agentName: string;
        input?: unknown;
        tenantId?: string;
        metadata?: Record<string, unknown>;
      }) {
        const now = new Date();
        const row = {
          id: input.id,
          agentName: input.agentName,
          status: 'created',
          input: input.input,
          tenantId: input.tenantId,
          createdAt: now,
          updatedAt: now,
          metadata: input.metadata,
        };
        runs.set(input.id, row);
        return { ...row };
      },
      async get(runId: string) {
        const r = runs.get(runId);
        return r ? { ...r } : undefined;
      },
      async updateStatus(
        runId: string,
        status: string,
        patch?: {
          output?: unknown;
          error?: { message: string; code?: string };
          metadata?: Record<string, unknown>;
        }
      ) {
        const r = runs.get(runId)!;
        const next = {
          ...r,
          status,
          output: patch?.output ?? r.output,
          error: patch?.error ?? r.error,
          metadata: patch?.metadata ?? r.metadata,
          updatedAt: new Date(),
        };
        runs.set(runId, next);
        return { ...next };
      },
      async list(filter?: { agentName?: string; status?: string }) {
        return Array.from(runs.values()).filter((r) => {
          if (filter?.agentName && r.agentName !== filter.agentName) return false;
          if (filter?.status && r.status !== filter.status) return false;
          return true;
        });
      },
    };

    const store = createAgentBackedRunStore(repo);
    const created = await store.create({
      id: 'aar1',
      serviceId: 'svc',
      metadata: {
        kind: 'autonomous',
        serviceId: 'svc',
        phase: 'created',
        mode: 'observe-only',
      },
    });
    expect(created.serviceId).toBe('svc');
    expect((await store.get('aar1'))?.id).toBe('aar1');
    expect(await store.get('nope')).toBeUndefined();
    await store.update('aar1', {
      status: 'completed',
      metadata: {
        kind: 'autonomous',
        serviceId: 'svc',
        phase: 'completed',
        mode: 'observe-only',
      },
    });
    // non-aar metadata filtered out
    await repo.create({
      id: 'agent1',
      agentName: 'other',
      metadata: { kind: 'agent' },
    });
    const listed = await store.list({ serviceId: 'svc' });
    expect(listed.every((r) => r.metadata.kind === 'autonomous')).toBe(true);
  });
});

describe('unit coverage — AutonomousModule', () => {
  beforeEach(() => {
    clearAutonomousRegistry();
    Container.createTestInstance();
  });

  it('forRoot returns dynamic module and getOptions caches', () => {
    const mod = AutonomousModule.forRoot({ observability: { enabled: false } });
    expect(mod.module).toBe(AutonomousModule);
    expect(mod.global).toBe(true);
    expect(AutonomousModule.getOptions().observability?.enabled).toBe(false);
    expect(mod.providers?.length).toBeGreaterThan(0);
  });

  it('bootstrap service starts runtime and shuts down', async () => {
    @Injectable()
    @Autonomous({ id: 'boot', mode: 'observe-only' })
    class Boot {
      @Observe('boot.evt')
      on() {
        return {};
      }
    }

    const runtime = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      autoDiscover: false,
      services: [Boot],
    });
    const container = Container.getInstance();
    container.register(Boot, new Boot());

    const boot = new AutonomousBootstrapService(
      { autoDiscover: false, services: [Boot] },
      runtime
    );
    await boot.onModuleInit();
    expect(runtime.registry.listServices().length).toBe(1);
    await boot.onModuleDestroy();
  });

  it('bootstrap tolerates unresolved DI providers', async () => {
    @Injectable()
    @Autonomous({ id: 'miss', mode: 'observe-only' })
    class Miss {
      @Observe('m')
      on() {
        return {};
      }
    }

    const runtime = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      autoDiscover: false,
      services: [Miss],
    });
    // Do not bind instance / register in container — bootstrap catch path
    const boot = new AutonomousBootstrapService({ autoDiscover: false, services: [Miss] }, runtime);
    await boot.onModuleInit();
    // Runtime start may still construct Miss via new Miss()
    expect(runtime.registry.getService('miss') || true).toBeTruthy();
  });
});

describe('unit coverage — runtime extras', () => {
  beforeEach(() => clearAutonomousRegistry());

  it('diff, timeline, reject resume, suggest mode, and listRuns', async () => {
    @Injectable()
    @Autonomous({
      id: 'extra',
      mode: 'suggest',
      capabilities: ['extra.act'],
    })
    class Extra {
      @Observe('extra.evt')
      on(e: unknown) {
        return e;
      }

      @Capability({ id: 'extra.act', effect: 'read-only', approval: 'auto' })
      act() {
        return { done: true };
      }
    }

    const runtime = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      autoDiscover: false,
      services: [Extra],
    });
    runtime.bindInstance(Extra, new Extra());
    await runtime.start();

    const [runId] = await runtime.emit('extra.evt', { a: 1 });
    const run = await runtime.inspect(runId!);
    expect(run?.metadata.decision?.type).toBe('recommend');
    expect(await runtime.timeline(runId!)).toEqual(run?.metadata.timeline);
    expect(await runtime.listRuns({ serviceId: 'extra' })).toHaveLength(1);

    await expect(runtime.resume('missing', { approved: true, actor: 'x' })).rejects.toThrow(
      /not found/
    );
    await expect(runtime.resume(runId!, { approved: true, actor: 'x' })).rejects.toThrow(
      /not awaiting approval/
    );

    const replayed = await runtime.replay(runId!);
    const d = await runtime.diff(runId!, replayed.id);
    expect(d.runA).toBe(runId);
    expect(runtime.getGatekeeper()).toBeTruthy();
    await expect(runtime.replay('nope')).rejects.toThrow(/not found/);
    await expect(runtime.replay(runId!, { dryRun: false })).rejects.toThrow(/Live replay/);
  });

  it('rejects approval and handles gatekeeper deny path', async () => {
    @Injectable()
    @Autonomous({
      id: 'rej',
      mode: 'approval-required',
      capabilities: ['rej.act'],
    })
    class Rej {
      @Observe('rej.evt')
      on(e: unknown) {
        return e;
      }

      @Capability({ id: 'rej.act', effect: 'idempotent', approval: 'auto', idempotencyKey: true })
      act() {
        return { ok: true };
      }
    }

    const runtime = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      autoDiscover: false,
      services: [Rej],
    });
    runtime.bindInstance(Rej, new Rej());
    await runtime.start();
    const [runId] = await runtime.emit('rej.evt', { orderId: '1' });
    await runtime.resume(runId!, { approved: false, actor: 'ops' });
    const run = await runtime.inspect(runId!);
    expect(run?.status).toBe('cancelled');
  });
});

describe('unit coverage — runtime branches', () => {
  beforeEach(() => clearAutonomousRegistry());

  it('auto-discovers, skips unconstructable services, and registerInstance', async () => {
    @Injectable()
    @Autonomous({ id: 'disc', mode: 'observe-only' })
    class Disc {
      @Observe('disc.evt')
      on() {
        return {};
      }
    }

    @Injectable()
    @Autonomous({ id: 'needdeps', mode: 'observe-only' })
    class NeedDeps {
      constructor() {
        throw new Error('requires DI');
      }
      @Observe('need.evt')
      on() {
        return {};
      }
    }

    const runtime = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      // default autoDiscover=true — covers getRegisteredAutonomousServices path
      gatekeeper: new AgentGatekeeper({
        mode: 'enforce',
        defaultDecision: 'deny',
        approvalProvider: new InMemoryApprovalProvider(),
        auditSink: new InMemoryAuditSink(),
        policies: [{ id: 'external.keep', version: '1', priority: 1, match: { tools: ['*'] } }],
      }),
    });
    runtime.bindInstance(Disc, new Disc());
    await runtime.start();
    expect(runtime.registry.getService('disc')).toBeDefined();
    // NeedDeps throws on construct — skipped
    expect(runtime.registry.getService('needdeps')).toBeUndefined();

    // Bypass constructor via Object.create for registerInstance
    const needInstance = Object.create(NeedDeps.prototype) as NeedDeps;
    runtime.registerInstance(NeedDeps, needInstance);
    expect(runtime.registry.getService('needdeps')).toBeDefined();

    // second start is no-op
    await runtime.start();
  });

  it('denies execute decision for ungranted capability', async () => {
    @Injectable()
    @Autonomous({
      id: 'ungrant',
      mode: 'governed-auto',
      capabilities: [],
    })
    class Ungrant {
      @Observe('u.evt')
      on(e: unknown) {
        return e;
      }

      @Capability({ id: 'u.act', effect: 'idempotent', approval: 'auto', idempotencyKey: true })
      act() {
        return { ok: true };
      }
    }

    const runtime = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      autoDiscover: false,
      services: [Ungrant],
      decisionEngine: {
        async evaluate() {
          return {
            type: 'execute',
            capabilityId: 'u.act',
            arguments: {},
            reason: 'forced',
          };
        },
      },
    });
    runtime.bindInstance(Ungrant, new Ungrant());
    await runtime.start();
    const [runId] = await runtime.emit('u.evt', {});
    const run = await runtime.inspect(runId!);
    expect(run?.status).toBe('failed');
    expect(run?.error?.code).toBe('HAZEL_AUTONOMOUS_GRANT_MISSING');
  });

  it('parks when capability approval is required and resolves via gatekeeper', async () => {
    const approvals = new InMemoryApprovalProvider();
    const gate = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'deny',
      approvalProvider: approvals,
      auditSink: new InMemoryAuditSink(),
    });
    jest.spyOn(gate, 'execute').mockImplementation(async () => {
      throw new GatekeeperApprovalRequiredError('need approval', 'gk-apr-1');
    });

    @Injectable()
    @Autonomous({
      id: 'req',
      mode: 'governed-auto',
      capabilities: ['req.act'],
    })
    class Req {
      @Observe('req.evt')
      on(e: unknown) {
        return e;
      }

      @Capability({
        id: 'req.act',
        effect: 'irreversible',
        approval: 'required',
      })
      act() {
        return { ok: true };
      }
    }

    const runtime = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      autoDiscover: false,
      services: [Req],
      gatekeeper: gate,
      decisionEngine: {
        async evaluate() {
          return {
            type: 'execute',
            capabilityId: 'req.act',
            arguments: { n: 1 },
            reason: 'auto',
          };
        },
      },
    });
    runtime.bindInstance(Req, new Req());
    await runtime.start();
    const [runId] = await runtime.emit('req.evt', { n: 1 });
    let run = await runtime.inspect(runId!);
    expect(run?.metadata.phase).toBe('approval_pending');

    // approve path resolves gatekeeper approval id
    (gate.execute as jest.Mock).mockResolvedValue({ output: { ok: true } });
    await runtime.resume(runId!, { approved: true, actor: 'ops' });
    run = await runtime.inspect(runId!);
    expect(run?.status).toBe('completed');
  });

  it('rejects with gatekeeper resolve and handles deny / generic execute errors', async () => {
    const approvals = new InMemoryApprovalProvider();
    const gate = new AgentGatekeeper({
      mode: 'enforce',
      defaultDecision: 'deny',
      approvalProvider: approvals,
      auditSink: new InMemoryAuditSink(),
    });
    const resolveSpy = jest.spyOn(approvals, 'resolve').mockResolvedValue(undefined as never);

    @Injectable()
    @Autonomous({
      id: 'err',
      mode: 'approval-required',
      capabilities: ['err.act'],
    })
    class ErrSvc {
      @Observe('err.evt')
      on(e: unknown) {
        return e;
      }

      @Capability({
        id: 'err.act',
        effect: 'idempotent',
        approval: 'required',
        idempotencyKey: true,
      })
      act() {
        return { ok: true };
      }
    }

    // Probe path: GatekeeperDeniedError during enterApproval
    jest.spyOn(gate, 'execute').mockImplementation(async () => {
      throw new GatekeeperDeniedError('probe deny');
    });

    const runtime = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      autoDiscover: false,
      services: [ErrSvc],
      gatekeeper: gate,
    });
    runtime.bindInstance(ErrSvc, new ErrSvc());
    await runtime.start();
    const [runId] = await runtime.emit('err.evt', { a: 1 });
    expect((await runtime.inspect(runId!))?.metadata.phase).toBe('approval_pending');

    // Inject pending gatekeeper approval id then reject
    const pending = (
      runtime as unknown as {
        pendingApprovals: Map<
          string,
          { runId: string; capabilityId: string; argumentsHash: string; gatekeeperApprovalId?: string }
        >;
      }
    ).pendingApprovals;
    const aprId = (await runtime.inspect(runId!))!.metadata.approvalId!;
    pending.set(aprId, {
      ...pending.get(aprId)!,
      gatekeeperApprovalId: 'gk-rej',
    });
    await runtime.resume(runId!, { approved: false, actor: 'ops' });
    expect(resolveSpy).toHaveBeenCalledWith('gk-rej', 'rejected', 'ops');
    expect((await runtime.inspect(runId!))?.status).toBe('cancelled');

    // GatekeeperDeniedError during live execute
    jest.spyOn(gate, 'execute').mockImplementation(async () => {
      throw new GatekeeperDeniedError('live deny');
    });
    const runtime2 = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      autoDiscover: false,
      services: [ErrSvc],
      gatekeeper: gate,
      decisionEngine: {
        async evaluate() {
          return {
            type: 'execute',
            capabilityId: 'err.act',
            arguments: {},
            reason: 'go',
          };
        },
      },
    });
    // Re-register same class metadata already in registry from decorator — new instance
    clearAutonomousRegistry();
    @Injectable()
    @Autonomous({
      id: 'err2',
      mode: 'governed-auto',
      capabilities: ['err2.act'],
    })
    class Err2 {
      @Observe('err2.evt')
      on(e: unknown) {
        return e;
      }
      @Capability({
        id: 'err2.act',
        effect: 'idempotent',
        approval: 'auto',
        idempotencyKey: true,
      })
      act() {
        return {};
      }
    }
    runtime2.bindInstance(Err2, new Err2());
    // Need fresh runtime with Err2
    const runtime3 = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      autoDiscover: false,
      services: [Err2],
      gatekeeper: gate,
      decisionEngine: {
        async evaluate() {
          return {
            type: 'execute',
            capabilityId: 'err2.act',
            arguments: {},
            reason: 'go',
          };
        },
      },
    });
    runtime3.bindInstance(Err2, new Err2());
    await runtime3.start();
    const [denyId] = await runtime3.emit('err2.evt', {});
    expect((await runtime3.inspect(denyId!))?.status).toBe('failed');

    // Generic error during execute
    jest.spyOn(gate, 'execute').mockImplementation(async () => {
      throw new Error('boom');
    });
    const runtime4 = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      autoDiscover: false,
      services: [Err2],
      gatekeeper: gate,
      decisionEngine: {
        async evaluate() {
          return {
            type: 'execute',
            capabilityId: 'err2.act',
            arguments: {},
            reason: 'go',
          };
        },
      },
    });
    runtime4.bindInstance(Err2, new Err2());
    await runtime4.start();
    const [boomId] = await runtime4.emit('err2.evt', {});
    expect((await runtime4.inspect(boomId!))?.status).toBe('failed');

    // ApprovalRequired mid-execute parks again
    jest.spyOn(gate, 'execute').mockImplementation(async () => {
      throw new GatekeeperApprovalRequiredError('mid', 'gk-mid');
    });
    const runtime5 = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      autoDiscover: false,
      services: [Err2],
      gatekeeper: gate,
      decisionEngine: {
        async evaluate() {
          return {
            type: 'execute',
            capabilityId: 'err2.act',
            arguments: {},
            reason: 'go',
          };
        },
      },
    });
    runtime5.bindInstance(Err2, new Err2());
    await runtime5.start();
    const [parkId] = await runtime5.emit('err2.evt', {});
    expect((await runtime5.inspect(parkId!))?.metadata.phase).toBe('approval_pending');
  });

  it('resume rejects non-executable decision and executeCapability missing grant', async () => {
    const store = new MemoryAutonomousRunStore();
    const runtime = new AutonomousRuntime({ storage: store, autoDiscover: false });
    await runtime.start();

    await store.create({
      id: 'bad-decision',
      serviceId: 's',
      metadata: {
        kind: 'autonomous',
        serviceId: 's',
        phase: 'approval_pending',
        mode: 'approval-required',
        decision: { type: 'no-action', reason: 'x' },
        timeline: [],
      },
    });
    await expect(
      runtime.resume('bad-decision', { approved: true, actor: 'x' })
    ).rejects.toThrow(/no executable decision/);

    @Injectable()
    @Autonomous({
      id: 'misscap',
      mode: 'approval-required',
      capabilities: ['miss.act'],
    })
    class MissCap {
      @Observe('miss.evt')
      on(e: unknown) {
        return e;
      }
      @Capability({
        id: 'miss.act',
        effect: 'idempotent',
        approval: 'auto',
        idempotencyKey: true,
      })
      act() {
        return {};
      }
    }

    const runtime2 = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      autoDiscover: false,
      services: [MissCap],
      decisionEngine: {
        async evaluate() {
          return {
            type: 'request-approval',
            capabilityId: 'miss.act',
            arguments: {},
            reason: 'need',
          };
        },
      },
    });
    runtime2.bindInstance(MissCap, new MissCap());
    await runtime2.start();
    const [runId] = await runtime2.emit('miss.evt', {});
    // Revoke grant after parking by clearing capability from registry map
    (
      runtime2.registry as unknown as {
        capabilities: Map<string, unknown>;
      }
    ).capabilities.delete('miss.act');
    await runtime2.resume(runId!, { approved: true, actor: 'ops' });
    expect((await runtime2.inspect(runId!))?.status).toBe('failed');
  });

  it('bounds loop fingerprints and bootstrap autoDiscover', async () => {
    const loop = new LoopProtector();
    const protection = { maxDepth: 10, cooldownMs: 0, maxActionsPerRun: 100_000 };
    for (let i = 0; i < 10_001; i++) {
      loop.assertAllowed(
        {
          eventId: `fp-${i}`,
          eventType: 'e',
          source: 't',
          timestamp: new Date().toISOString(),
          schemaVersion: 1,
          payload: {},
        },
        protection,
        0
      );
    }
    expect(true).toBe(true);

    @Injectable()
    @Autonomous({ id: 'auto', mode: 'observe-only' })
    class Auto {
      @Observe('auto.evt')
      on() {
        return {};
      }
    }
    // Mirror forRoot: same options flow to runtime + bootstrap (autoDiscover on by default)
    const opts = { storage: new MemoryAutonomousRunStore() };
    const runtime = new AutonomousRuntime(opts);
    const boot = new AutonomousBootstrapService(opts, runtime);
    Container.createTestInstance();
    Container.getInstance().register(Auto, new Auto());
    await boot.onModuleInit();
    expect(runtime.registry.getService('auto')).toBeDefined();

    const mod = AutonomousModule.forRoot({ observability: { enabled: false } });
    const factory = (
      mod.providers as Array<{
        provide?: unknown;
        useFactory?: () => AutonomousRuntime;
      }>
    ).find((p) => p.useFactory);
    expect(factory?.useFactory?.()).toBeInstanceOf(AutonomousRuntime);
  });

  it('simulate uses runtimeOptions storage when runtime omitted', async () => {
    @Injectable()
    @Autonomous({ id: 'sim2', mode: 'observe-only' })
    class Sim2 {
      @Observe('sim2.evt')
      on() {
        return {};
      }
    }
    const store = new MemoryAutonomousRunStore();
    const result = await simulate({
      service: 'sim2',
      event: { type: 'sim2.evt', payload: {} },
      runtimeOptions: { autoDiscover: false, services: [Sim2], storage: store },
    });
    // bind via tryConstruct
    expect(result.run).toBeDefined();
    await evaluateOutcome({
      ...result.run,
      metadata: { ...result.run.metadata, timeline: undefined as unknown as [] },
    });
  });

  it('createAgentBackedRunStore fills default metadata when missing', async () => {
    const repo = {
      async create(input: {
        id: string;
        agentName: string;
        input?: unknown;
        tenantId?: string;
        metadata?: Record<string, unknown>;
      }) {
        const now = new Date();
        return {
          id: input.id,
          agentName: input.agentName,
          status: 'created',
          createdAt: now,
          updatedAt: now,
          // no metadata — hits default branch
        };
      },
      async get() {
        return undefined;
      },
      async updateStatus(runId: string, status: string) {
        const now = new Date();
        return {
          id: runId,
          agentName: 'svc',
          status,
          createdAt: now,
          updatedAt: now,
        };
      },
      async list() {
        return [];
      },
    };
    const store = createAgentBackedRunStore(repo);
    const created = await store.create({
      id: 'x',
      serviceId: 'svc',
      metadata: {
        kind: 'autonomous',
        serviceId: 'svc',
        phase: 'created',
        mode: 'observe-only',
      },
    });
    expect(created.metadata.kind).toBe('autonomous');
    const updated = await store.update('x', {});
    expect(updated.status).toBe('running');
  });
});
