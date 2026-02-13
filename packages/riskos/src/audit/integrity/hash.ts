/**
 * Integrity hash for trace objects - SHA-256 for production audit
 */

import { createHash } from 'crypto';

/** Create SHA-256 hash of an object for audit integrity */
export function hashObject(obj: unknown): string {
  const str = JSON.stringify(obj);
  return createHash('sha256').update(str).digest('hex');
}
