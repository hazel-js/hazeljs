import type { PromptEntry, PromptStore } from './store.interface';

/**
 * MemoryStore
 *
 * Stores all prompt entries in a plain `Map` keyed by `"key@version"`.
 * This is the default store when no external backend is configured.
 * Entries are lost when the process exits.
 */
export class MemoryStore implements PromptStore {
  readonly name = 'memory';

  /** Keyed by `"key@version"` — e.g. `"rag:graph:entity-extraction@1.0.0"`. */
  private readonly data = new Map<string, PromptEntry>();

  private compoundKey(key: string, version: string): string {
    return `${key}@${version}`;
  }

  async get(key: string, version = 'latest'): Promise<PromptEntry | undefined> {
    return this.data.get(this.compoundKey(key, version));
  }

  async set(entry: PromptEntry): Promise<void> {
    const version = entry.version || 'latest';
    this.data.set(this.compoundKey(entry.key, version), { ...entry, version });
    // Also write / overwrite the 'latest' slot so get(key) always works
    if (version !== 'latest') {
      this.data.set(this.compoundKey(entry.key, 'latest'), { ...entry, version: 'latest' });
    }
  }

  async delete(key: string, version?: string): Promise<void> {
    if (version) {
      this.data.delete(this.compoundKey(key, version));
    } else {
      for (const k of [...this.data.keys()]) {
        if (k.startsWith(`${key}@`)) this.data.delete(k);
      }
    }
  }

  async has(key: string, version = 'latest'): Promise<boolean> {
    return this.data.has(this.compoundKey(key, version));
  }

  async keys(): Promise<string[]> {
    const seen = new Set<string>();
    for (const compKey of this.data.keys()) {
      seen.add(compKey.split('@')[0]);
    }
    return [...seen];
  }

  async versions(key: string): Promise<string[]> {
    const vers: string[] = [];
    for (const compKey of this.data.keys()) {
      const [k, v] = compKey.split('@');
      if (k === key && v !== 'latest') vers.push(v);
    }
    return vers.sort();
  }
}
