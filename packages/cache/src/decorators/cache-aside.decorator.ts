import 'reflect-metadata';
import { CacheAsideOptions } from '../cache.types';
import logger from '@hazeljs/core';

const CACHE_ASIDE_METADATA_KEY = 'hazel:cache:aside';
type GenericMethod = (this: unknown, ...args: unknown[]) => unknown | Promise<unknown>;
type CacheClient = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown, options?: { ttl?: number }) => Promise<unknown>;
};

/**
 * Cache Aside decorator for automatic cache-aside pattern
 *
 * @example
 * ```typescript
 * @CacheAside({
 *   key: 'product-{id}',
 *   ttl: 3600,
 *   fallback: () => this.db.product.findDefault()
 * })
 * async getProduct(id: string) {
 *   return await this.db.product.findUnique({ where: { id } });
 * }
 * ```
 */
export function CacheAside(options: CacheAsideOptions): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): void {
    const defaults: CacheAsideOptions = {
      ttl: 3600,
      ...options,
    };

    // Store metadata
    Reflect.defineMetadata(CACHE_ASIDE_METADATA_KEY, defaults, target, propertyKey);

    logger.debug(
      `CacheAside decorator applied to ${target.constructor.name}.${String(propertyKey)}`
    );

    // Wrap the original method
    const originalMethod = descriptor.value;

    if (typeof originalMethod === 'function') {
      descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
        const method = originalMethod as GenericMethod;
        const cacheKey = generateCacheKey(
          defaults.key ||
            `${(target as { constructor: { name: string } }).constructor.name}.${String(propertyKey)}`,
          args,
          String(propertyKey)
        );
        const cacheService = getCacheService(this);

        if (!cacheService) {
          logger.warn(
            `No cache service found for ${(target as { constructor: { name: string } }).constructor.name}.${String(propertyKey)}`
          );
          return await method.apply(this, args);
        }

        // Try to get from cache first
        const cached = await cacheService.get(cacheKey);
        if (cached !== null) {
          logger.debug(`Cache hit for ${cacheKey}`);
          return cached;
        }

        // Cache miss - execute original method
        logger.debug(`Cache miss for ${cacheKey}`);
        const result = await method.apply(this, args);

        // Store in cache
        if (result !== null) {
          await cacheService.set(cacheKey, result, { ttl: defaults.ttl });
          logger.debug(`Stored result in cache for ${cacheKey}`);
        }

        return result;
      };
    }
  };
}

/**
 * Get cache aside metadata from a method
 */
export function getCacheAsideMetadata(
  target: object,
  propertyKey: string | symbol
): CacheAsideOptions | undefined {
  return Reflect.getMetadata(CACHE_ASIDE_METADATA_KEY, target, propertyKey);
}

/**
 * Check if a method has cache aside metadata
 */
export function hasCacheAsideMetadata(target: object, propertyKey: string | symbol): boolean {
  return Reflect.hasMetadata(CACHE_ASIDE_METADATA_KEY, target, propertyKey);
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
 * CacheAside decorator factory for easier usage
 */
export function CacheAsideBuilder(options: Partial<CacheAsideOptions> = {}) {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor | void {
    // Auto-generate key pattern if not provided
    const keyPattern =
      options.key || `${target.constructor.name.toLowerCase()}-${String(propertyKey)}-{method}`;

    return CacheAside({ ...options, key: keyPattern })(target, propertyKey, descriptor);
  };
}

/**
 * CacheAside with automatic fallback to default value
 */
export function CacheAsideWithFallback<T>(
  options: CacheAsideOptions & { fallbackValue: T }
): MethodDecorator {
  const { fallbackValue, ...asideOptions } = options;

  return CacheAside({
    ...asideOptions,
    fallback: () => Promise.resolve(fallbackValue),
  });
}
