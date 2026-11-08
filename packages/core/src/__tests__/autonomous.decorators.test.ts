import 'reflect-metadata';
import {
  Autonomous,
  Observe,
  Capability,
  Injectable,
  getAutonomousMetadata,
  getObserveMetadata,
  getObserveMethods,
  getCapabilityMetadata,
  getCapabilityMethods,
  getRegisteredAutonomousServices,
  clearAutonomousRegistry,
  isAutonomous,
  assertCapabilityRetrySafety,
  AutonomousConfigurationError,
  AutonomousDiagnosticCodes,
} from '../index';

describe('autonomous decorators', () => {
  beforeEach(() => {
    clearAutonomousRegistry();
  });

  it('registers @Autonomous metadata with default observe-only mode', () => {
    @Injectable()
    @Autonomous({ id: 'orders', objective: 'Keep orders healthy' })
    class OrderOps {}

    const meta = getAutonomousMetadata(OrderOps);
    expect(meta?.options.id).toBe('orders');
    expect(meta?.options.mode).toBe('observe-only');
    expect(isAutonomous(OrderOps)).toBe(true);
    expect(getRegisteredAutonomousServices()).toContain(OrderOps);
  });

  it('rejects invalid modes at decoration time', () => {
    expect(() => {
      @Autonomous({ mode: 'fully-autonomous' as 'governed-auto' })
      class Bad {}
      void Bad;
    }).toThrow(AutonomousConfigurationError);
  });

  it('stores @Observe and @Capability method metadata', () => {
    @Injectable()
    @Autonomous({ mode: 'governed-auto', capabilities: ['orders.retry'] })
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
      retry(input: { orderId: string }) {
        return input;
      }
    }

    const proto = OrderOps.prototype;
    expect(getObserveMethods(OrderOps)).toEqual(['onFailure']);
    expect(getObserveMetadata(proto, 'onFailure')?.event).toBe('orders.failed');
    expect(getCapabilityMethods(OrderOps)).toEqual(['retry']);
    expect(getCapabilityMetadata(proto, 'retry')?.id).toBe('orders.retry');
    expect(getCapabilityMetadata(proto, 'retry')?.effect).toBe('idempotent');
  });

  it('rejects empty capability ids', () => {
    expect(() => {
      class Bad {
        @Capability({ id: '  ' })
        refund() {
          return null;
        }
      }
      void Bad;
    }).toThrow(/HAZEL_AUTONOMOUS_CAPABILITY_INVALID/);
  });

  it('flags irreversible capabilities without safety for multi-retry', () => {
    @Injectable()
    @Autonomous({
      mode: 'approval-required',
      recovery: { retry: { attempts: 3 } },
    })
    class Payments {
      @Capability({ id: 'payments.refund', effect: 'irreversible', approval: 'required' })
      refund() {
        return true;
      }
    }

    const cap = getCapabilityMetadata(Payments.prototype, 'refund')!;
    expect(() => assertCapabilityRetrySafety(cap, 3, 'Payments')).toThrow(
      AutonomousConfigurationError
    );
    try {
      assertCapabilityRetrySafety(cap, 3, 'Payments');
    } catch (e) {
      expect((e as AutonomousConfigurationError).code).toBe(AutonomousDiagnosticCodes.RETRY_UNSAFE);
    }
  });

  it('allows irreversible retry when reconcile is configured', () => {
    @Injectable()
    @Autonomous({ recovery: { retry: { attempts: 3 } } })
    class Payments {
      @Capability({
        id: 'payments.refund',
        effect: 'irreversible',
        reconcile: 'reconcileRefund',
      })
      refund() {
        return true;
      }

      reconcileRefund() {
        return { status: 'unknown' };
      }
    }

    const cap = getCapabilityMetadata(Payments.prototype, 'refund')!;
    expect(() => assertCapabilityRetrySafety(cap, 3, 'Payments')).not.toThrow();
  });
});
