/**
 * @hazeljs/cache - Caching module for HazelJS
 */

export { CacheModule, type CacheModuleOptions } from './cache.module';
export { CacheService, CacheManager } from './cache.service';
export {
  Cache,
  CacheKey,
  CacheTTL,
  CacheTags,
  CacheEvict,
  getCacheMetadata,
  hasCacheMetadata,
  getCacheEvictMetadata,
} from './decorators/cache.decorator';
export {
  type CacheOptions,
  type CacheStrategy,
  type TTLStrategy,
  type CacheEntry,
  type CacheStats,
  type ICacheStore,
  type CacheWarmingOptions,
  type CacheInvalidationEvent,
} from './cache.types';
export { MemoryCacheStore } from './strategies/memory.strategy';
export { RedisCacheStore } from './strategies/redis.strategy';
export { MultiTierCacheStore } from './strategies/multi-tier.strategy';
