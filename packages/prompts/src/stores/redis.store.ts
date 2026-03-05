import type { PromptEntry, PromptStore } from './store.interface';

/**
 * Minimal Redis adapter interface.
 * Pass any Redis client (ioredis, node-redis, upstash, etc.) that satisfies
 * this shape — no direct dependency on any Redis library is needed.
 *
 * @example Using ioredis:
 * ```typescript
 * import Redis from 'ioredis';
 * const redis = new Redis();
 * PromptRegistry.addStore(new RedisStore({ client: redis }));
 * ```
 *
 * @example Using @upstash/redis:
 * ```typescript
 * import { Redis } from '@upstash/redis';
 * const redis = Redis.fromEnv();
 * PromptRegistry.addStore(new RedisStore({ client: redis as RedisAdapter }));
 * ```
 */
export interface RedisAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  exists(...keys: string[]): Promise<number>;
  /** Returns all keys matching a glob pattern. */
  keys(pattern: string): Promise<string[]>;
}

export interface RedisStoreOptions {
  /** A Redis client instance implementing `RedisAdapter`. */
  client: RedisAdapter;
  /**
   * Optional key prefix to namespace all prompts in the Redis keyspace.
   * Default: `'hazeljs:prompts'`.
   */
  prefix?: string;
}

/**
 * RedisStore
 *
 * Persists prompt entries as JSON strings in Redis.
 * Each prompt version is stored at:  `{prefix}:{key}@{version}`
 *
 * @example
 * ```typescript
 * import Redis from 'ioredis';
 * const redis = new Redis(process.env.REDIS_URL);
 * PromptRegistry.addStore(new RedisStore({ client: redis }));
 * await PromptRegistry.saveAll();
 * ```
 */
export class RedisStore implements PromptStore {
  readonly name = 'redis';

  private readonly client: RedisAdapter;
  private readonly prefix: string;

  constructor(options: RedisStoreOptions) {
    this.client = options.client;
    this.prefix = options.prefix ?? 'hazeljs:prompts';
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private redisKey(key: string, version: string): string {
    return `${this.prefix}:${key}@${version}`;
  }

  // ── PromptStore interface ─────────────────────────────────────────────────

  async get(key: string, version = 'latest'): Promise<PromptEntry | undefined> {
    const raw = await this.client.get(this.redisKey(key, version));
    if (!raw) return undefined;
    return JSON.parse(raw) as PromptEntry;
  }

  async set(entry: PromptEntry): Promise<void> {
    const version = entry.version || 'latest';
    const serialized = JSON.stringify({ ...entry, version });
    await this.client.set(this.redisKey(entry.key, version), serialized);
    if (version !== 'latest') {
      await this.client.set(
        this.redisKey(entry.key, 'latest'),
        JSON.stringify({ ...entry, version: 'latest' })
      );
    }
  }

  async delete(key: string, version?: string): Promise<void> {
    if (version) {
      await this.client.del(this.redisKey(key, version));
    } else {
      const matches = await this.client.keys(`${this.prefix}:${key}@*`);
      if (matches.length > 0) {
        await this.client.del(...matches);
      }
    }
  }

  async has(key: string, version = 'latest'): Promise<boolean> {
    const count = await this.client.exists(this.redisKey(key, version));
    return count > 0;
  }

  async keys(): Promise<string[]> {
    const allKeys = await this.client.keys(`${this.prefix}:*`);
    const seen = new Set<string>();
    for (const k of allKeys) {
      // Strip prefix and version: "hazeljs:prompts:rag:graph:entity@1.0.0" → "rag:graph:entity"
      const stripped = k.slice(this.prefix.length + 1); // after "prefix:"
      seen.add(stripped.split('@')[0]);
    }
    return [...seen];
  }

  async versions(key: string): Promise<string[]> {
    const pattern = `${this.prefix}:${key}@*`;
    const matches = await this.client.keys(pattern);
    const vers: string[] = [];
    for (const k of matches) {
      const v = k.split('@').pop() ?? '';
      if (v && v !== 'latest') vers.push(v);
    }
    return vers.sort();
  }
}
