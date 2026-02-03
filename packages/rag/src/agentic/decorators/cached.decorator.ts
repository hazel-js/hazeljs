/**
 * Cached Decorator
 * Caches retrieval results for performance
 */

import 'reflect-metadata';
import { CacheEntry } from '../types';

export interface CachedConfig {
  ttl?: number; // Time to live in seconds
  maxSize?: number;
  keyGenerator?: (args: unknown[]) => string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new Map<string, CacheEntry<any>>();

export function Cached(config: CachedConfig = {}): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const ttl = (config.ttl || 3600) * 1000; // Convert to ms
    const maxSize = config.maxSize || 100;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      // Generate cache key
      const key = config.keyGenerator
        ? config.keyGenerator(args)
        : generateCacheKey(propertyKey, args);

      // Check cache
      const cached = cache.get(key);
      if (cached && !isExpired(cached)) {
        cached.hits++;
        return cached.value;
      }

      // Execute method
      const result = await originalMethod.apply(this, args);

      // Store in cache
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entry: CacheEntry<any> = {
        key,
        value: result,
        timestamp: Date.now(),
        ttl,
        hits: 0,
      };

      cache.set(key, entry);

      // Enforce max size
      if (cache.size > maxSize) {
        evictLRU();
      }

      return result;
    };

    return descriptor;
  };
}

function generateCacheKey(method: string | symbol, args: unknown[]): string {
  const argsStr = JSON.stringify(args);
  return `${String(method)}:${argsStr}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isExpired(entry: CacheEntry<any>): boolean {
  return Date.now() - entry.timestamp > entry.ttl;
}

function evictLRU(): void {
  let oldestKey: string | null = null;
  let oldestTime = Infinity;
  let lowestHits = Infinity;

  for (const [key, entry] of cache.entries()) {
    if (isExpired(entry)) {
      cache.delete(key);
      continue;
    }

    if (entry.hits < lowestHits || (entry.hits === lowestHits && entry.timestamp < oldestTime)) {
      oldestKey = key;
      oldestTime = entry.timestamp;
      lowestHits = entry.hits;
    }
  }

  if (oldestKey) {
    cache.delete(oldestKey);
  }
}

export function getCacheStats(): {
  size: number;
  totalHits: number;
  hitRate: number;
} {
  let totalHits = 0;
  let totalRequests = 0;

  for (const entry of cache.values()) {
    totalHits += entry.hits;
    totalRequests += entry.hits + 1; // +1 for initial miss
  }

  return {
    size: cache.size,
    totalHits,
    hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
  };
}

export function clearCache(): void {
  cache.clear();
}
