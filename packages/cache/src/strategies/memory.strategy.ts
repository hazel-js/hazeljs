import { ICacheStore, CacheEntry, CacheStats } from '../cache.types';
import logger from '@hazeljs/core';

/**
 * In-memory cache store implementation
 */
export class MemoryCacheStore implements ICacheStore {
  private cache: Map<string, CacheEntry> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
  };
  private cleanupInterval?: NodeJS.Timeout;

  constructor(private cleanupIntervalMs: number = 60000) {
    this.startCleanup();
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      logger.debug(`Cache miss: ${key}`);
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromTagIndex(key, entry.tags);
      this.stats.misses++;
      logger.debug(`Cache expired: ${key}`);
      return null;
    }

    // Update last accessed for sliding TTL
    if (entry.lastAccessedAt !== undefined) {
      entry.lastAccessedAt = Date.now();
    }

    this.stats.hits++;
    logger.debug(`Cache hit: ${key}`);
    return entry.value as T;
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      value,
      key,
      cachedAt: now,
      expiresAt: now + ttl * 1000,
      lastAccessedAt: now,
    };

    this.cache.set(key, entry);
    logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`);
  }

  /**
   * Set a value with tags
   */
  async setWithTags<T>(key: string, value: T, ttl: number, tags?: string[]): Promise<void> {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      value,
      key,
      cachedAt: now,
      expiresAt: now + ttl * 1000,
      lastAccessedAt: now,
      tags,
    };

    this.cache.set(key, entry);

    // Update tag index
    if (tags) {
      tags.forEach((tag) => {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(key);
      });
    }

    logger.debug(`Cache set with tags: ${key} (TTL: ${ttl}s, Tags: ${tags?.join(', ')})`);
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<void> {
    const entry = this.cache.get(key);
    if (entry) {
      this.removeFromTagIndex(key, entry.tags);
    }
    this.cache.delete(key);
    logger.debug(`Cache deleted: ${key}`);
  }

  /**
   * Delete entries by tag
   */
  async deleteByTag(tag: string): Promise<void> {
    const keys = this.tagIndex.get(tag);
    if (!keys) {
      return;
    }

    for (const key of keys) {
      await this.delete(key);
    }

    this.tagIndex.delete(tag);
    logger.debug(`Cache invalidated by tag: ${tag} (${keys.size} entries)`);
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromTagIndex(key, entry.tags);
      return false;
    }

    return true;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.tagIndex.clear();
    logger.info('Cache cleared');
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys());

    if (!pattern) {
      return allKeys;
    }

    // Simple pattern matching (supports * wildcard)
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return allKeys.filter((key) => regex.test(key));
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    // Calculate approximate memory usage
    let memoryUsage = 0;
    for (const entry of this.cache.values()) {
      const entrySize = JSON.stringify(entry.value).length;
      memoryUsage += entrySize;
    }

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      size: this.cache.size,
      memoryUsage,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        this.removeFromTagIndex(key, entry.tags);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      logger.debug(`Cleaned up ${expiredCount} expired cache entries`);
    }
  }

  /**
   * Remove key from tag index
   */
  private removeFromTagIndex(key: string, tags?: string[]): void {
    if (!tags) {
      return;
    }

    tags.forEach((tag) => {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        keys.delete(key);
        if (keys.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    });
  }

  /**
   * Destroy the cache store
   */
  destroy(): void {
    this.stopCleanup();
    this.cache.clear();
    this.tagIndex.clear();
  }
}
