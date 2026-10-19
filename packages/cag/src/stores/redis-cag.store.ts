import type { CachedContext, CacheOptions, CagStore, RedisLikeClient } from '../types';
import { CagError } from '../errors/cag.error';
import { matchSimpleGlob } from './memory-cag.store';

/**
 * Thin Redis adapter for CAG. Accepts an injected client (ioredis-compatible)
 * so unit tests can use an in-memory fake without a real Redis server.
 */
export class RedisCagStore implements CagStore {
  constructor(private readonly client: RedisLikeClient) {}

  async get(key: string): Promise<CachedContext | null> {
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedContext;
      if (parsed.expiresAt !== undefined && Date.now() > parsed.expiresAt) {
        await this.client.del(key);
        return null;
      }
      return parsed;
    } catch (err) {
      throw CagError.storeError(
        `Redis CAG get failed for key "${key}"`,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  async set(key: string, value: CachedContext, options?: CacheOptions): Promise<void> {
    try {
      const ttlSeconds = options?.ttlSeconds;
      const expiresAt =
        ttlSeconds !== undefined && ttlSeconds > 0
          ? Date.now() + ttlSeconds * 1000
          : value.expiresAt;
      const payload = JSON.stringify({ ...value, expiresAt });
      if (ttlSeconds !== undefined && ttlSeconds > 0) {
        await this.client.set(key, payload, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, payload);
      }
    } catch (err) {
      throw CagError.storeError(
        `Redis CAG set failed for key "${key}"`,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (err) {
      throw CagError.storeError(
        `Redis CAG delete failed for key "${key}"`,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  async clear(prefix?: string): Promise<void> {
    try {
      const pattern = prefix ? (prefix.includes('*') ? prefix : `${prefix}*`) : 'cag:*';
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (err) {
      throw CagError.storeError(
        'Redis CAG clear failed',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  async keys(pattern?: string): Promise<string[]> {
    const keys = await this.client.keys(pattern ?? 'cag:*');
    if (!pattern) return keys;
    return keys.filter((k) => matchSimpleGlob(k, pattern));
  }
}

/**
 * In-memory Redis-shaped client for tests and local development.
 */
export class FakeRedisClient implements RedisLikeClient {
  private readonly data = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ...args: unknown[]): Promise<'OK'> {
    let expiresAt: number | undefined;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === 'EX' && typeof args[i + 1] === 'number') {
        expiresAt = Date.now() + (args[i + 1] as number) * 1000;
      }
    }
    this.data.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let n = 0;
    for (const key of keys) {
      if (this.data.delete(key)) n++;
    }
    return n;
  }

  async keys(pattern: string): Promise<string[]> {
    return [...this.data.keys()].filter((k) => matchSimpleGlob(k, pattern));
  }
}
