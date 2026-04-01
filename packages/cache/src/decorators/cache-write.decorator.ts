import 'reflect-metadata';
import { CacheWriteOptions } from '../cache.types';
import logger from '@hazeljs/core';

const CACHE_WRITE_METADATA_KEY = 'hazel:cache:write';
type GenericMethod = (this: unknown, ...args: unknown[]) => unknown | Promise<unknown>;
type CacheClient = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown, ttl?: number) => Promise<unknown>;
};

/**
 * Write queue for async write-behind operations
 */
class WriteQueue {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private batchSize = 10;
  private flushInterval = 1000; // 1 second
  private flushTimer?: NodeJS.Timeout;

  constructor() {
    this.startFlushTimer();
  }

  add(operation: () => Promise<void>): void {
    this.queue.push(operation);

    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const operations = this.queue.splice(0, this.batchSize);

    try {
      await Promise.all(operations.map((op) => op()));
      logger.debug(`Processed ${operations.length} write-behind operations`);
    } catch (error) {
      logger.error('Error in write-beind operations:', error);
      // Re-add failed operations to the front of the queue
      this.queue.unshift(...operations);
    } finally {
      this.processing = false;
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    // Process remaining operations
    this.flush();
  }
}

/**
 * Cache Write decorator for write-through/write-behind patterns
 *
 * @example
 * ```typescript
 * @CacheWrite({
 *   strategy: 'write-through',
 *   key: 'product-{id}',
 *   ttl: 3600
 * })
 * async updateProduct(id: string, data: any) {
 *   return await this.db.product.update({ where: { id }, data });
 * }
 * ```
 */
export function CacheWrite(options: CacheWriteOptions): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const defaults: CacheWriteOptions = {
      strategy: 'write-through',
      ttl: 3600,
      async: true,
      ...options,
    };

    // Store metadata
    Reflect.defineMetadata(CACHE_WRITE_METADATA_KEY, defaults, target, propertyKey);

    logger.debug(
      `CacheWrite decorator applied to ${target.constructor.name}.${String(propertyKey)}`
    );

    // Wrap the original method
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const method = originalMethod as GenericMethod;
      const writeOptions = Reflect.getMetadata(
        CACHE_WRITE_METADATA_KEY,
        target,
        propertyKey
      ) as CacheWriteOptions;

      // Generate cache key from pattern
      const cacheKey = generateCacheKey(writeOptions.key, args, propertyKey.toString());

      // Get cache service from instance
      const cacheService = getCacheService(this);

      if (!cacheService) {
        logger.warn(
          `Cache service not found for ${target.constructor.name}.${String(propertyKey)}, executing original method`
        );
        return await method.apply(this, args);
      }

      try {
        // Execute the original method first
        const result = await method.apply(this, args);

        if (writeOptions.strategy === 'write-through') {
          // Write-through: Update cache immediately
          if (result !== null && result !== undefined) {
            await cacheService.set(cacheKey, result, writeOptions.ttl);
            logger.debug(
              `Write-through cache updated for ${target.constructor.name}.${String(propertyKey)}: ${cacheKey}`
            );
          }
        } else if (writeOptions.strategy === 'write-behind') {
          // Write-behind: Queue cache update for later
          if (writeOptions.async) {
            const writeQueue = getWriteQueue(this);
            writeQueue.add(async () => {
              if (result !== null && result !== undefined) {
                await cacheService.set(cacheKey, result, writeOptions.ttl);
                logger.debug(
                  `Write-behind cache updated for ${target.constructor.name}.${String(propertyKey)}: ${cacheKey}`
                );
              }
            });
            logger.debug(
              `Write-behind operation queued for ${target.constructor.name}.${String(propertyKey)}: ${cacheKey}`
            );
          } else {
            // Synchronous write-behind
            if (result !== null && result !== undefined) {
              await cacheService.set(cacheKey, result, writeOptions.ttl);
              logger.debug(
                `Synchronous write-behind cache updated for ${target.constructor.name}.${String(propertyKey)}: ${cacheKey}`
              );
            }
          }
        }

        return result;
      } catch (error) {
        logger.error(
          `Cache write operation failed for ${target.constructor.name}.${String(propertyKey)}:`,
          error
        );
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Get cache write metadata from a method
 */
export function getCacheWriteMetadata(
  target: object,
  propertyKey: string | symbol
): CacheWriteOptions | undefined {
  return Reflect.getMetadata(CACHE_WRITE_METADATA_KEY, target, propertyKey);
}

/**
 * Check if a method has cache write metadata
 */
export function hasCacheWriteMetadata(target: object, propertyKey: string | symbol): boolean {
  return Reflect.hasMetadata(CACHE_WRITE_METADATA_KEY, target, propertyKey);
}

/**
 * Generate cache key from pattern and arguments
 */
function generateCacheKey(pattern: string, args: unknown[], methodName: string): string {
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
 * Get cache service from instance
 */
function getCacheService(instance: unknown): CacheClient | null {
  // Try common cache service property names
  const maybeInstance = instance as {
    cacheService?: unknown;
    cache?: unknown;
    _cacheService?: unknown;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cacheService: any =
    maybeInstance.cacheService || maybeInstance.cache || maybeInstance._cacheService;

  if (
    cacheService &&
    typeof cacheService.get === 'function' &&
    typeof cacheService.set === 'function'
  ) {
    return cacheService as CacheClient;
  }

  return null;
}

/**
 * Get or create write queue for instance
 */
function getWriteQueue(instance: unknown): WriteQueue {
  const owner = instance as { _writeQueue?: WriteQueue };
  if (!owner._writeQueue) {
    owner._writeQueue = new WriteQueue();
  }
  return owner._writeQueue;
}

/**
 * CacheWrite decorator factory for easier usage
 */
export function CacheWriteBuilder(options: Partial<CacheWriteOptions> = {}) {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor | void {
    // Auto-generate key pattern if not provided
    const keyPattern =
      options.key || `${target.constructor.name.toLowerCase()}-${String(propertyKey)}-{method}`;

    return CacheWrite({ ...options, key: keyPattern })(target, propertyKey, descriptor);
  };
}

/**
 * Write-through shortcut decorator
 */
export function WriteThrough(
  options: Partial<Omit<CacheWriteOptions, 'strategy'>> = {}
): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor | void {
    logger.debug(
      `WriteThrough decorator applied to ${target.constructor.name}.${String(propertyKey)}`
    );

    // Auto-generate key if not provided
    const writeOptions: CacheWriteOptions = {
      ...options,
      strategy: 'write-through' as const,
      key:
        options.key || `${target.constructor.name.toLowerCase()}-${String(propertyKey)}-{method}`,
    };

    return CacheWrite(writeOptions)(target, propertyKey, descriptor);
  };
}

/**
 * Write-behind shortcut decorator
 */
export function WriteBehind(
  options: Partial<Omit<CacheWriteOptions, 'strategy'>> = {}
): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor | void {
    logger.debug(
      `WriteBehind decorator applied to ${target.constructor.name}.${String(propertyKey)}`
    );

    // Auto-generate key if not provided
    const writeOptions: CacheWriteOptions = {
      ...options,
      strategy: 'write-behind' as const,
      key:
        options.key || `${target.constructor.name.toLowerCase()}-${String(propertyKey)}-{method}`,
    };

    return CacheWrite(writeOptions)(target, propertyKey, descriptor);
  };
}
