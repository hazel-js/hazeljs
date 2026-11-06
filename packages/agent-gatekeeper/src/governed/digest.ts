import { createHash } from 'crypto';
import { canonicalJson } from '../security';

/** Stable sha256 digest of tool arguments (canonical JSON). */
export function argumentDigest(input: unknown): string {
  return createHash('sha256')
    .update(canonicalJson(input ?? null))
    .digest('hex');
}
