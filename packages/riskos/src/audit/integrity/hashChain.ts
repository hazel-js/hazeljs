/**
 * Hash chain for audit trace integrity
 */

import { hashObject } from './hash';
import type { ComplianceTrace } from '../trace';

/** Compute trace hash with prevHash for chain integrity */
export function computeTraceHash(trace: ComplianceTrace, prevHash: string): string {
  const payload = { ...trace, integrity: { prevHash } };
  return hashObject(payload);
}
