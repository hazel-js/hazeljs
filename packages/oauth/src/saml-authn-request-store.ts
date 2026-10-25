import type { SamlAuthnRequestStore } from './providers/provider.types';

export type { SamlAuthnRequestStore };

/** Default AuthnRequest cookie / replay TTL (seconds). */
const DEFAULT_TTL_SEC = 600;

/** In-process store suitable for single-instance deployments and tests. */
export class MemorySamlAuthnRequestStore implements SamlAuthnRequestStore {
  private readonly consumed = new Map<string, number>();

  tryConsume(requestId: string, ttlSec: number = DEFAULT_TTL_SEC): boolean {
    const id = requestId.trim();
    if (!id) return false;
    const now = Date.now();
    for (const [key, expiresAt] of this.consumed) {
      if (expiresAt <= now) this.consumed.delete(key);
    }
    if (this.consumed.has(id)) return false;
    this.consumed.set(id, now + Math.max(1, ttlSec) * 1000);
    return true;
  }

  /** Test helper: forget all consumed IDs. */
  clear(): void {
    this.consumed.clear();
  }
}

let defaultStore: MemorySamlAuthnRequestStore | null = null;

export function getDefaultSamlAuthnRequestStore(): SamlAuthnRequestStore {
  if (!defaultStore) defaultStore = new MemorySamlAuthnRequestStore();
  return defaultStore;
}

/** @internal Reset singleton between unit tests. */
export function resetDefaultSamlAuthnRequestStore(): void {
  defaultStore = null;
}
