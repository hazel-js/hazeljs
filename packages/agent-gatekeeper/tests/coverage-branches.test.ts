/**
 * Branch coverage for governed + setup paths that the happy-path suite skips.
 */
import { z } from 'zod';
import { AgentGatekeeper } from '../src/gatekeeper';
import { InMemoryApprovalProvider, buildApprovalRequest } from '../src/approval/provider';
import { InMemoryAuditSink } from '../src/audit/sink';
import {
  assertGovernedManifest,
  createGovernedRuntime,
  createGovernedToolExecutor,
  createOpenAiAgentsRuntimeAdapter,
  DelegationService,
  FakeRedisLockClient,
  GovernedCapabilityError,
  LocalRuntimeAdapter,
  MemoryBudgetCounter,
  MemoryDelegationStore,
  MemoryDistributedLock,
  MemoryGovernedRunStore,
  MemoryToolAttemptLedger,
  RedisDistributedLock,
  RedisToolAttemptLedger,
  requestCancel,
  withGovernedApproval,
} from '../src/governed';
import type { ProtectedTool, TrustedCallerContext } from '../src';
import {
  createAgentGatekeeperBundle,
  findApprovedHumanTaskToken,
  formatGatekeeperBootLine,
  resolveAuditSink,
  resolveLiveToolMethod,
  resumeGatekeeperDecision,
  shortToolName,
  tryCreateRedisApprovalProvider,
  wireDemoHitlAutoApprove,
  bindGatekeeper,
} from '../src/setup';

const echoTool: ProtectedTool = {
  name: 'echo',
  inputSchema: z.object({ value: z.string() }),
  classification: 'read',
  execute: async (input) => input,
};

function caller(overrides: Partial<TrustedCallerContext> = {}): TrustedCallerContext {
  return {
    tenantId: 't1',
    actorId: 'agent-1',
    runId: 'run-1',
    capabilities: ['echo'],
    policyVersion: 'pol-1',
    environment: 'test',
    ...overrides,
  };
}

describe('governed branch coverage', () => {
  it('rejects hostedShell manifests', () => {
    expect(() =>
      assertGovernedManifest({
        start: true,
        status: true,
        cancel: true,
        events: true,
        resume: true,
        toolMediation: true,
        approvalContinuation: true,
        hostedComputerUse: false,
        hostedShell: true,
      })
    ).toThrow(GovernedCapabilityError);
  });

  it('LocalRuntimeAdapter status/cancel for unknown and cancelled sessions', async () => {
    const adapter = new LocalRuntimeAdapter();
    expect(await adapter.status('missing')).toEqual({
      alive: false,
      detail: 'unknown session',
    });
    expect(await adapter.cancel('missing')).toEqual({ acknowledged: false });

    const { providerSessionId } = await adapter.start({ caller: caller(), input: {} });
    expect(await adapter.status(providerSessionId)).toMatchObject({
      alive: true,
      detail: 'running',
    });
    expect(await adapter.cancel(providerSessionId)).toEqual({ acknowledged: true });
    expect(await adapter.status(providerSessionId)).toMatchObject({
      alive: false,
      detail: 'cancelled',
    });
  });

  it('OpenAI adapter status/cancel and live-disabled after SDK load attempt', async () => {
    const adapter = createOpenAiAgentsRuntimeAdapter();
    expect(await adapter.status('x')).toMatchObject({ alive: false });
    expect(await adapter.cancel('x')).toEqual({ acknowledged: false });

    const prevLive = process.env.HAZEL_OPENAI_AGENTS_LIVE;
    const prevKey = process.env.OPENAI_API_KEY;
    process.env.HAZEL_OPENAI_AGENTS_LIVE = '1';
    process.env.OPENAI_API_KEY = 'sk-test';
    await expect(adapter.start({ caller: caller(), input: {} })).rejects.toMatchObject({
      code: 'EXTERNAL_RUNTIME_UNAVAILABLE',
    });
    if (prevLive === undefined) delete process.env.HAZEL_OPENAI_AGENTS_LIVE;
    else process.env.HAZEL_OPENAI_AGENTS_LIVE = prevLive;
    if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevKey;
  });

  it('denies unknown tools, policy deny, and dispatch failures', async () => {
    const approvals = new InMemoryApprovalProvider();
    const lock = new MemoryDistributedLock();
    const ledger = new MemoryToolAttemptLedger(lock);
    const gatekeeper = new AgentGatekeeper({
      policies: [
        {
          id: 'deny-echo',
          version: '1',
          match: { tools: ['echo'] },
          rules: { denyWhen: () => true },
        },
      ],
      approvalProvider: approvals,
      mode: 'enforce',
      defaultDecision: 'deny',
    });
    const executor = createGovernedToolExecutor({
      gatekeeper,
      approvals,
      lock,
      ledger,
      tools: new Map([[echoTool.name, echoTool]]),
      dispatch: async () => {
        throw new Error('boom');
      },
    });

    const unknown = await executor.execute(caller(), {
      toolName: 'missing',
      input: {},
      idempotencyKey: 'u1',
    });
    expect(unknown.outcome).toBe('denied');

    const denied = await executor.execute(caller(), {
      toolName: 'echo',
      input: { value: 'x' },
      idempotencyKey: 'd1',
      classification: 'read',
    });
    expect(denied.outcome).toBe('denied');

    const allowGk = new AgentGatekeeper({
      policies: [
        {
          id: 'allow',
          version: '1',
          match: { tools: ['echo'] },
          rules: { allowWhen: () => true },
        },
      ],
      approvalProvider: approvals,
      mode: 'enforce',
      defaultDecision: 'deny',
    });
    const failing = createGovernedToolExecutor({
      gatekeeper: allowGk,
      approvals,
      lock,
      ledger: new MemoryToolAttemptLedger(lock),
      tools: new Map([[echoTool.name, echoTool]]),
      dispatch: async () => {
        throw new Error('upstream failed');
      },
    });
    const failed = await failing.execute(caller(), {
      toolName: 'echo',
      input: { value: 'x' },
      idempotencyKey: 'fail-1',
      classification: 'read',
    });
    expect(failed.outcome).toBe('failed');
    expect(failed.reason).toContain('upstream failed');

    // Prior failed attempt → failed without re-dispatch
    const again = await failing.execute(caller(), {
      toolName: 'echo',
      input: { value: 'x' },
      idempotencyKey: 'fail-1',
      classification: 'read',
    });
    expect(again.outcome).toBe('failed');
  });

  it('returns unknown when prior attempt is still dispatched', async () => {
    const approvals = new InMemoryApprovalProvider();
    const lock = new MemoryDistributedLock();
    const ledger = new MemoryToolAttemptLedger(lock);
    await ledger.beginDispatch({
      idempotencyKey: 'inflight',
      tenantId: 't1',
      runId: 'run-1',
      toolName: 'echo',
      argumentDigest: 'd',
      status: 'dispatched',
    });
    const executor = createGovernedToolExecutor({
      gatekeeper: new AgentGatekeeper({
        policies: [
          {
            id: 'allow',
            version: '1',
            match: { tools: ['echo'] },
            rules: { allowWhen: () => true },
          },
        ],
        approvalProvider: approvals,
        mode: 'enforce',
        defaultDecision: 'deny',
      }),
      approvals,
      lock,
      ledger,
      tools: new Map([[echoTool.name, echoTool]]),
      dispatch: async () => ({ ok: true }),
    });
    const result = await executor.execute(caller(), {
      toolName: 'echo',
      input: { value: 'x' },
      idempotencyKey: 'inflight',
      classification: 'read',
    });
    expect(result.outcome).toBe('unknown');
  });

  it('runtime status marks unknown when provider session dies; cancel without ack', async () => {
    const adapter = new LocalRuntimeAdapter();
    const runStore = new MemoryGovernedRunStore();
    const approvals = new InMemoryApprovalProvider();
    const lock = new MemoryDistributedLock();
    const runtime = createGovernedRuntime({
      adapter,
      runStore,
      toolExecutor: createGovernedToolExecutor({
        gatekeeper: new AgentGatekeeper({
          policies: [],
          approvalProvider: approvals,
          mode: 'enforce',
          defaultDecision: 'allow',
        }),
        approvals,
        lock,
        ledger: new MemoryToolAttemptLedger(lock),
        tools: new Map(),
        dispatch: async () => ({}),
      }),
    });

    expect(await runtime.status('missing')).toBeUndefined();
    expect(await runtime.requestCancel('missing')).toBeUndefined();

    const record = await runtime.start(caller({ runId: 'run-status' }), {});
    // Point at a fake session so status() reports not alive.
    await runStore.update('run-status', { providerSessionId: 'gone' });
    const marked = await runtime.status('run-status');
    expect(marked?.status).toBe('unknown');

    // Adapter that never acknowledges cancel
    const noAck = {
      name: 'no-ack',
      manifest: adapter.manifest,
      start: async () => ({ providerSessionId: 's1' }),
      status: async () => ({ alive: true }),
      cancel: async () => ({ acknowledged: false }),
    };
    const runtime2 = createGovernedRuntime({
      adapter: noAck,
      runStore: new MemoryGovernedRunStore(),
      toolExecutor: createGovernedToolExecutor({
        gatekeeper: new AgentGatekeeper({
          policies: [],
          approvalProvider: approvals,
          mode: 'enforce',
          defaultDecision: 'allow',
        }),
        approvals,
        lock,
        ledger: new MemoryToolAttemptLedger(lock),
        tools: new Map(),
        dispatch: async () => ({}),
      }),
    });
    await runtime2.start(caller({ runId: 'run-noack' }), {});
    const cancelled = await runtime2.requestCancel('run-noack');
    expect(cancelled?.cancelState).toBe('requested');
    expect(cancelled?.status).toBe('cancel_requested');

    await runtime2.executeTool(caller({ runId: 'run-noack' }), {
      toolName: 'missing',
      input: {},
      idempotencyKey: 'x',
    });

    expect(
      requestCancel({
        runId: 'r',
        tenantId: 't',
        actorId: 'a',
        adapter: 'local',
        status: 'cancelled',
        cancelState: 'acknowledged',
        policyVersion: 'p',
        capabilities: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }).cancelState
    ).toBe('acknowledged');

    void record;
  });

  it('delegation depth, concurrency, charge, and store helpers', async () => {
    const store = new MemoryDelegationStore();
    const budgets = new MemoryBudgetCounter();
    const lock = new MemoryDistributedLock();
    const svc = new DelegationService(store, budgets, lock);

    await expect(
      svc.issueDelegation({
        parent: {
          tenantId: 't1',
          actorId: 'a1',
          runId: 'run-1',
          capabilities: ['order.read'],
          depth: 2,
        },
        capabilities: ['order.read'],
        budgetUsd: 1,
        maxDepth: 2,
      })
    ).rejects.toThrow(/depth/);

    const g1 = await svc.issueDelegation({
      parent: {
        tenantId: 't1',
        actorId: 'a1',
        runId: 'run-conc',
        capabilities: ['*'],
        depth: 0,
      },
      capabilities: ['order.read'],
      budgetUsd: 5,
      maxConcurrency: 1,
    });
    await expect(
      svc.issueDelegation({
        parent: {
          tenantId: 't1',
          actorId: 'a1',
          runId: 'run-conc',
          capabilities: ['*'],
          depth: 0,
        },
        capabilities: ['order.read'],
        budgetUsd: 5,
        maxConcurrency: 1,
      })
    ).rejects.toThrow(/concurrency/);

    expect(await store.get('missing')).toBeUndefined();
    expect(await store.updateSpent('missing', 1)).toBeUndefined();

    const charged = await svc.charge(g1.grantId, 1);
    expect(charged.spentUsd).toBe(1);
    await expect(svc.charge(g1.grantId, 10)).rejects.toThrow(/budget/);
    await expect(svc.charge('missing', 1)).rejects.toThrow(/not found/);

    // Budget counter expiry
    await budgets.incr('k', 1, 1);
    await new Promise((r) => setTimeout(r, 5));
    expect(await budgets.get('k')).toBe(0);
    expect(await budgets.incr('k', 2, 60_000)).toBe(2);
    expect(await budgets.incr('k', 1, 60_000)).toBe(3);
  });

  it('governed approval lock fail, actor mismatch, and redis ledger edges', async () => {
    const approvals = new InMemoryApprovalProvider();
    const lock = new MemoryDistributedLock();
    const governed = withGovernedApproval(approvals, lock);

    const held = await lock.acquire('approval:busy', 5_000);
    expect(held).not.toBeNull();
    const lockedOut = await governed.consumeGoverned({
      approvalId: 'busy',
      fingerprint: 'fp',
    });
    expect(lockedOut.valid).toBe(false);
    expect(lockedOut.reason).toMatch(/lock/);
    await held!.release();

    const req = buildApprovalRequest(
      {
        invocationId: 'inv',
        runId: 'run',
        agentId: 'governed-runtime',
        tenantId: 't1',
        delegatedUserId: 'agent-1',
        toolName: 'echo',
        input: { value: 'x' },
        reason: 'hitl',
        policyIds: ['p'],
        policyVersions: ['pol-1'],
        riskClassification: 'medium',
        idempotencyKey: 'idem-a',
      },
      { now: () => new Date() },
      () => 'apr-actor',
      60_000
    );
    const stored = await governed.createGoverned(req, { actorId: 'agent-1', argumentDigest: 'd1' });
    await approvals.resolve(stored.approvalId, 'approved');
    const mismatch = await governed.consumeGoverned({
      approvalId: stored.approvalId,
      fingerprint: stored.invocationFingerprint,
      actorId: 'other-actor',
      argumentDigest: 'd1',
    });
    expect(mismatch.valid).toBe(false);
    expect(mismatch.reason).toMatch(/actor/);

    // Memory lock: second acquire while held returns null
    const a = await lock.acquire('same', 5_000);
    expect(await lock.acquire('same', 5_000)).toBeNull();
    await a!.release();

    const redis = new FakeRedisLockClient();
    const rlock = new RedisDistributedLock(redis);
    const ledger = new RedisToolAttemptLedger(redis, rlock);
    // Corrupt JSON deserialize path
    await redis.set('hazel:tool-attempt:bad', 'not-json');
    expect(await ledger.get('bad')).toBeUndefined();

    // Lock fail with no existing → throw
    const blocking = await rlock.acquire('attempt:locked-key', 5_000);
    expect(blocking).not.toBeNull();
    await expect(
      ledger.beginDispatch({
        idempotencyKey: 'locked-key',
        tenantId: 't1',
        runId: 'r',
        toolName: 'echo',
        argumentDigest: 'd',
      })
    ).rejects.toThrow(/lock/);
    await blocking!.release();

    // Redis lock without eval uses del path
    const redisNoEval: {
      data: Map<string, { value: string }>;
      set: FakeRedisLockClient['set'];
      del: FakeRedisLockClient['del'];
    } = {
      data: new Map(),
      set: async (key, value, ...args) => {
        let nx = false;
        for (const a of args) if (a === 'NX') nx = true;
        if (nx && redisNoEval.data.has(key)) return null;
        redisNoEval.data.set(key, { value });
        return 'OK';
      },
      del: async (...keys) => {
        let n = 0;
        for (const k of keys) if (redisNoEval.data.delete(k)) n += 1;
        return n;
      },
    };
    const lock2 = new RedisDistributedLock(redisNoEval);
    const h = await lock2.acquire('k', 1000);
    expect(h).not.toBeNull();
    await h!.release();
  });
});

describe('setup branch coverage', () => {
  it('bundle custom approval, humanTasks, auditSink, disabled boot line', () => {
    const custom = new InMemoryApprovalProvider();
    const customBundle = createAgentGatekeeperBundle({
      policies: [],
      approvalProvider: custom,
      auditSink: new InMemoryAuditSink(),
    });
    expect(customBundle.approvalBackend).toBe('custom');
    expect(customBundle.auditBackend).toBe('custom');

    const ht = {
      create: async () => ({ id: 'ht-1' }),
      get: async () => undefined,
      listByRun: async () => [],
      complete: async () => undefined,
      fail: async () => undefined,
    };
    const htBundle = createAgentGatekeeperBundle({
      policies: [],
      humanTasks: ht as never,
      audit: { testMode: true },
    });
    expect(htBundle.approvalBackend).toBe('human-task');

    const off = createAgentGatekeeperBundle({
      policies: [],
      enabled: false,
      audit: { testMode: true },
    });
    expect(formatGatekeeperBootLine(off)).toContain('off');
  });

  it('tryCreateRedisApprovalProvider missing package and empty url', () => {
    expect(tryCreateRedisApprovalProvider({})).toBeUndefined();
    let missing = false;
    const result = tryCreateRedisApprovalProvider({
      url: 'redis://localhost:6379',
      onMissingRedisPackage: () => {
        missing = true;
      },
    });
    // redis may or may not be installed; either undefined+callback or a provider.
    if (!result) expect(missing).toBe(true);
  });

  it('resolveAuditSink production paths', () => {
    const { backend } = resolveAuditSink({
      testMode: false,
      console: false,
      otel: false,
    });
    expect(backend).toBe('memory');

    const withConsole = resolveAuditSink({
      testMode: false,
      console: true,
      otel: false,
      extra: [new InMemoryAuditSink()],
    });
    expect(withConsole.backend).toContain('console');
    expect(withConsole.backend).toContain('extra');
  });

  it('findApprovedHumanTaskToken and resolveLiveToolMethod', async () => {
    expect(shortToolName('a.b.tool')).toBe('tool');
    expect(shortToolName('tool')).toBe('tool');
    expect(
      await findApprovedHumanTaskToken(undefined, {
        runId: 'r',
        agentId: 'a',
        toolName: 'processRefund',
        args: {},
      })
    ).toBeUndefined();

    const token = await findApprovedHumanTaskToken(
      {
        listByRun: async () => [
          {
            id: 'task-1',
            status: 'approved',
            toolName: 'processRefund',
            payload: {
              gatekeeperRequest: {
                approvalId: 'apr-1',
                toolName: 'processRefund',
                status: 'approved',
              },
            },
          },
          {
            id: 'task-2',
            payload: { gatekeeperRequest: 'bad' },
          },
          {
            id: 'task-3',
            toolName: 'other',
            payload: { gatekeeperRequest: { toolName: 'other', status: 'approved' } },
          },
        ],
      },
      {
        runId: 'r',
        agentId: 'a',
        toolName: 'commerce.processRefund',
        args: { orderId: 'o1' },
        tenantId: 't1',
      }
    );
    expect(token).toBe('apr-1');

    const target = {
      go: () => 'via-key',
    };
    const viaKey = resolveLiveToolMethod({
      target,
      propertyKey: 'go',
      method: () => 'via-method',
    } as never);
    expect(viaKey()).toBe('via-key');
    const viaMethod = resolveLiveToolMethod({
      target: {},
      method: () => 'via-method',
    } as never);
    expect(viaMethod()).toBe('via-method');
  });

  it('wireDemoHitlAutoApprove and resume reject path', async () => {
    const events: Array<(e: unknown) => void> = [];
    const runtime = {
      approveToolExecution: () => {
        throw new Error('no waiter');
      },
      rejectToolExecution: () => undefined,
      approveAndResume: async () => ({ ok: true }),
      on: (_name: string, handler: (e: unknown) => void) => {
        events.push(handler);
      },
    };

    wireDemoHitlAutoApprove(runtime, { env: { AGENT_OS_HITL: '1' } });
    expect(events).toHaveLength(0);

    wireDemoHitlAutoApprove(runtime, { env: {} });
    expect(events).toHaveLength(1);
    events[0]({ data: {} }); // no requestId — no-op
    events[0]({ data: { requestId: 'req-x' } });

    wireDemoHitlAutoApprove({ ...runtime, on: undefined } as never);

    const bundle = createAgentGatekeeperBundle({
      policies: [],
      audit: { testMode: true },
    });
    bindGatekeeper(runtime, bundle);
    const now = new Date();
    await bundle.approvalProvider.create({
      approvalId: 'rej-1',
      invocationId: 'i',
      runId: 'run-rej',
      agentId: 'a',
      toolName: 't',
      argumentSummary: {},
      reason: 'r',
      policyIds: [],
      policyVersions: [],
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
      riskClassification: 'low',
      idempotencyKey: 'k',
      invocationFingerprint: 'fp',
      status: 'pending',
    });
    await resumeGatekeeperDecision(runtime, 'rej-1', 'rejected', 'ops');
  });
});
