import 'reflect-metadata';
import {
  Injectable,
  Autonomous,
  Observe,
  Capability,
  clearAutonomousRegistry,
} from '@hazeljs/core';
import { AutonomousRuntime, MemoryAutonomousRunStore, RulesDecisionEngine } from '../src';

describe('AutonomousRuntime', () => {
  beforeEach(() => {
    clearAutonomousRegistry();
  });

  it('observe-only records a completed run without side effects', async () => {
    @Injectable()
    @Autonomous({ id: 'monitor', mode: 'observe-only', objective: 'Watch failures' })
    class Monitor {
      @Observe('orders.failed')
      onFailure(event: { orderId: string }) {
        return { orderId: event.orderId };
      }
    }

    const runtime = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      autoDiscover: false,
      services: [Monitor],
    });
    runtime.bindInstance(Monitor, new Monitor());
    await runtime.start();

    const [runId] = await runtime.emit('orders.failed', { orderId: 'o-1' }, { tenantId: 't1' });
    expect(runId).toBeDefined();
    const run = await runtime.inspect(runId!);
    expect(run?.status).toBe('completed');
    expect(run?.metadata.phase).toBe('completed');
    expect(run?.metadata.decision?.type).toBe('no-action');
    expect(run?.tenantId).toBe('t1');
  });

  it('governed-auto executes a granted idempotent capability via Gatekeeper', async () => {
    const calls: string[] = [];

    @Injectable()
    @Autonomous({
      id: 'order-ops',
      mode: 'governed-auto',
      capabilities: ['orders.retry'],
      objective: 'Recover failed orders',
    })
    class OrderOps {
      @Observe('orders.failed')
      onFailure(event: { orderId: string }) {
        return event;
      }

      @Capability({
        id: 'orders.retry',
        effect: 'idempotent',
        approval: 'auto',
        idempotencyKey: true,
      })
      async retry(input: { orderId: string }) {
        calls.push(input.orderId);
        return { retried: input.orderId };
      }
    }

    const runtime = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      decisionEngine: new RulesDecisionEngine(),
      autoDiscover: false,
      services: [OrderOps],
    });
    runtime.bindInstance(OrderOps, new OrderOps());
    await runtime.start();

    const [runId] = await runtime.emit('orders.failed', { orderId: 'ORD-9' });
    const run = await runtime.inspect(runId!);
    expect(run?.status).toBe('completed');
    expect(run?.metadata.effectStatus).toBe('succeeded');
    expect(calls).toEqual(['ORD-9']);
    expect(runtime.getMetrics().capabilitiesExecuted).toBe(1);
  });

  it('denies unregistered / ungranted capabilities', async () => {
    @Injectable()
    @Autonomous({
      id: 'locked',
      mode: 'governed-auto',
      capabilities: [], // default deny grants
    })
    class Locked {
      @Observe('orders.failed')
      onFailure(e: unknown) {
        return e;
      }

      @Capability({ id: 'orders.retry', effect: 'idempotent', approval: 'auto' })
      retry() {
        return { ok: true };
      }
    }

    const runtime = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      autoDiscover: false,
      services: [Locked],
    });
    runtime.bindInstance(Locked, new Locked());
    await runtime.start();

    const [runId] = await runtime.emit('orders.failed', { orderId: 'x' });
    const run = await runtime.inspect(runId!);
    // Rules engine returns no-action when no grants match
    expect(run?.metadata.decision?.type).toBe('no-action');
  });

  it('approval-required parks then resumes after approval', async () => {
    const calls: string[] = [];

    @Injectable()
    @Autonomous({
      id: 'shipping',
      mode: 'approval-required',
      capabilities: ['shipping.switch'],
    })
    class Shipping {
      @Observe('carrier.failed')
      onFailure(e: { orderId: string; carrier: string }) {
        return e;
      }

      @Capability({
        id: 'shipping.switch',
        effect: 'idempotent',
        approval: 'auto',
        idempotencyKey: true,
      })
      async switchCarrier(input: { orderId: string }) {
        calls.push(input.orderId);
        return { switched: true };
      }
    }

    const runtime = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      autoDiscover: false,
      services: [Shipping],
    });
    runtime.bindInstance(Shipping, new Shipping());
    await runtime.start();

    const [runId] = await runtime.emit('carrier.failed', {
      orderId: 'ORD-1001',
      carrier: 'carrier-a',
    });
    let run = await runtime.inspect(runId!);
    expect(run?.metadata.phase).toBe('approval_pending');
    expect(calls).toHaveLength(0);

    await runtime.resume(runId!, { approved: true, actor: 'ops-lead' });
    run = await runtime.inspect(runId!);
    expect(run?.status).toBe('completed');
    expect(calls).toEqual(['ORD-1001']);
  });

  it('dry-run replay never re-executes side effects', async () => {
    @Injectable()
    @Autonomous({ id: 'mon', mode: 'observe-only' })
    class Mon {
      @Observe('x')
      on() {
        return {};
      }
    }

    const runtime = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      autoDiscover: false,
      services: [Mon],
    });
    runtime.bindInstance(Mon, new Mon());
    await runtime.start();
    const [runId] = await runtime.emit('x', {});
    const replayed = await runtime.replay(runId!, { dryRun: true });
    expect(replayed.metadata.dryRun).toBe(true);
    expect(replayed.id).not.toBe(runId);
  });

  it('recover marks interrupted executing runs for reconciliation', async () => {
    const store = new MemoryAutonomousRunStore();
    const runtime = new AutonomousRuntime({ storage: store, autoDiscover: false });
    await runtime.start();

    await store.create({
      id: 'aar_crash',
      serviceId: 'svc',
      metadata: {
        kind: 'autonomous',
        serviceId: 'svc',
        phase: 'executing',
        mode: 'governed-auto',
        effectStatus: 'uncertain',
        timeline: [],
      },
    });
    await store.update('aar_crash', { status: 'running' });

    const recovered = await runtime.recover();
    expect(recovered).toContain('aar_crash');
    const run = await store.get('aar_crash');
    expect(run?.metadata.phase).toBe('reconcile');
  });

  it('rejects forged tenant elevation via trusted resolver', async () => {
    @Injectable()
    @Autonomous({ id: 'ten', mode: 'observe-only' })
    class Ten {
      @Observe('evt')
      on(p: unknown) {
        return p;
      }
    }

    const runtime = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      autoDiscover: false,
      services: [Ten],
      resolveTenantId: () => 'trusted-tenant',
    });
    runtime.bindInstance(Ten, new Ten());
    await runtime.start();

    const [runId] = await runtime.emit('evt', { tenantId: 'attacker' }, { tenantId: 'attacker' });
    const run = await runtime.inspect(runId!);
    expect(run?.tenantId).toBe('trusted-tenant');
  });
});
