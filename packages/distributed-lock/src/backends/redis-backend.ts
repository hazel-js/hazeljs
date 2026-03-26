import Redis from 'ioredis';
import { ILock, ILockBackend, LockOptions } from '../interfaces';

export class RedisLock implements ILock {
  constructor(
    private readonly backend: RedisLockBackend,
    private readonly key: string,
    private readonly identifier: string
  ) {}

  async release(): Promise<void> {
    return this.backend.release(this.key, this.identifier);
  }

  async extend(ttl: number): Promise<boolean> {
    return this.backend.extend(this.key, this.identifier, ttl);
  }
}

export class RedisLockBackend implements ILockBackend {
  private readonly redis: Redis;

  constructor(redisOptions: unknown) {
    if (redisOptions && typeof (redisOptions as Record<string, unknown>).set === 'function') {
      this.redis = redisOptions as Redis;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.redis = new Redis(redisOptions as any);
    }
  }

  async acquire(options: LockOptions): Promise<ILock | null> {
    const { key, ttl = 30000, retry } = options;
    const identifier = Math.random().toString(36).substring(2);

    const attempt = async (): Promise<ILock | null> => {
      // SET key identifier NX PX ttl
      const result = await this.redis.set(key, identifier, 'PX', ttl, 'NX');
      if (result === 'OK') {
        return new RedisLock(this, key, identifier);
      }
      return null;
    };

    let lock = await attempt();
    if (lock) return lock;

    if (retry) {
      for (let i = 0; i < retry.attempts; i++) {
        await new Promise((resolve) => setTimeout(resolve, retry.delay));
        lock = await attempt();
        if (lock) return lock;
      }
    }

    return null;
  }

  async release(key: string, identifier: string): Promise<void> {
    // Atomic release using Lua script to ensure only the owner can release
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await this.redis.eval(script, 1, key, identifier);
  }

  async extend(key: string, identifier: string, ttl: number): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
    const result = await this.redis.eval(script, 1, key, identifier, ttl);
    return result === 1;
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}
