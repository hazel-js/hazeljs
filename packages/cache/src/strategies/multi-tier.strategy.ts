import { ICacheStore, CacheStats } from '../cache.types';
import { MemoryCacheStore } from './memory.strategy';
import { RedisCacheStore } from './redis.strategy';
import logger from '@hazeljs/core';

/**
 * Multi-tier cache store implementation
 * Uses memory cache as L1 and Redis as L2
 */
export class MultiTierCacheStore implements ICacheStore {
  private l1Cache: MemoryCacheStore;
  private l2Cache: RedisCacheStore;

  constructor(options?: { redis?: { host?: string; port?: number; password?: string } }) {
    this.l1Cache = new MemoryCacheStore();
    this.l2Cache = new RedisCacheStore(options?.redis);
    logger.info('Multi-tier cache store initialized (L1: Memory, L2: Redis)');
  }

  /**
   * Get a value from cache (L1 first, then L2)
   */
  async get<T>(key: string): Promise<T | null> {
    // Try L1 cache first
    let value = await this.l1Cache.get<T>(key);
    if (value !== null) {
      logger.debug(`Multi-tier cache hit (L1): ${key}`);
      return value;
    }

    // Try L2 cache
    value = await this.l2Cache.get<T>(key);
    if (value !== null) {
      logger.debug(`Multi-tier cache hit (L2): ${key}`);
      // Promote to L1
      await this.l1Cache.set(key, value, 300); // 5 minutes in L1
      return value;
    }

    logger.debug(`Multi-tier cache miss: ${key}`);
    return null;
  }

  /**
   * Set a value in cache (both L1 and L2)
   */
  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    // Set in both caches
    await Promise.all([
      this.l1Cache.set(key, value, Math.min(ttl, 300)), // Max 5 minutes in L1
      this.l2Cache.set(key, value, ttl),
    ]);

    logger.debug(`Multi-tier cache set: ${key} (TTL: ${ttl}s)`);
  }

  /**
   * Set a value with tags
   */
  async setWithTags<T>(key: string, value: T, ttl: number, tags?: string[]): Promise<void> {
    await Promise.all([
      this.l1Cache.setWithTags(key, value, Math.min(ttl, 300), tags),
      this.l2Cache.setWithTags(key, value, ttl, tags),
    ]);

    logger.debug(
      `Multi-tier cache set with tags: ${key} (TTL: ${ttl}s, Tags: ${tags?.join(', ')})`
    );
  }

  /**
   * Delete a value from cache (both L1 and L2)
   */
  async delete(key: string): Promise<void> {
    await Promise.all([this.l1Cache.delete(key), this.l2Cache.delete(key)]);

    logger.debug(`Multi-tier cache deleted: ${key}`);
  }

  /**
   * Delete entries by tag
   */
  async deleteByTag(tag: string): Promise<void> {
    await Promise.all([this.l1Cache.deleteByTag(tag), this.l2Cache.deleteByTag(tag)]);

    logger.debug(`Multi-tier cache invalidated by tag: ${tag}`);
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    const inL1 = await this.l1Cache.has(key);
    if (inL1) {
      return true;
    }

    return await this.l2Cache.has(key);
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    await Promise.all([this.l1Cache.clear(), this.l2Cache.clear()]);

    logger.info('Multi-tier cache cleared');
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern?: string): Promise<string[]> {
    // Get keys from both caches and merge
    const [l1Keys, l2Keys] = await Promise.all([
      this.l1Cache.keys(pattern),
      this.l2Cache.keys(pattern),
    ]);

    // Merge and deduplicate
    return Array.from(new Set([...l1Keys, ...l2Keys]));
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const [l1Stats, l2Stats] = await Promise.all([
      this.l1Cache.getStats(),
      this.l2Cache.getStats(),
    ]);

    // Combine stats
    const totalHits = l1Stats.hits + l2Stats.hits;
    const totalMisses = l1Stats.misses + l2Stats.misses;
    const total = totalHits + totalMisses;
    const hitRate = total > 0 ? (totalHits / total) * 100 : 0;

    return {
      hits: totalHits,
      misses: totalMisses,
      hitRate: Math.round(hitRate * 100) / 100,
      size: l1Stats.size + l2Stats.size,
      memoryUsage: l1Stats.memoryUsage,
    };
  }

  /**
   * Get L1 cache statistics
   */
  async getL1Stats(): Promise<CacheStats> {
    return await this.l1Cache.getStats();
  }

  /**
   * Get L2 cache statistics
   */
  async getL2Stats(): Promise<CacheStats> {
    return await this.l2Cache.getStats();
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.l1Cache.resetStats();
    this.l2Cache.resetStats();
  }

  /**
   * Destroy the cache store
   */
  async destroy(): Promise<void> {
    this.l1Cache.destroy();
    await this.l2Cache.disconnect();
    logger.info('Multi-tier cache destroyed');
  }
}
