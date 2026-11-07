/**
 * Distributed lock port for atomic approval consume / tool dispatch.
 * Memory for tests; Redis SET NX for multi-instance (matches @hazeljs/distributed-lock).
 */

export interface DistributedLockHandle {
  release(): Promise<void>;
}

export interface DistributedLock {
  /**
   * Acquire lock. Returns null if not acquired within attempts.
   */
  acquire(key: string, ttlMs: number): Promise<DistributedLockHandle | null>;
}

export class MemoryDistributedLock implements DistributedLock {
  private readonly held = new Map<string, { owner: string; expiresAt: number }>();

  async acquire(key: string, ttlMs: number): Promise<DistributedLockHandle | null> {
    const now = Date.now();
    const existing = this.held.get(key);
    if (existing && existing.expiresAt > now) {
      return null;
    }
    const owner = `mem_${now}_${Math.random().toString(36).slice(2)}`;
    this.held.set(key, { owner, expiresAt: now + ttlMs });
    return {
      release: async (): Promise<void> => {
        const cur = this.held.get(key);
        if (cur?.owner === owner) this.held.delete(key);
      },
    };
  }
}

/** Duck-typed Redis for SET key NX PX ttl. */
export interface RedisLockClient {
  set(key: string, value: string, ...args: unknown[]): Promise<string | null>;
  del?(...keys: string[]): Promise<unknown>;
  eval?(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
}

export class RedisDistributedLock implements DistributedLock {
  constructor(
    private readonly redis: RedisLockClient,
    private readonly keyPrefix = 'hazel:gov-lock:'
  ) {}

  async acquire(key: string, ttlMs: number): Promise<DistributedLockHandle | null> {
    const full = `${this.keyPrefix}${key}`;
    const owner = `redis_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const result = await this.redis.set(full, owner, 'PX', ttlMs, 'NX');
    if (result !== 'OK') return null;
    return {
      release: async (): Promise<void> => {
        if (this.redis.eval) {
          await this.redis.eval(
            `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
            1,
            full,
            owner
          );
        } else if (this.redis.del) {
          await this.redis.del(full);
        }
      },
    };
  }
}

/** Shared fake Redis for two-instance tests. */
export class FakeRedisLockClient implements RedisLockClient {
  readonly data = new Map<string, { value: string; expiresAt?: number }>();

  async set(key: string, value: string, ...args: unknown[]): Promise<string | null> {
    let px: number | undefined;
    let nx = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === 'PX' && typeof args[i + 1] === 'number') px = args[i + 1] as number;
      if (args[i] === 'NX') nx = true;
    }
    const now = Date.now();
    const existing = this.data.get(key);
    if (existing?.expiresAt !== undefined && existing.expiresAt <= now) {
      this.data.delete(key);
    }
    if (nx && this.data.has(key)) return null;
    this.data.set(key, { value, expiresAt: px !== undefined ? now + px : undefined });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let n = 0;
    for (const k of keys) {
      if (this.data.delete(k)) n += 1;
    }
    return n;
  }

  async eval(script: string, _numKeys: number, ...args: (string | number)[]): Promise<number> {
    void script;
    const key = String(args[0]);
    const owner = String(args[1]);
    const cur = this.data.get(key);
    if (cur?.value === owner) {
      this.data.delete(key);
      return 1;
    }
    return 0;
  }

  async get(key: string): Promise<string | null> {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }
}
