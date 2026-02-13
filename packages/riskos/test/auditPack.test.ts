/**
 * Audit pack and hash chain tests
 */

import { MemoryAuditSink, createRiskOS } from '../src';
import { computeTraceHash } from '../src/audit/integrity/hashChain';
import type { ComplianceTrace } from '../src';

describe('Audit Pack', () => {
  it('hash chain integrity is stable', () => {
    const trace: ComplianceTrace = {
      requestId: 'req-1',
      tsStart: '2025-01-01T00:00:00Z',
      tsEnd: '2025-01-01T00:00:01Z',
      tenantId: 't1',
      actionName: 'test',
      integrity: { hash: '', prevHash: 'genesis' },
    };
    const h1 = computeTraceHash(trace, 'genesis');
    const h2 = computeTraceHash(trace, 'genesis');
    expect(h1).toBe(h2);
    expect(h1).toBeTruthy();
  });

  it('evidence pack filters by timeRange', async () => {
    const sink = new MemoryAuditSink();
    const base: ComplianceTrace = {
      requestId: 'r1',
      tsStart: '2025-01-01T10:00:00Z',
      tsEnd: '2025-01-01T10:00:01Z',
      actionName: 'a',
      integrity: { hash: 'h', prevHash: 'g' },
    };
    await sink.write(base);
    await sink.write({
      ...base,
      tsStart: '2025-01-02T00:00:00Z',
      tsEnd: '2025-01-02T00:00:01Z',
      integrity: { hash: 'h2', prevHash: 'h' },
    });

    const pack = await sink.buildEvidencePack({
      timeRange: { start: '2025-01-01T09:00:00Z', end: '2025-01-01T11:00:00Z' },
    });
    expect(pack.traces).toHaveLength(1);
    expect(pack.traces[0].tsStart).toBe('2025-01-01T10:00:00Z');
  });

  it('evidence pack contains expected traces', async () => {
    const sink = new MemoryAuditSink();
    const riskos = createRiskOS({
      bus: { publish: () => {}, subscribe: () => () => {} },
      auditSink: sink,
    });

    await riskos.run(
      'action1',
      { requestId: 'req-a', tenantId: 't1' },
      () => 'done',
    );

    const pack = await sink.buildEvidencePack({ requestId: 'req-a' });
    expect(pack.traces).toHaveLength(1);
    expect(pack.traces[0].requestId).toBe('req-a');
    expect(pack.traces[0].actionName).toBe('action1');
    expect(pack.manifest.traceCount).toBe(1);
  });
});
