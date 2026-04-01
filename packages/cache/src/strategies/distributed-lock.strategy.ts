import { EventEmitter } from 'eventemitter3';
import logger from '@hazeljs/core';

/**
 * Distributed lock interface
 */
export interface IDistributedLock {
  acquire(key: string, ttl?: number): Promise<boolean>;
  release(key: string): Promise<boolean>;
  isLocked(key: string): Promise<boolean>;
}

/**
 * Redis distributed lock implementation
 */
export class RedisDistributedLock implements IDistributedLock {
  private lockPrefix = 'lock:';
  private lockValue = Symbol('lock');

  constructor(
    private redis: {
      set: (...args: unknown[]) => Promise<unknown>;
      eval: (...args: unknown[]) => Promise<unknown>;
      exists: (key: string) => Promise<number>;
    }
  ) {}

  async acquire(key: string, ttl: number = 30000): Promise<boolean> {
    const lockKey = this.lockPrefix + key;
    const lockValue = Date.now().toString();

    try {
      // Use Redis SET with NX and EX options for atomic lock acquisition
      const result = await this.redis.set(
        lockKey,
        lockValue,
        'PX', // Set expiration in milliseconds
        ttl,
        'NX' // Only set if key doesn't exist
      );

      const acquired = result === 'OK';

      if (acquired) {
        logger.debug(`Distributed lock acquired: ${key} (TTL: ${ttl}ms)`);
      } else {
        logger.debug(`Failed to acquire distributed lock: ${key}`);
      }

      return acquired;
    } catch (error) {
      logger.error(`Error acquiring distributed lock ${key}:`, error);
      return false;
    }
  }

  async release(key: string): Promise<boolean> {
    const lockKey = this.lockPrefix + key;

    try {
      // Use Lua script for atomic lock release
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(luaScript, 1, lockKey, this.lockValue);
      const released = result === 1;

      if (released) {
        logger.debug(`Distributed lock released: ${key}`);
      } else {
        logger.debug(`Lock not owned or expired: ${key}`);
      }

      return released;
    } catch (error) {
      logger.error(`Error releasing distributed lock ${key}:`, error);
      return false;
    }
  }

  async isLocked(key: string): Promise<boolean> {
    const lockKey = this.lockPrefix + key;

    try {
      const result = await this.redis.exists(lockKey);
      return result === 1;
    } catch (error) {
      logger.error(`Error checking lock status ${key}:`, error);
      return false;
    }
  }
}

/**
 * In-memory distributed lock (for single-instance scenarios)
 */
export class MemoryDistributedLock implements IDistributedLock {
  private locks = new Map<string, { value: string; expires: number }>();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(private cleanupIntervalMs: number = 60000) {
    this.startCleanup();
  }

  async acquire(key: string, ttl: number = 30000): Promise<boolean> {
    const now = Date.now();
    const expires = now + ttl;

    // Check if lock exists and is not expired
    const existing = this.locks.get(key);
    if (existing && existing.expires > now) {
      return false;
    }

    // Acquire lock
    this.locks.set(key, { value: Date.now().toString(), expires });
    logger.debug(`Memory lock acquired: ${key} (TTL: ${ttl}ms)`);
    return true;
  }

  async release(key: string): Promise<boolean> {
    const released = this.locks.delete(key);
    if (released) {
      logger.debug(`Memory lock released: ${key}`);
    }
    return released;
  }

  async isLocked(key: string): Promise<boolean> {
    const lock = this.locks.get(key);
    if (!lock) return false;

    if (Date.now() > lock.expires) {
      this.locks.delete(key);
      return false;
    }

    return true;
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);
  }

  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, lock] of this.locks.entries()) {
      if (now > lock.expires) {
        this.locks.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      logger.debug(`Cleaned up ${expiredCount} expired locks`);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.locks.clear();
  }
}

/**
 * Lock manager with retry logic
 */
export class LockManager extends EventEmitter {
  constructor(private lock: IDistributedLock) {
    super();
  }

  async withLock<T>(
    key: string,
    operation: () => Promise<T>,
    options: {
      ttl?: number;
      retryDelay?: number;
      maxRetries?: number;
    } = {}
  ): Promise<T> {
    const { ttl = 30000, retryDelay = 1000, maxRetries = 3 } = options;

    let attempts = 0;

    while (attempts <= maxRetries) {
      const acquired = await this.lock.acquire(key, ttl);

      if (acquired) {
        try {
          this.emit('lock-acquired', key);
          const result = await operation();
          return result;
        } finally {
          await this.lock.release(key);
          this.emit('lock-released', key);
        }
      }

      attempts++;

      if (attempts <= maxRetries) {
        this.emit('lock-retry', key, attempts);
        await this.delay(retryDelay);
      }
    }

    throw new Error(`Failed to acquire lock after ${maxRetries} attempts: ${key}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
