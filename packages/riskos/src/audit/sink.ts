/**
 * Audit sink interface
 */

import type { ComplianceTrace } from './trace';
import type { EvidencePack } from './evidence/pack';

/** Audit sink for writing traces and building evidence packs */
export interface AuditSink {
  /** Write a trace event */
  write(traceEvent: ComplianceTrace): Promise<void>;
  /** Build evidence pack by requestId, timeRange, or tenantId */
  buildEvidencePack(criteria: {
    requestId?: string;
    timeRange?: { start: string; end: string };
    tenantId?: string;
  }): Promise<EvidencePack>;
}
