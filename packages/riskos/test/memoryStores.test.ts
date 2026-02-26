/**
 * Memory store and audit sink tests
 */

import { MemoryKycStore, MemoryAuditSink, createRiskOS } from '../src';
import type { ComplianceTrace } from '../src/audit/trace';

describe('MemoryKycStore', () => {
  it('creates session with id', async () => {
    const store = new MemoryKycStore();
    const s = await store.create();
    expect(s.id).toMatch(/^kyc-\d+-[a-z0-9]+$/);
    expect(s.answers).toEqual({});
  });

  it('creates session with tenantId', async () => {
    const store = new MemoryKycStore();
    const s = await store.create('tenant-x');
    expect(s.tenantId).toBe('tenant-x');
  });

  it('returns null for unknown id', async () => {
    const store = new MemoryKycStore();
    expect(await store.get('nope')).toBeNull();
  });

  it('updates session', async () => {
    const store = new MemoryKycStore();
    const s = await store.create();
    const updated = await store.update(s.id, { answers: { x: 1 } });
    expect(updated?.answers).toEqual({ x: 1 });
    const got = await store.get(s.id);
    expect(got?.answers).toEqual({ x: 1 });
  });

  it('update returns null for unknown id', async () => {
    const store = new MemoryKycStore();
    expect(await store.update('nope', {})).toBeNull();
  });
});

describe('MemoryAuditSink', () => {
  it('filters by requestId', async () => {
    const sink = new MemoryAuditSink();
    const trace: ComplianceTrace = {
      requestId: 'r1',
      tsStart: '2025-01-01T00:00:00Z',
      tsEnd: '2025-01-01T00:00:01Z',
      actionName: 'a1',
      integrity: { hash: 'h', prevHash: 'g' },
    };
    await sink.write(trace);
    await sink.write({ ...trace, requestId: 'r2', integrity: { hash: 'h2', prevHash: 'h' } });

    const pack = await sink.buildEvidencePack({ requestId: 'r1' });
    expect(pack.traces).toHaveLength(1);
    expect(pack.traces[0].requestId).toBe('r1');
  });

  it('filters by tenantId', async () => {
    const sink = new MemoryAuditSink();
    const base: ComplianceTrace = {
      requestId: 'r1',
      tsStart: '2025-01-01T00:00:00Z',
      tsEnd: '2025-01-01T00:00:01Z',
      actionName: 'a',
      integrity: { hash: 'h', prevHash: 'g' },
    };
    await sink.write({ ...base });
    await sink.write({ ...base, tenantId: 't1', integrity: { hash: 'h2', prevHash: 'h' } });
    await sink.write({ ...base, tenantId: 't2', requestId: 'r2', integrity: { hash: 'h3', prevHash: 'h2' } });

    const pack = await sink.buildEvidencePack({ tenantId: 't1' });
    expect(pack.traces).toHaveLength(1);
    expect(pack.traces[0].tenantId).toBe('t1');
  });

  it('getAllTraces returns all', async () => {
    const sink = new MemoryAuditSink();
    const t: ComplianceTrace = {
      requestId: 'x',
      tsStart: '2025-01-01',
      tsEnd: '2025-01-01',
      actionName: 'x',
      integrity: { hash: 'h', prevHash: 'g' },
    };
    await sink.write(t);
    expect(sink.getAllTraces().length).toBe(1);
  });
});
