/**
 * In-memory result cache for HCEL execute() deduplication and persist()/restore() keys.
 */

export interface HCELResultCache {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown, ttlMs: number): Promise<void>;
}

const globalMemoryCaches = new Map<string, Map<string, { value: unknown; expiresAt: number }>>();

function now(): number {
  return Date.now();
}

/**
 * Create or return a named in-memory cache (process-local).
 */
export function createMemoryHCELResultCache(namespace = 'default'): HCELResultCache {
  if (!globalMemoryCaches.has(namespace)) {
    globalMemoryCaches.set(namespace, new Map());
  }
  const store = globalMemoryCaches.get(namespace)!;

  return {
    async get(key: string): Promise<unknown | undefined> {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt > 0 && now() > entry.expiresAt) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },

    async set(key: string, value: unknown, ttlMs: number): Promise<void> {
      const expiresAt = ttlMs > 0 ? now() + ttlMs : 0;
      store.set(key, { value, expiresAt });
    },
  };
}

let defaultCache: HCELResultCache | null = null;

export function getDefaultHCELResultCache(): HCELResultCache {
  if (!defaultCache) {
    defaultCache = createMemoryHCELResultCache('hcel-default');
  }
  return defaultCache;
}
