import type { CachedContext, CacheOptions, CagStore } from '../types';

interface Entry {
  value: CachedContext;
  expiresAt?: number;
}

/**
 * In-memory CAG store. Optionally wraps a Map; independent of @hazeljs/cache
 * so CAG can run without forcing CacheModule, while still sharing the same
 * conceptual get/set/delete/clear contract.
 */
export class MemoryCagStore implements CagStore {
  private readonly store = new Map<string, Entry>();

  async get(key: string): Promise<CachedContext | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: CachedContext, options?: CacheOptions): Promise<void> {
    const ttlSeconds = options?.ttlSeconds;
    const expiresAt =
      ttlSeconds !== undefined && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : value.expiresAt;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(prefix?: string): Promise<void> {
    if (!prefix) {
      this.store.clear();
      return;
    }
    for (const key of [...this.store.keys()]) {
      if (key.startsWith(prefix) || matchSimpleGlob(key, prefix)) {
        this.store.delete(key);
      }
    }
  }

  async keys(pattern?: string): Promise<string[]> {
    const all = [...this.store.keys()];
    if (!pattern) return all;
    return all.filter((k) => matchSimpleGlob(k, pattern));
  }
}

export function matchSimpleGlob(value: string, pattern: string): boolean {
  if (!pattern.includes('*')) {
    return value.startsWith(pattern) || value === pattern;
  }
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}`).test(value);
}
