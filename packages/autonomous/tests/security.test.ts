import 'reflect-metadata';
import {
  Injectable,
  Autonomous,
  Observe,
  Capability,
  clearAutonomousRegistry,
} from '@hazeljs/core';
import { AutonomousRuntime, MemoryAutonomousRunStore, simulate } from '../src';

describe('AAR security', () => {
  beforeEach(() => clearAutonomousRegistry());

  it('ignores capability methods that are not granted', async () => {
    let executed = false;

    @Injectable()
    @Autonomous({
      id: 'pay',
      mode: 'governed-auto',
      capabilities: [], // no grants
    })
    class Pay {
      @Observe('payment.failed')
      on(e: unknown) {
        return e;
      }

      @Capability({
        id: 'payments.refund',
        effect: 'irreversible',
        approval: 'auto',
        reconcile: 'rec',
      })
      refund() {
        executed = true;
        return { ok: true };
      }

      rec() {
        return { status: 'unknown' };
      }
    }

    const runtime = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      autoDiscover: false,
      services: [Pay],
    });
    runtime.bindInstance(Pay, new Pay());
    await runtime.start();
    await runtime.emit('payment.failed', { id: '1' });
    expect(executed).toBe(false);
  });

  it('simulation cannot perform live side effects', async () => {
    let executed = false;

    @Injectable()
    @Autonomous({
      id: 'ship',
      mode: 'governed-auto',
      capabilities: ['shipping.switch'],
    })
    class Ship {
      @Observe('carrier.failed')
      on(e: unknown) {
        return e;
      }

      @Capability({
        id: 'shipping.switch',
        effect: 'idempotent',
        approval: 'auto',
        idempotencyKey: true,
      })
      switch() {
        executed = true;
        return { switched: true };
      }
    }

    const runtime = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      autoDiscover: false,
      services: [Ship],
      simulation: true,
    });
    runtime.bindInstance(Ship, new Ship());

    const result = await simulate({
      service: 'ship',
      event: { type: 'carrier.failed', payload: { orderId: '1' } },
      runtime,
    });

    expect(executed).toBe(false);
    expect(result.run.metadata.dryRun || result.run.output).toBeTruthy();
  });

  it('modified arguments invalidate pending approval binding', async () => {
    @Injectable()
    @Autonomous({
      id: 'ship2',
      mode: 'approval-required',
      capabilities: ['shipping.switch'],
    })
    class Ship2 {
      @Observe('carrier.failed')
      on(e: unknown) {
        return e;
      }

      @Capability({
        id: 'shipping.switch',
        effect: 'idempotent',
        approval: 'auto',
        idempotencyKey: true,
      })
      switch(input: { orderId: string }) {
        return input;
      }
    }

    const runtime = new AutonomousRuntime({
      storage: new MemoryAutonomousRunStore(),
      autoDiscover: false,
      services: [Ship2],
      decisionEngine: {
        async evaluate() {
          return {
            type: 'request-approval',
            capabilityId: 'shipping.switch',
            arguments: { orderId: 'A' },
            reason: 'test',
          };
        },
      },
    });
    runtime.bindInstance(Ship2, new Ship2());
    await runtime.start();
    const [runId] = await runtime.emit('carrier.failed', { orderId: 'A' });
    const run = await runtime.inspect(runId!);
    // Tamper stored decision arguments
    await (runtime as unknown as { store: MemoryAutonomousRunStore }).store.update(runId!, {
      metadata: {
        ...run!.metadata,
        decision: {
          type: 'request-approval',
          capabilityId: 'shipping.switch',
          arguments: { orderId: 'TAMPERED' },
          reason: 'test',
        },
      },
    });
    await expect(runtime.resume(runId!, { approved: true, actor: 'x' })).rejects.toThrow(
      /digest mismatch|invalidated/i
    );
  });
});
