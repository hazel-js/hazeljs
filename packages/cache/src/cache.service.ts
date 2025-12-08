import { Injectable } from '@hazeljs/core';
import { ICacheStore, CacheStats, CacheWarmingOptions, CacheStrategy } from './cache.types';
import { MemoryCacheStore } from './strategies/memory.strategy';
import { RedisCacheStore } from './strategies/redis.strategy';
import { MultiTierCacheStore } from './strategies/multi-tier.strategy';
import logger from '@hazeljs/core';

/**
 * Cache service for managing cache operations
 */
@Injectable()
export class CacheService {
  private store: ICacheStore;
  private strategy: CacheStrategy;

  constructor(strategy: CacheStrategy = 'memory', options?: unknown) {
    this.strategy = strategy;
    this.store = this.createStore(strategy, options);
    logger.info(`Cache service initialized with strategy: ${strategy}`);
  }

  /**
   * Create cache store based on strategy
   */
  private createStore(strategy: CacheStrategy, options?: unknown): ICacheStore {
    const opts = options as Record<string, unknown> | undefined;
    switch (strategy) {
      case 'redis':
        return new RedisCacheStore(
          opts?.redis as { host?: string; port?: number; password?: string }
        );
      case 'multi-tier':
        return new MultiTierCacheStore(
          opts as { redis?: { host?: string; port?: number; password?: string } }
        );
      case 'memory':
      default:
        return new MemoryCacheStore(opts?.cleanupInterval as number);
    }
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    return await this.store.get<T>(key);
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.store.set(key, value, ttl);
  }

  /**
   * Set a value with tags
   */
  async setWithTags<T>(key: string, value: T, ttl: number, tags?: string[]): Promise<void> {
    if (
      'setWithTags' in this.store &&
      typeof (this.store as { setWithTags?: unknown }).setWithTags === 'function'
    ) {
      await (
        this.store as {
          setWithTags: (key: string, value: T, ttl: number, tags?: string[]) => Promise<void>;
        }
      ).setWithTags(key, value, ttl, tags);
    } else {
      await this.store.set(key, value, ttl);
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    await this.store.delete(key);
  }

  /**
   * Delete entries by tag
   */
  async deleteByTag(tag: string): Promise<void> {
    if (
      'deleteByTag' in this.store &&
      typeof (this.store as { deleteByTag?: unknown }).deleteByTag === 'function'
    ) {
      await (this.store as { deleteByTag: (tag: string) => Promise<void> }).deleteByTag(tag);
    } else {
      logger.warn(`deleteByTag not supported for ${this.strategy} strategy`);
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateTags(tags: string[]): Promise<void> {
    for (const tag of tags) {
      await this.deleteByTag(tag);
    }
    logger.info(`Invalidated cache for tags: ${tags.join(', ')}`);
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    return await this.store.has(key);
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    await this.store.clear();
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern?: string): Promise<string[]> {
    return await this.store.keys(pattern);
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    return await this.store.getStats();
  }

  /**
   * Warm up cache with predefined data
   */
  async warmUp(options: CacheWarmingOptions): Promise<void> {
    const { keys, fetcher, ttl = 3600, parallel = true } = options;

    logger.info(`Warming up cache for ${keys.length} keys...`);

    const warmUpKey = async (key: string): Promise<void> => {
      try {
        const data = await fetcher(key);
        await this.set(key, data, ttl);
        logger.debug(`Warmed up cache key: ${key}`);
      } catch (error) {
        logger.error(`Failed to warm up cache key ${key}:`, error);
      }
    };

    if (parallel) {
      await Promise.all(keys.map(warmUpKey));
    } else {
      for (const key of keys) {
        await warmUpKey(key);
      }
    }

    logger.info(`Cache warming completed for ${keys.length} keys`);
  }

  /**
   * Get or set a value (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number,
    tags?: string[]
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch data
    const data = await fetcher();

    // Store in cache
    if (tags) {
      await this.setWithTags(key, data, ttl || 3600, tags);
    } else {
      await this.set(key, data, ttl);
    }

    return data;
  }

  /**
   * Wrap a function with caching
   */
  wrap<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
    return this.getOrSet(key, fn, ttl);
  }

  /**
   * Get the underlying cache store
   */
  getStore(): ICacheStore {
    return this.store;
  }

  /**
   * Get cache strategy
   */
  getStrategy(): CacheStrategy {
    return this.strategy;
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    if (
      'resetStats' in this.store &&
      typeof (this.store as { resetStats?: unknown }).resetStats === 'function'
    ) {
      (this.store as { resetStats: () => void }).resetStats();
    }
  }
}

/**
 * Cache manager for managing multiple cache instances
 */
export class CacheManager {
  private caches: Map<string, CacheService> = new Map();
  private defaultCache?: CacheService;

  /**
   * Register a cache instance
   */
  register(name: string, cache: CacheService, isDefault = false): void {
    this.caches.set(name, cache);
    if (isDefault || !this.defaultCache) {
      this.defaultCache = cache;
    }
    logger.info(`Cache registered: ${name}${isDefault ? ' (default)' : ''}`);
  }

  /**
   * Get a cache instance by name
   */
  get(name?: string): CacheService {
    if (!name) {
      if (!this.defaultCache) {
        throw new Error('No default cache configured');
      }
      return this.defaultCache;
    }

    const cache = this.caches.get(name);
    if (!cache) {
      throw new Error(`Cache not found: ${name}`);
    }

    return cache;
  }

  /**
   * Get all cache instances
   */
  getAll(): Map<string, CacheService> {
    return this.caches;
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    await Promise.all(Array.from(this.caches.values()).map((cache) => cache.clear()));
    logger.info('All caches cleared');
  }

  /**
   * Get statistics for all caches
   */
  async getAllStats(): Promise<Map<string, CacheStats>> {
    const stats = new Map<string, CacheStats>();

    for (const [name, cache] of this.caches.entries()) {
      stats.set(name, await cache.getStats());
    }

    return stats;
  }

  /**
   * Invalidate tags across all caches
   */
  async invalidateTagsGlobal(tags: string[]): Promise<void> {
    await Promise.all(Array.from(this.caches.values()).map((cache) => cache.invalidateTags(tags)));
    logger.info(`Invalidated tags globally: ${tags.join(', ')}`);
  }
}
