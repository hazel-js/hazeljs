/**
 * RiskOS core runtime tests
 */

import {
  createRiskOS,
  riskosPlugin,
  MemoryEventBus,
  MemoryAuditSink,
  PolicyEngine,
  requireTenant,
  DecisionStatus,
} from '../src';

describe('createRiskOS', () => {
  it('creates context with requestId from base', () => {
    const riskos = createRiskOS({ bus: { publish: () => {}, subscribe: () => () => {} } });
    const ctx = riskos.createContext({ requestId: 'req-123' } as never);
    expect(ctx.requestId).toBe('req-123');
  });

  it('generates requestId when not provided', () => {
    const riskos = createRiskOS({ bus: { publish: () => {}, subscribe: () => () => {} } });
    const ctx = riskos.createContext();
    expect(ctx.requestId).toMatch(/^req-/);
  });

  it('run executes fn and returns result', async () => {
    const riskos = createRiskOS({
      bus: { publish: () => {}, subscribe: () => () => {} },
      auditSink: new MemoryAuditSink(),
    });
    const result = await riskos.run('test', { tenantId: 't1', purpose: 'p' }, () => 42);
    expect(result).toBe(42);
  });

  it('run writes trace to auditSink', async () => {
    const sink = new MemoryAuditSink();
    const riskos = createRiskOS({
      bus: { publish: () => {}, subscribe: () => () => {} },
      auditSink: sink,
    });
    await riskos.run('myAction', { tenantId: 't1', purpose: 'p' }, () => null);
    const pack = await sink.buildEvidencePack({ tenantId: 't1' });
    expect(pack.traces).toHaveLength(1);
    expect(pack.traces[0].actionName).toBe('myAction');
  });

  it('run captures decision events', async () => {
    const sink = new MemoryAuditSink();
    const riskos = createRiskOS({
      bus: { publish: () => {}, subscribe: () => () => {} },
      auditSink: sink,
    });
    await riskos.run(
      'dec',
      { tenantId: 't1', purpose: 'p' },
      (ctx) => {
        ctx.emit({
          type: 'decision',
          name: 'kyc',
          status: DecisionStatus.APPROVED,
          score: 0,
          reasons: [],
        });
        return null;
      },
    );
    const pack = await sink.buildEvidencePack({ tenantId: 't1' });
    expect(pack.traces[0].decisionEvents).toHaveLength(1);
  });

  it('onEvent returns unsubscribe fn', () => {
    const bus = new MemoryEventBus();
    const riskos = createRiskOS({ bus });
    const handler = jest.fn();
    const unsub = riskos.onEvent(handler);
    bus.publish({ type: 'metric', name: 'x', value: 1 });
    expect(handler).toHaveBeenCalled();
    unsub();
    handler.mockClear();
    bus.publish({ type: 'metric', name: 'y', value: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('getAuditSink returns sink when set', () => {
    const sink = new MemoryAuditSink();
    const riskos = createRiskOS({ bus: { publish: () => {}, subscribe: () => () => {} }, auditSink: sink });
    expect(riskos.getAuditSink()).toBe(sink);
  });

  it('run writes trace with error when fn throws', async () => {
    const sink = new MemoryAuditSink();
    const riskos = createRiskOS({
      bus: { publish: () => {}, subscribe: () => () => {} },
      auditSink: sink,
    });
    await expect(
      riskos.run('fail', { tenantId: 't1', purpose: 'p' }, () => {
        throw new Error('oops');
      }),
    ).rejects.toThrow('oops');

    const pack = await sink.buildEvidencePack({ tenantId: 't1' });
    expect(pack.traces[0].error).toBe('oops');
  });

  it('createContext preserves tags from base', () => {
    const riskos = createRiskOS({ bus: { publish: () => {}, subscribe: () => () => {} } });
    const ctx = riskos.createContext({ tags: { env: 'test' } } as never);
    expect(ctx.tags).toEqual({ env: 'test' });
  });

  it('riskosPlugin installs when app has riskos', () => {
    const plugin = riskosPlugin({ bus: { publish: () => {}, subscribe: () => () => {} } });
    const app = { riskos: jest.fn() };
    plugin.install?.(app as never);
    expect(app.riskos).toHaveBeenCalledTimes(1);
    expect(typeof (app.riskos.mock.calls[0][0] as { getBus: () => unknown }).getBus).toBe('function');
  });
});
