import 'reflect-metadata';
import { CacheOptions } from '../cache.types';
import logger from '@hazeljs/core';

const CACHE_METADATA_KEY = 'hazel:cache';

/**
 * Cache decorator for methods
 *
 * @example
 * ```typescript
 * @Cache({
 *   strategy: 'memory',
 *   ttl: 3600,
 *   key: 'user-{id}',
 *   tags: ['users']
 * })
 * @Get('/users/:id')
 * async getUser(@Param('id') id: string) {
 *   return this.userService.findById(id);
 * }
 * ```
 */
export function Cache(options: CacheOptions = {}): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const defaults: CacheOptions = {
      strategy: 'memory',
      ttl: 3600,
      ttlStrategy: 'absolute',
      cacheNull: false,
      ...options,
    };

    // Store metadata
    Reflect.defineMetadata(CACHE_METADATA_KEY, defaults, target, propertyKey);

    logger.debug(`Cache decorator applied to ${target.constructor.name}.${String(propertyKey)}`);

    // Note: The actual caching logic will be implemented by the CacheInterceptor
    // This decorator just marks the method and stores configuration

    return descriptor;
  };
}

/**
 * Get cache metadata from a method
 */
export function getCacheMetadata(
  target: object,
  propertyKey: string | symbol
): CacheOptions | undefined {
  return Reflect.getMetadata(CACHE_METADATA_KEY, target, propertyKey);
}

/**
 * Check if a method has cache metadata
 */
export function hasCacheMetadata(target: object, propertyKey: string | symbol): boolean {
  return Reflect.hasMetadata(CACHE_METADATA_KEY, target, propertyKey);
}

/**
 * CacheKey decorator to specify custom cache key generation
 *
 * @example
 * ```typescript
 * @CacheKey('user-{id}-{role}')
 * @Get('/users/:id')
 * async getUser(@Param('id') id: string, @Query('role') role: string) {
 *   return this.userService.findById(id);
 * }
 * ```
 */
export function CacheKey(keyPattern: string): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const existingMetadata = getCacheMetadata(target, propertyKey) || {};
    const updatedMetadata: CacheOptions = {
      ...existingMetadata,
      key: keyPattern,
    };

    Reflect.defineMetadata(CACHE_METADATA_KEY, updatedMetadata, target, propertyKey);

    return descriptor;
  };
}

/**
 * CacheTTL decorator to specify cache TTL
 *
 * @example
 * ```typescript
 * @CacheTTL(7200) // 2 hours
 * @Get('/users')
 * async getUsers() {
 *   return this.userService.findAll();
 * }
 * ```
 */
export function CacheTTL(ttl: number): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const existingMetadata = getCacheMetadata(target, propertyKey) || {};
    const updatedMetadata: CacheOptions = {
      ...existingMetadata,
      ttl,
    };

    Reflect.defineMetadata(CACHE_METADATA_KEY, updatedMetadata, target, propertyKey);

    return descriptor;
  };
}

/**
 * CacheTags decorator to specify cache tags
 *
 * @example
 * ```typescript
 * @CacheTags(['users', 'profiles'])
 * @Get('/users/:id/profile')
 * async getUserProfile(@Param('id') id: string) {
 *   return this.userService.getProfile(id);
 * }
 * ```
 */
export function CacheTags(tags: string[]): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const existingMetadata = getCacheMetadata(target, propertyKey) || {};
    const updatedMetadata: CacheOptions = {
      ...existingMetadata,
      tags,
    };

    Reflect.defineMetadata(CACHE_METADATA_KEY, updatedMetadata, target, propertyKey);

    return descriptor;
  };
}

/**
 * CacheEvict decorator to evict cache entries
 *
 * @example
 * ```typescript
 * @CacheEvict({ tags: ['users'] })
 * @Post('/users')
 * async createUser(@Body() user: CreateUserDto) {
 *   return this.userService.create(user);
 * }
 * ```
 */
export function CacheEvict(options: {
  keys?: string[];
  tags?: string[];
  all?: boolean;
}): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('hazel:cache:evict', options, target, propertyKey);

    return descriptor;
  };
}

/**
 * Get cache evict metadata
 */
export function getCacheEvictMetadata(
  target: object,
  propertyKey: string | symbol
): { keys?: string[]; tags?: string[]; all?: boolean } | undefined {
  return Reflect.getMetadata('hazel:cache:evict', target, propertyKey);
}
