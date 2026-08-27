import { CacheLockOptions } from '../cache.types';
import {
  LockManager,
  RedisDistributedLock,
  MemoryDistributedLock,
} from '../strategies/distributed-lock.strategy';
import logger from '@hazeljs/core';

const CACHE_LOCK_METADATA_KEY = 'hazel:cache:lock';
type CacheServiceWithStore = { store?: { constructor?: { name?: string }; redis?: unknown } };
type LockOwner = {
  _cacheLockManager?: LockManager;
  cacheService?: CacheServiceWithStore;
  cache?: CacheServiceWithStore;
};

/**
 * Cache Lock decorator to prevent cache stampede
 *
 * @example
 * ```typescript
 * @CacheLock({
 *   key: 'user-{id}',
 *   ttl: 30000,
 *   retryDelay: 1000,
 *   maxRetries: 3
 * })
 * async expensiveOperation(id: string) {
 *   // Only one instance will execute at a time
 *   return await this.computeExpensiveResult(id);
 * }
 * ```
 */
export function CacheLock(options: CacheLockOptions): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    _descriptor: PropertyDescriptor
  ): void {
    const defaults: CacheLockOptions = {
      ttl: 30000,
      retryDelay: 1000,
      maxRetries: 3,
      ...options,
    };

    // Store metadata
    Reflect.defineMetadata(CACHE_LOCK_METADATA_KEY, defaults, target, propertyKey);

    logger.debug(
      `CacheLock decorator applied to ${target.constructor.name}.${String(propertyKey)}`
    );

    // Note: The actual locking logic will be implemented by an interceptor
    // This decorator just marks the method and stores configuration
  };
}

/**
 * Get cache lock metadata from a method
 */
export function getCacheLockMetadata(
  target: object,
  propertyKey: string | symbol
): CacheLockOptions | undefined {
  return Reflect.getMetadata(CACHE_LOCK_METADATA_KEY, target, propertyKey);
}

/**
 * Check if a method has cache lock metadata
 */
export function hasCacheLockMetadata(target: object, propertyKey: string | symbol): boolean {
  return Reflect.hasMetadata(CACHE_LOCK_METADATA_KEY, target, propertyKey);
}

/**
 * Generate lock key from pattern and arguments
 */
function _generateLockKey(pattern: string, args: unknown[], methodName: string): string {
  let key = pattern;

  // Replace method name placeholder
  key = key.replace('{method}', methodName);

  // Replace argument placeholders
  args.forEach((arg, index) => {
    key = key.replace(`{${index}}`, String(arg));
  });

  // Replace named placeholders (for object arguments)
  if (args.length > 0 && typeof args[0] === 'object') {
    const obj = args[0] as Record<string, unknown>;
    Object.keys(obj).forEach((prop) => {
      key = key.replace(`{${prop}}`, String(obj[prop]));
    });
  }

  return key;
}

/**
 * Get or create lock manager from instance
 */
function _getLockManager(instance: LockOwner): LockManager {
  // Check if instance already has lock manager
  if (instance._cacheLockManager) {
    return instance._cacheLockManager;
  }

  // Try to get cache service from instance
  const cacheService = instance.cacheService || instance.cache;

  if (cacheService?.store) {
    // Check if Redis store is available
    const storeName = cacheService.store.constructor?.name ?? '';
    if (storeName.includes('Redis') && cacheService.store.redis) {
      const redisLock = new RedisDistributedLock(
        cacheService.store.redis as {
          set: (...args: unknown[]) => Promise<unknown>;
          eval: (...args: unknown[]) => Promise<unknown>;
          exists: (key: string) => Promise<number>;
        }
      );
      instance._cacheLockManager = new LockManager(redisLock);
      logger.debug('Using Redis distributed lock');
      return instance._cacheLockManager;
    }
  }

  // Fallback to memory lock
  const memoryLock = new MemoryDistributedLock();
  instance._cacheLockManager = new LockManager(memoryLock);
  logger.debug('Using memory distributed lock (fallback)');
  return instance._cacheLockManager;
}

/**
 * CacheLock decorator factory for easier usage
 */
export function CacheLockBuilder(options: Partial<CacheLockOptions> = {}) {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor | void {
    // Auto-generate key pattern if not provided
    const keyPattern =
      options.key || `${target.constructor.name.toLowerCase()}-${String(propertyKey)}-{method}`;

    return CacheLock({ ...options, key: keyPattern })(target, propertyKey, descriptor);
  };
}
