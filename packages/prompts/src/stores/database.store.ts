import type { PromptEntry, PromptStore } from './store.interface';

/**
 * Minimal database adapter interface.
 * Any ORM or raw database driver can implement this:
 * Prisma, TypeORM, Knex, `pg`, `mysql2`, etc.
 *
 * Expected table / collection schema:
 * ```sql
 * CREATE TABLE prompt_entries (
 *   key        TEXT    NOT NULL,
 *   version    TEXT    NOT NULL DEFAULT 'latest',
 *   template   TEXT    NOT NULL,
 *   metadata   JSONB   NOT NULL,
 *   stored_at  TEXT    NOT NULL,
 *   PRIMARY KEY (key, version)
 * );
 * ```
 *
 * @example Using Prisma:
 * ```typescript
 * import { PrismaClient } from '@prisma/client';
 * const prisma = new PrismaClient();
 *
 * PromptRegistry.addStore(new DatabaseStore({
 *   adapter: {
 *     findOne: ({ key, version }) =>
 *       prisma.promptEntry.findUnique({ where: { key_version: { key, version } } }),
 *     upsert: (entry) =>
 *       prisma.promptEntry.upsert({
 *         where: { key_version: { key: entry.key, version: entry.version } },
 *         create: entry,
 *         update: entry,
 *       }),
 *     remove: ({ key, version }) =>
 *       version
 *         ? prisma.promptEntry.deleteMany({ where: { key, version } })
 *         : prisma.promptEntry.deleteMany({ where: { key } }),
 *     findKeys: () => prisma.promptEntry.findMany({ select: { key: true } }),
 *     findVersions: ({ key }) =>
 *       prisma.promptEntry.findMany({ where: { key, NOT: { version: 'latest' } }, select: { version: true } }),
 *   }
 * }));
 * ```
 */
export interface DatabaseAdapter {
  /** Find one entry by key + version (defaults to `'latest'`). Returns null/undefined if not found. */
  findOne(params: { key: string; version: string }): Promise<PromptEntry | null | undefined>;

  /** Insert or update an entry. */
  upsert(entry: PromptEntry): Promise<void>;

  /** Delete entries. If `version` is absent, delete all versions of the key. */
  remove(params: { key: string; version?: string }): Promise<void>;

  /** Return all distinct keys. */
  findKeys(): Promise<Array<{ key: string }>>;

  /** Return all version strings for a given key (excluding `'latest'`). */
  findVersions(params: { key: string }): Promise<Array<{ version: string }>>;
}

export interface DatabaseStoreOptions {
  /** Adapter that bridges the generic interface to your specific ORM/driver. */
  adapter: DatabaseAdapter;
}

/**
 * DatabaseStore
 *
 * Persists prompt entries to any relational or document database via a thin
 * `DatabaseAdapter` interface.  No database driver is imported directly;
 * you supply the adapter so the package stays dependency-free.
 *
 * @example See `DatabaseAdapter` JSDoc for a complete Prisma example.
 */
export class DatabaseStore implements PromptStore {
  readonly name = 'database';

  private readonly adapter: DatabaseAdapter;

  constructor(options: DatabaseStoreOptions) {
    this.adapter = options.adapter;
  }

  async get(key: string, version = 'latest'): Promise<PromptEntry | undefined> {
    const result = await this.adapter.findOne({ key, version });
    return result ?? undefined;
  }

  async set(entry: PromptEntry): Promise<void> {
    const version = entry.version || 'latest';
    await this.adapter.upsert({ ...entry, version });
    if (version !== 'latest') {
      await this.adapter.upsert({ ...entry, version: 'latest' });
    }
  }

  async delete(key: string, version?: string): Promise<void> {
    await this.adapter.remove({ key, version });
  }

  async has(key: string, version = 'latest'): Promise<boolean> {
    const result = await this.adapter.findOne({ key, version });
    return result != null;
  }

  async keys(): Promise<string[]> {
    const rows = await this.adapter.findKeys();
    return [...new Set(rows.map((r) => r.key))];
  }

  async versions(key: string): Promise<string[]> {
    const rows = await this.adapter.findVersions({ key });
    return rows.map((r) => r.version).sort();
  }
}
