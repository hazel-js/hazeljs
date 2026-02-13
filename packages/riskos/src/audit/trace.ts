/**
 * Compliance trace format for audit logging
 */

import type { HazelEvent } from '@hazeljs/contracts';

/** Single trace event in the compliance format */
export interface ComplianceTrace {
  requestId: string;
  tsStart: string;
  tsEnd: string;
  tenantId?: string;
  actor?: { userId?: string; role?: string; ip?: string };
  purpose?: string;
  actionName: string;
  policyResults?: Array<{ policy: string; result: 'ALLOW' | 'DENY' | 'TRANSFORM' | 'ESCALATE' }>;
  dataAccessEvents?: HazelEvent[];
  aiCallEvents?: HazelEvent[];
  decisionEvents?: HazelEvent[];
  error?: string;
  integrity: {
    hash: string;
    prevHash: string;
  };
  versions?: {
    appVersion?: string;
    configHash?: string;
    policyVersion?: string;
  };
}
