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

// New decorators for advanced caching patterns
export {
  CacheLock,
  CacheLockBuilder,
  getCacheLockMetadata,
  hasCacheLockMetadata,
} from './decorators/cache-lock.decorator';

export {
  CacheAside,
  CacheAsideBuilder,
  CacheAsideWithFallback,
  getCacheAsideMetadata,
  hasCacheAsideMetadata,
} from './decorators/cache-aside.decorator';

export {
  CacheWrite,
  CacheWriteBuilder,
  WriteThrough,
  WriteBehind,
  getCacheWriteMetadata,
  hasCacheWriteMetadata,
} from './decorators/cache-write.decorator';

export {
  CacheWarm,
  CacheWarmBuilder,
  CacheWarmingUtils,
  getCacheWarmMetadata,
  hasCacheWarmMetadata,
} from './decorators/cache-warm.decorator';

export {
  type CacheOptions,
  type CacheStrategy,
  type TTLStrategy,
  type CacheEntry,
  type CacheStats,
  type ICacheStore,
  type CacheWarmingOptions,
  type CacheInvalidationEvent,
  // New types
  type CacheLockOptions,
  type CacheAsideOptions,
  type CacheWriteOptions,
  type CacheEventType,
  type CacheEvent,
  type CacheHealth,
  type CacheLevel,
  type CompressionOptions,
} from './cache.types';

export { MemoryCacheStore } from './strategies/memory.strategy';
export { RedisCacheStore } from './strategies/redis.strategy';
export { MultiTierCacheStore } from './strategies/multi-tier.strategy';

// New distributed lock strategies
export {
  IDistributedLock,
  RedisDistributedLock,
  MemoryDistributedLock,
  LockManager,
} from './strategies/distributed-lock.strategy';
