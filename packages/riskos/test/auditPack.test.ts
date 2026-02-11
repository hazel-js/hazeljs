/**
 * Audit pack and hash chain tests
 */

import { MemoryAuditSink, createRiskOS } from '../src';
import { computeTraceHash } from '../src/audit/integrity/hashChain';
import type { ComplianceTrace } from '../src/audit/trace';

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
