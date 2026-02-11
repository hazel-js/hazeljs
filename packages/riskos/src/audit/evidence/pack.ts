/**
 * Evidence pack for audit export
 */

import type { ComplianceTrace } from '../trace';

/** Evidence pack returned by buildEvidencePack */
export interface EvidencePack {
  id: string;
  createdAt: string;
  manifest: {
    requestIds?: string[];
    timeRange?: { start: string; end: string };
    tenantId?: string;
    traceCount: number;
  };
  traces: ComplianceTrace[];
}
