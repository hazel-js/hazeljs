/**
 * In-memory audit sink for development and testing
 */

import type { AuditSink } from '../sink';
import type { ComplianceTrace } from '../trace';
import type { EvidencePack } from '../evidence/pack';
import { nowISO } from '../../utils/time';

export class MemoryAuditSink implements AuditSink {
  private traces: ComplianceTrace[] = [];

  async write(traceEvent: ComplianceTrace): Promise<void> {
    this.traces.push(traceEvent);
  }

  async buildEvidencePack(criteria: {
    requestId?: string;
    timeRange?: { start: string; end: string };
    tenantId?: string;
  }): Promise<EvidencePack> {
    let filtered = [...this.traces];

    if (criteria.requestId) {
      filtered = filtered.filter((t) => t.requestId === criteria.requestId);
    }
    if (criteria.tenantId) {
      filtered = filtered.filter((t) => t.tenantId === criteria.tenantId);
    }
    if (criteria.timeRange) {
      const { start, end } = criteria.timeRange;
      filtered = filtered.filter((t) => t.tsStart >= start && t.tsEnd <= end);
    }

    const id = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return {
      id,
      createdAt: nowISO(),
      manifest: {
        requestIds: criteria.requestId ? [criteria.requestId] : undefined,
        timeRange: criteria.timeRange,
        tenantId: criteria.tenantId,
        traceCount: filtered.length,
      },
      traces: filtered,
    };
  }

  /** Test helper: get all traces */
  getAllTraces(): ComplianceTrace[] {
    return [...this.traces];
  }
}
