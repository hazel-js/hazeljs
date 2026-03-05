/**
 * PromptRegistry
 *
 * A global static store that maps string keys to PromptTemplate instances.
 *
 * ## Sync API (unchanged, zero-cost, works at module load time)
 * Built-in prompt files self-register at import time via `register()`.
 * Application code reads prompts synchronously via `get()`.
 * End-users swap any prompt with `override()` at startup.
 *
 * ## Store backends (optional, async)
 * One or more `PromptStore` implementations can be configured to
 * persist/load prompts from the file system, Redis, a database, or any
 * combination via `MultiStore`.  The in-memory registry always acts as the
 * runtime cache; stores are used for persistence and versioning.
 *
 * ## Versioning
 * Every `PromptTemplate.metadata.version` is tracked in the version index.
 * `get(key, version)` retrieves a specific cached version.
 * `getAsync(key, version?)` falls back to configured stores when the version
 * is not in the in-memory cache.
 *
 * Key naming convention: `package:scope:action`
 *   e.g. `rag:graph:entity-extraction`, `agent:supervisor:routing`
 *
 * @example Startup override
 * ```typescript
 * import { PromptRegistry, PromptTemplate } from '@hazeljs/prompts';
 *
 * PromptRegistry.override('rag:graph:entity-extraction', new PromptTemplate(
 *   'Extract entities from: {text}',
 *   { name: 'Custom Extraction', version: '2.0.0' },
 * ));
 * ```
 *
 * @example Multiple store backends
 * ```typescript
 * import { PromptRegistry, FileStore, RedisStore, MultiStore } from '@hazeljs/prompts';
 *
 * PromptRegistry.configure([
 *   new MultiStore([
 *     new FileStore({ filePath: './prompts/library.json' }),
 *     new RedisStore({ client: redisClient }),
 *   ]),
 * ]);
 *
 * await PromptRegistry.saveAll(); // persist current registry to all stores
 * ```
 */

import { PromptTemplate } from './template';
import type { PromptStore, PromptEntry } from './stores/store.interface';

export class PromptRegistry {
  // ── In-memory runtime cache ───────────────────────────────────────────────

  /** Latest version for each key. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static readonly latest = new Map<string, PromptTemplate<any>>();

  /**
   * All cached versions per key.
   * Shape: `{ [key]: { [version]: PromptTemplate } }`
   */
  private static readonly versioned = new Map<
    string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Map<string, PromptTemplate<any>>
  >();

  // ── Store backends ────────────────────────────────────────────────────────

  private static stores: PromptStore[] = [];

  // ── Store configuration ───────────────────────────────────────────────────

  /**
   * Replace the configured store list.
   * Called once at application startup before prompts are loaded.
   */
  static configure(stores: PromptStore[]): void {
    this.stores = [...stores];
  }

  /**
   * Append a single store to the list without replacing existing ones.
   */
  static addStore(store: PromptStore): void {
    this.stores.push(store);
  }

  /** Returns the names of all configured stores (useful for diagnostics). */
  static storeNames(): string[] {
    return this.stores.map((s) => s.name);
  }

  // ── Sync API (fully backward-compatible) ──────────────────────────────────

  /**
   * Register a prompt only if the key has not already been registered.
   * Built-in prompt files call this so they don't clobber user overrides
   * set before the module is imported.
   */
  static register<T extends object>(key: string, template: PromptTemplate<T>): void {
    if (!this.latest.has(key)) {
      this.setInMemory(key, template);
    }
  }

  /**
   * Override an existing (or register a new) prompt unconditionally.
   * This is the entry point for end-user customisation.
   */
  static override<T extends object>(key: string, template: PromptTemplate<T>): void {
    this.setInMemory(key, template);
  }

  /**
   * Retrieve a registered prompt by key.
   *
   * @param key - Registry key (e.g. `rag:graph:entity-extraction`).
   * @param version - Optional specific version. Defaults to `'latest'`.
   * @throws When the key (or requested version) is not found in the cache.
   */
  static get<T extends object>(key: string, version?: string): PromptTemplate<T> {
    if (version) {
      const verMap = this.versioned.get(key);
      const tpl = verMap?.get(version);
      if (!tpl) {
        throw new Error(
          `[PromptRegistry] Version "${version}" of prompt "${key}" not found in cache. ` +
            `Cached versions: ${[...(verMap?.keys() ?? [])].join(', ') || '(none)'}. ` +
            `Use getAsync() to load from a store backend.`
        );
      }
      return tpl as PromptTemplate<T>;
    }

    const template = this.latest.get(key);
    if (!template) {
      throw new Error(
        `[PromptRegistry] Prompt not found: "${key}". ` +
          `Make sure the prompt file is imported before calling get(). ` +
          `Registered keys: ${[...this.latest.keys()].join(', ') || '(none)'}`
      );
    }
    return template as PromptTemplate<T>;
  }

  /** Returns `true` when a prompt is registered under the given key. */
  static has(key: string, version?: string): boolean {
    if (version) return this.versioned.get(key)?.has(version) ?? false;
    return this.latest.has(key);
  }

  /** Returns all registered prompt keys (latest versions) in insertion order. */
  static list(): string[] {
    return [...this.latest.keys()];
  }

  /**
   * Returns all cached version strings for a given key (excludes `'latest'`).
   * Returns an empty array when the key is not registered.
   */
  static versions(key: string): string[] {
    const verMap = this.versioned.get(key);
    if (!verMap) return [];
    return [...verMap.keys()].filter((v) => v !== 'latest').sort();
  }

  /**
   * Remove a prompt from the cache.
   * Primarily useful in tests to reset state between test cases.
   * Pass `version` to remove only that version; omit to remove all versions.
   */
  static unregister(key: string, version?: string): void {
    if (version) {
      this.versioned.get(key)?.delete(version);
    } else {
      this.latest.delete(key);
      this.versioned.delete(key);
    }
  }

  /**
   * Clear every registered prompt from the in-memory cache.
   * Does NOT affect configured stores.
   * Useful in tests; not recommended in production.
   */
  static clear(): void {
    this.latest.clear();
    this.versioned.clear();
  }

  // ── Async store API ───────────────────────────────────────────────────────

  /**
   * Retrieve a prompt by key, checking the in-memory cache first.
   * Falls back to configured stores when the version is not cached.
   * The loaded template is added to the in-memory cache for subsequent calls.
   *
   * @param key - Registry key.
   * @param version - Specific version string; defaults to `'latest'`.
   * @throws When the key is not found in the cache or any configured store.
   */
  static async getAsync<T extends object>(
    key: string,
    version?: string
  ): Promise<PromptTemplate<T>> {
    const cached = this.latest.get(key);
    if (!version && cached) return cached as PromptTemplate<T>;
    if (version && this.versioned.get(key)?.has(version)) {
      return this.versioned.get(key)!.get(version) as PromptTemplate<T>;
    }

    // Try each store in order
    for (const store of this.stores) {
      const entry = await store.get(key, version);
      if (entry) {
        const tpl = this.entryToTemplate<T>(entry);
        this.setInMemory(key, tpl);
        return tpl;
      }
    }

    throw new Error(
      `[PromptRegistry] Prompt "${key}"${version ? `@${version}` : ''} not found ` +
        `in cache or any configured store (${this.stores.map((s) => s.name).join(', ') || 'none'}).`
    );
  }

  /**
   * Persist the in-memory prompt for `key` to all configured stores.
   * @param key - Registry key.
   * @param version - Specific cached version to persist; defaults to `'latest'` (current).
   */
  static async save(key: string, version?: string): Promise<void> {
    const tpl = this.get(key, version);
    const entry = this.templateToEntry(key, tpl, version);
    await Promise.all(this.stores.map((s) => s.set(entry)));
  }

  /**
   * Persist ALL in-memory prompts (latest version of each) to all configured stores.
   */
  static async saveAll(): Promise<void> {
    const tasks: Array<Promise<void>> = [];
    for (const key of this.latest.keys()) {
      tasks.push(this.save(key));
    }
    await Promise.all(tasks);
  }

  /**
   * Load ALL prompts from the primary configured store into the in-memory cache.
   * Existing in-memory registrations are NOT overwritten (same behaviour as `register()`).
   * Use `override()` after `loadAll()` to force-replace specific keys.
   *
   * @param overwrite - When `true`, loaded entries overwrite existing cache entries.
   *                    Default: `false`.
   */
  static async loadAll(overwrite = false): Promise<void> {
    if (this.stores.length === 0) return;
    const primaryStore = this.stores[0];
    const keys = await primaryStore.keys();
    await Promise.all(
      keys.map(async (key) => {
        const entry = await primaryStore.get(key);
        if (!entry) return;
        const tpl = this.entryToTemplate(entry);
        if (overwrite) {
          this.setInMemory(key, tpl);
        } else {
          this.register(key, tpl);
        }
      })
    );
  }

  /**
   * Load a single prompt (optionally a specific version) from the first
   * store that has it, cache it, and return it.
   *
   * @param key - Registry key.
   * @param version - Specific version string; defaults to `'latest'`.
   */
  static async load(key: string, version?: string): Promise<PromptTemplate<object> | null> {
    for (const store of this.stores) {
      const entry = await store.get(key, version);
      if (entry) {
        const tpl = this.entryToTemplate(entry);
        this.setInMemory(key, tpl);
        return tpl;
      }
    }
    return null;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private static setInMemory<T extends object>(key: string, template: PromptTemplate<T>): void {
    this.latest.set(key, template);
    // Track versioned entry
    const ver = template.metadata.version ?? 'latest';
    if (!this.versioned.has(key)) {
      this.versioned.set(key, new Map());
    }
    this.versioned.get(key)!.set(ver, template);
  }

  private static templateToEntry(
    key: string,
    template: PromptTemplate<object>,
    version?: string
  ): PromptEntry {
    return {
      key,
      version: version ?? template.metadata.version ?? 'latest',
      template: template.template,
      metadata: template.metadata,
      storedAt: new Date().toISOString(),
    };
  }

  private static entryToTemplate<T extends object>(entry: PromptEntry): PromptTemplate<T> {
    return new PromptTemplate<T>(entry.template, entry.metadata);
  }
}
