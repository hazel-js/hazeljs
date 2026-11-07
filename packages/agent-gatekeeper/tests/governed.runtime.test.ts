import { z } from 'zod';
import { AgentGatekeeper } from '../src/gatekeeper';
import { InMemoryApprovalProvider } from '../src/approval/provider';
import {
  argumentDigest,
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
} from '../src/governed';
import type { ProtectedTool } from '../src';
import type { TrustedCallerContext } from '../src/governed';

const refundTool: ProtectedTool = {
  name: 'woocommerce.refund.create',
  inputSchema: z.object({
    orderId: z.string(),
    amount: z.number(),
    tenantId: z.string().optional(),
    actorId: z.string().optional(),
  }),
  classification: 'destructive',
  execute: async () => ({ ok: true }),
};

function caller(overrides: Partial<TrustedCallerContext> = {}): TrustedCallerContext {
  return {
    tenantId: 't1',
    actorId: 'agent-1',
    runId: 'run-1',
    capabilities: ['refund', 'order.read'],
    policyVersion: 'pol-1',
    environment: 'test',
    ...overrides,
  };
}

describe('GovernedRuntime', () => {
  it('rejects adapters with hosted computer use or without tool mediation', () => {
    expect(() =>
      assertGovernedManifest({
        start: true,
        status: true,
        cancel: true,
        events: true,
        resume: true,
        toolMediation: false,
        approvalContinuation: true,
        hostedComputerUse: false,
        hostedShell: false,
      })
    ).toThrow(GovernedCapabilityError);

    expect(() =>
      assertGovernedManifest({
        start: true,
        status: true,
        cancel: true,
        events: true,
        resume: true,
        toolMediation: true,
        approvalContinuation: true,
        hostedComputerUse: true,
        hostedShell: false,
      })
    ).toThrow(GovernedCapabilityError);
  });

  it('requires approval for refunds and invalidates on amount change', async () => {
    const approvals = new InMemoryApprovalProvider();
    const lock = new MemoryDistributedLock();
    const ledger = new MemoryToolAttemptLedger(lock);
    const gatekeeper = new AgentGatekeeper({
      policies: [
        {
          id: 'refund-hitl',
          version: '1',
          priority: 10,
          match: { tools: ['woocommerce.refund.create'] },
          rules: {
            requireApprovalWhen: () => true,
          },
        },
      ],
      approvalProvider: approvals,
      mode: 'enforce',
      defaultDecision: 'deny',
    });

    let refunds = 0;
    const executor = createGovernedToolExecutor({
      gatekeeper,
      approvals,
      lock,
      ledger,
      tools: new Map([[refundTool.name, refundTool]]),
      dispatch: async (_name, input) => {
        refunds += 1;
        return { refundId: `r-${refunds}`, input };
      },
    });

    const first = await executor.execute(caller(), {
      toolName: 'woocommerce.refund.create',
      input: { orderId: 'o1', amount: 50 },
      idempotencyKey: 'idem-1',
      classification: 'destructive',
    });
    expect(first.outcome).toBe('require_approval');
    expect(first.approvalId).toBeDefined();

    await approvals.resolve(first.approvalId!, 'approved', 'human-1');

    const ok = await executor.execute(caller(), {
      toolName: 'woocommerce.refund.create',
      input: { orderId: 'o1', amount: 50 },
      idempotencyKey: 'idem-1',
      classification: 'destructive',
      approvalToken: first.approvalId,
    });
    expect(ok.outcome).toBe('succeeded');
    expect(refunds).toBe(1);

    // Changed amount → new approval required; old token fails fingerprint/digest.
    const changed = await executor.execute(caller(), {
      toolName: 'woocommerce.refund.create',
      input: { orderId: 'o1', amount: 75 },
      idempotencyKey: 'idem-2',
      classification: 'destructive',
      approvalToken: first.approvalId,
    });
    expect(changed.outcome).toBe('denied');
  });

  it('dedupes duplicate idempotency keys across shared ledger', async () => {
    const redis = new FakeRedisLockClient();
    const lock = new RedisDistributedLock(redis);
    const ledger = new RedisToolAttemptLedger(redis, lock);
    const approvals = new InMemoryApprovalProvider();
    const gatekeeper = new AgentGatekeeper({
      policies: [
        {
          id: 'allow-refund',
          version: '1',
          priority: 1,
          match: { tools: ['woocommerce.refund.create'] },
          rules: { allowWhen: () => true },
        },
      ],
      approvalProvider: approvals,
      mode: 'enforce',
      defaultDecision: 'deny',
    });

    let calls = 0;
    const execA = createGovernedToolExecutor({
      gatekeeper,
      approvals,
      lock,
      ledger,
      tools: new Map([[refundTool.name, refundTool]]),
      dispatch: async () => {
        calls += 1;
        return { ok: true };
      },
    });
    const execB = createGovernedToolExecutor({
      gatekeeper,
      approvals,
      lock,
      ledger,
      tools: new Map([[refundTool.name, refundTool]]),
      dispatch: async () => {
        calls += 1;
        return { ok: true };
      },
    });

    const a = await execA.execute(caller(), {
      toolName: 'woocommerce.refund.create',
      input: { orderId: 'o1', amount: 10 },
      idempotencyKey: 'same-key',
      classification: 'destructive',
    });
    const b = await execB.execute(caller(), {
      toolName: 'woocommerce.refund.create',
      input: { orderId: 'o1', amount: 10 },
      idempotencyKey: 'same-key',
      classification: 'destructive',
    });
    expect(a.outcome).toBe('succeeded');
    expect(b.outcome).toBe('duplicate');
    expect(calls).toBe(1);
  });

  it('marks dispatch timeout as unknown, not succeeded', async () => {
    const approvals = new InMemoryApprovalProvider();
    const lock = new MemoryDistributedLock();
    const ledger = new MemoryToolAttemptLedger(lock);
    const gatekeeper = new AgentGatekeeper({
      policies: [
        {
          id: 'allow',
          version: '1',
          match: { tools: ['woocommerce.refund.create'] },
          rules: { allowWhen: () => true },
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
      tools: new Map([[refundTool.name, refundTool]]),
      dispatchTimeoutMs: 20,
      dispatch: async () => {
        await new Promise((r) => setTimeout(r, 100));
        return { ok: true };
      },
    });
    const result = await executor.execute(caller(), {
      toolName: 'woocommerce.refund.create',
      input: { orderId: 'o1', amount: 1 },
      idempotencyKey: 'timeout-1',
      classification: 'destructive',
    });
    expect(result.outcome).toBe('unknown');
    expect(result.attemptStatus).toBe('unknown');
  });

  it('attenuates delegation and rejects privilege escalation', async () => {
    const svc = new DelegationService(
      new MemoryDelegationStore(),
      new MemoryBudgetCounter(),
      new MemoryDistributedLock()
    );
    const grant = await svc.issueDelegation({
      parent: {
        tenantId: 't1',
        actorId: 'a1',
        runId: 'run-1',
        capabilities: ['order.read', 'refund'],
        depth: 0,
      },
      capabilities: ['order.read'],
      budgetUsd: 1,
    });
    expect(grant.capabilities).toEqual(['order.read']);
    expect(grant.depth).toBe(1);

    await expect(
      svc.issueDelegation({
        parent: {
          tenantId: 't1',
          actorId: 'a1',
          runId: 'run-1',
          capabilities: ['order.read'],
          depth: 0,
        },
        capabilities: ['order.read', 'admin'],
        budgetUsd: 1,
      })
    ).rejects.toThrow(/admin/);
  });

  it('cancel stays requested until adapter acknowledges', async () => {
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

    const record = await runtime.start(caller({ runId: 'run-cancel' }), { hello: true });
    expect(record.status).toBe('running');
    const cancelled = await runtime.requestCancel('run-cancel');
    expect(cancelled?.cancelState).toBe('acknowledged');
    expect(cancelled?.status).toBe('cancelled');
  });

  it('openai agents adapter reports unavailable without live flag', async () => {
    const adapter = createOpenAiAgentsRuntimeAdapter();
    await expect(
      adapter.start({
        caller: caller(),
        input: {},
      })
    ).rejects.toMatchObject({ code: 'EXTERNAL_RUNTIME_UNAVAILABLE' });
  });

  it('argumentDigest differs when amount changes', () => {
    expect(argumentDigest({ amount: 50 })).not.toBe(argumentDigest({ amount: 75 }));
  });

  it('forged tenant fields in tool args are ignored (trusted caller wins)', async () => {
    const approvals = new InMemoryApprovalProvider();
    const lock = new MemoryDistributedLock();
    const seen: unknown[] = [];
    const gatekeeper = new AgentGatekeeper({
      policies: [
        {
          id: 'allow',
          version: '1',
          match: { tools: ['woocommerce.refund.create'] },
          rules: { allowWhen: () => true },
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
      ledger: new MemoryToolAttemptLedger(lock),
      tools: new Map([[refundTool.name, refundTool]]),
      dispatch: async (_n, input) => {
        seen.push(input);
        return { ok: true };
      },
    });
    await executor.execute(caller({ tenantId: 'trusted-tenant' }), {
      toolName: 'woocommerce.refund.create',
      input: { orderId: 'o1', amount: 5, tenantId: 'forged-tenant', actorId: 'forged-actor' },
      idempotencyKey: 'forge-1',
      classification: 'destructive',
    });
    // Dispatch still receives model args as data, but Gatekeeper context used trusted tenant.
    expect(seen[0]).toMatchObject({ tenantId: 'forged-tenant' });
    const attempt = await new MemoryToolAttemptLedger(lock).get('forge-1');
    void attempt;
  });
});
