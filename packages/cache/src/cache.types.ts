/**
 * Cache strategy types
 */
export type CacheStrategy = 'memory' | 'redis' | 'multi-tier';

/**
 * TTL strategy types
 */
export type TTLStrategy = 'absolute' | 'sliding';

/**
 * Cache options
 */
export interface CacheOptions {
  /**
   * Cache strategy to use
   * @default 'memory'
   */
  strategy?: CacheStrategy;

  /**
   * Time to live in seconds
   * @default 3600
   */
  ttl?: number;

  /**
   * TTL strategy
   * @default 'absolute'
   */
  ttlStrategy?: TTLStrategy;

  /**
   * Cache key pattern (supports placeholders like {id}, {userId})
   */
  key?: string;

  /**
   * Tags for group invalidation
   */
  tags?: string[];

  /**
   * Events that should invalidate this cache
   */
  invalidateOn?: string[];

  /**
   * Whether to cache null/undefined values
   * @default false
   */
  cacheNull?: boolean;

  /**
   * Custom condition function to determine if value should be cached
   */
  condition?: (value: unknown) => boolean;
}

/**
 * Cache entry metadata
 */
export interface CacheEntry<T = unknown> {
  /**
   * Cached value
   */
  value: T;

  /**
   * Timestamp when cached
   */
  cachedAt: number;

  /**
   * Expiration timestamp
   */
  expiresAt: number;

  /**
   * Last accessed timestamp (for sliding TTL)
   */
  lastAccessedAt?: number;

  /**
   * Cache tags
   */
  tags?: string[];

  /**
   * Cache key
   */
  key: string;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /**
   * Total number of cache hits
   */
  hits: number;

  /**
   * Total number of cache misses
   */
  misses: number;

  /**
   * Hit rate percentage
   */
  hitRate: number;

  /**
   * Total number of cached entries
   */
  size: number;

  /**
   * Total memory used (in bytes, if applicable)
   */
  memoryUsage?: number;
}

/**
 * Cache store interface
 */
export interface ICacheStore {
  /**
   * Get a value from cache
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in cache
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Delete a value from cache
   */
  delete(key: string): Promise<void>;

  /**
   * Check if key exists in cache
   */
  has(key: string): Promise<boolean>;

  /**
   * Clear all cache entries
   */
  clear(): Promise<void>;

  /**
   * Get all keys matching a pattern
   */
  keys(pattern?: string): Promise<string[]>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<CacheStats>;
}

/**
 * Cache warming options
 */
export interface CacheWarmingOptions {
  /**
   * Keys to warm up
   */
  keys: string[];

  /**
   * Function to fetch data for warming
   */
  fetcher: (this: unknown, key: string) => Promise<unknown>;

  /**
   * TTL for warmed entries
   */
  ttl?: number;

  /**
   * Whether to warm in parallel
   * @default true
   */
  parallel?: boolean;
}

/**
 * Cache invalidation event
 */
export interface CacheInvalidationEvent {
  /**
   * Event name
   */
  event: string;

  /**
   * Keys to invalidate
   */
  keys?: string[];

  /**
   * Tags to invalidate
   */
  tags?: string[];

  /**
   * Timestamp
   */
  timestamp: number;
}

/**
 * Cache lock options
 */
export interface CacheLockOptions {
  /**
   * Lock key pattern
   */
  key: string;

  /**
   * Lock TTL in milliseconds
   * @default 30000
   */
  ttl?: number;

  /**
   * Retry delay in milliseconds
   * @default 1000
   */
  retryDelay?: number;

  /**
   * Maximum retry attempts
   * @default 3
   */
  maxRetries?: number;
}

/**
 * Cache aside options
 */
export interface CacheAsideOptions {
  /**
   * Cache key pattern
   */
  key: string;

  /**
   * TTL in seconds
   */
  ttl?: number;

  /**
   * Fallback function when cache miss
   */
  fallback?: () => Promise<unknown>;
}

/**
 * Cache write options
 */
export interface CacheWriteOptions {
  /**
   * Write strategy
   * @default 'write-through'
   */
  strategy?: 'write-through' | 'write-behind';

  /**
   * Cache key pattern
   */
  key: string;

  /**
   * TTL in seconds
   */
  ttl?: number;

  /**
   * Async write for write-behind
   * @default true
   */
  async?: boolean;
}

/**
 * Cache warming options
 */
export interface CacheWarmOptions {
  /**
   * Keys to warm up
   */
  keys: string[];

  /**
   * Function to fetch data for warming
   */
  fetcher: (key: string) => Promise<unknown>;

  /**
   * TTL for warmed entries
   */
  ttl?: number;

  /**
   * Whether to warm in parallel
   * @default true
   */
  parallel?: boolean;

  /**
   * Cron schedule for automatic warming
   */
  schedule?: string;

  /**
   * Condition for warming (e.g., 'low-traffic')
   */
  condition?: string;
}

/**
 * Cache event types
 */
export type CacheEventType = 'hit' | 'miss' | 'set' | 'delete' | 'eviction';

/**
 * Cache event data
 */
export interface CacheEvent {
  /**
   * Event type
   */
  type: CacheEventType;

  /**
   * Cache key
   */
  key: string;

  /**
   * Event timestamp
   */
  timestamp: number;

  /**
   * Event data (optional)
   */
  data?: unknown;
}

/**
 * Cache health status
 */
export interface CacheHealth {
  /**
   * Health status
   */
  status: 'healthy' | 'degraded' | 'unhealthy';

  /**
   * Average latency in milliseconds
   */
  latency: number;

  /**
   * Memory usage in bytes
   */
  memoryUsage: number;

  /**
   * Error rate (0-1)
   */
  errorRate: number;

  /**
   * Last check timestamp
   */
  lastCheck: number;
}

/**
 * Hierarchical cache level
 */
export interface CacheLevel {
  /**
   * Cache type
   */
  type: 'memory' | 'redis';

  /**
   * TTL in seconds
   */
  ttl: number;

  /**
   * Maximum entries (for memory)
   */
  max?: number;

  /**
   * Redis database number (for Redis)
   */
  db?: number;
}

/**
 * Compression options
 */
export interface CompressionOptions {
  /**
   * Enable compression
   * @default false
   */
  enabled?: boolean;

  /**
   * Compression algorithm
   * @default 'gzip'
   */
  algorithm?: 'gzip' | 'deflate' | 'brotli';

  /**
   * Compression threshold in bytes
   * @default 1024
   */
  threshold?: number;

  /**
   * Compress keys as well
   * @default false
   */
  keyCompression?: boolean;
}
