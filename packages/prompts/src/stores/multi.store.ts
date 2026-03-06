import type { PromptEntry, PromptStore } from './store.interface';

/**
 * MultiStore
 *
 * A composite `PromptStore` that fans out writes to all registered stores
 * and reads from the first store that has the requested entry.
 *
 * Useful for layered caching strategies, e.g.:
 *  - Read: check in-memory → Redis → database
 *  - Write: write to all three simultaneously
 *
 * @example
 * ```typescript
 * import { PromptRegistry, MultiStore, MemoryStore, RedisStore, FileStore } from '@hazeljs/prompts';
 *
 * PromptRegistry.configure([
 *   new MultiStore([
 *     new MemoryStore(),
 *     new RedisStore({ client: redisClient }),
 *     new FileStore({ filePath: './prompts/library.json' }),
 *   ])
 * ]);
 *
 * await PromptRegistry.saveAll();
 * ```
 */
export class MultiStore implements PromptStore {
  readonly name: string;

  constructor(private readonly stores: PromptStore[]) {
    this.name = `multi(${stores.map((s) => s.name).join(', ')})`;
  }

  /** Returns from the first store that has the entry; `undefined` if none do. */
  async get(key: string, version = 'latest'): Promise<PromptEntry | undefined> {
    for (const store of this.stores) {
      const entry = await store.get(key, version);
      if (entry) return entry;
    }
    return undefined;
  }

  /** Writes to ALL stores in parallel. */
  async set(entry: PromptEntry): Promise<void> {
    await Promise.all(this.stores.map((s) => s.set(entry)));
  }

  /** Deletes from ALL stores in parallel. */
  async delete(key: string, version?: string): Promise<void> {
    await Promise.all(this.stores.map((s) => s.delete(key, version)));
  }

  /** Returns `true` if ANY store has the entry. */
  async has(key: string, version = 'latest'): Promise<boolean> {
    const results = await Promise.all(this.stores.map((s) => s.has(key, version)));
    return results.some(Boolean);
  }

  /** Returns the union of all keys across all stores (deduplicated). */
  async keys(): Promise<string[]> {
    const allKeys = await Promise.all(this.stores.map((s) => s.keys()));
    return [...new Set(allKeys.flat())];
  }

  /** Returns the union of all version strings for a key across all stores. */
  async versions(key: string): Promise<string[]> {
    const allVersions = await Promise.all(this.stores.map((s) => s.versions(key)));
    return [...new Set(allVersions.flat())].sort();
  }
}
