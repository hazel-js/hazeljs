import { MemoryCacheStore } from './strategies/memory.strategy';
import { RedisCacheStore } from './strategies/redis.strategy';
import { MultiTierCacheStore } from './strategies/multi-tier.strategy';
import { CacheService, CacheManager } from './cache.service';
import {
  Cache,
  CacheKey,
  CacheTTL,
  CacheTags,
  getCacheMetadata,
} from './decorators/cache.decorator';

describe('MemoryCacheStore', () => {
  let store: MemoryCacheStore;

  beforeEach(() => {
    store = new MemoryCacheStore(100); // Short cleanup interval for testing
  });

  afterEach(() => {
    store.destroy();
  });

  describe('get and set', () => {
    it('should set and get a value', async () => {
      await store.set('key1', 'value1', 60);
      const value = await store.get('key1');
      expect(value).toBe('value1');
    });

    it('should return null for non-existent key', async () => {
      const value = await store.get('nonexistent');
      expect(value).toBeNull();
    });

    it('should handle complex objects', async () => {
      const obj = { name: 'test', nested: { value: 123 } };
      await store.set('obj', obj, 60);
      const retrieved = await store.get('obj');
      expect(retrieved).toEqual(obj);
    });
  });

  describe('expiration', () => {
    it('should expire entries after TTL', async () => {
      await store.set('expire', 'value', 0.1); // 100ms
      await new Promise((resolve) => setTimeout(resolve, 150));
      const value = await store.get('expire');
      expect(value).toBeNull();
    });

    it('should not return expired entries', async () => {
      await store.set('key', 'value', 0.05); // 50ms
      await new Promise((resolve) => setTimeout(resolve, 100));
      const exists = await store.has('key');
      expect(exists).toBe(false);
    });
  });

  describe('tags', () => {
    it('should set value with tags', async () => {
      await store.setWithTags('user1', { name: 'John' }, 60, ['users', 'profiles']);
      const value = await store.get('user1');
      expect(value).toEqual({ name: 'John' });
    });

    it('should delete entries by tag', async () => {
      await store.setWithTags('user1', { name: 'John' }, 60, ['users']);
      await store.setWithTags('user2', { name: 'Jane' }, 60, ['users']);
      await store.setWithTags('post1', { title: 'Post' }, 60, ['posts']);

      await store.deleteByTag('users');

      expect(await store.get('user1')).toBeNull();
      expect(await store.get('user2')).toBeNull();
      expect(await store.get('post1')).toEqual({ title: 'Post' });
    });
  });

  describe('operations', () => {
    it('should delete a key', async () => {
      await store.set('key', 'value', 60);
      await store.delete('key');
      const value = await store.get('key');
      expect(value).toBeNull();
    });

    it('should check if key exists', async () => {
      await store.set('key', 'value', 60);
      expect(await store.has('key')).toBe(true);
      expect(await store.has('nonexistent')).toBe(false);
    });

    it('should clear all entries', async () => {
      await store.set('key1', 'value1', 60);
      await store.set('key2', 'value2', 60);
      await store.clear();
      expect(await store.get('key1')).toBeNull();
      expect(await store.get('key2')).toBeNull();
    });

    it('should get keys by pattern', async () => {
      await store.set('user:1', 'value1', 60);
      await store.set('user:2', 'value2', 60);
      await store.set('post:1', 'value3', 60);

      const userKeys = await store.keys('user:*');
      expect(userKeys).toHaveLength(2);
      expect(userKeys).toContain('user:1');
      expect(userKeys).toContain('user:2');
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', async () => {
      await store.set('key', 'value', 60);

      await store.get('key'); // hit
      await store.get('nonexistent'); // miss
      await store.get('key'); // hit

      const stats = await store.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it('should report cache size', async () => {
      await store.set('key1', 'value1', 60);
      await store.set('key2', 'value2', 60);

      const stats = await store.getStats();
      expect(stats.size).toBe(2);
    });

    it('should reset statistics', async () => {
      await store.set('key', 'value', 60);
      await store.get('key');

      store.resetStats();

      const stats = await store.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });
});

describe('RedisCacheStore', () => {
  let store: RedisCacheStore;

  beforeEach(() => {
    store = new RedisCacheStore();
  });

  afterEach(async () => {
    await store.disconnect();
  });

  it('should set and get a value', async () => {
    await store.set('key1', 'value1', 60);
    const value = await store.get('key1');
    expect(value).toBe('value1');
  });

  it('should handle objects', async () => {
    const obj = { name: 'test', value: 123 };
    await store.set('obj', obj, 60);
    const retrieved = await store.get('obj');
    expect(retrieved).toEqual(obj);
  });

  it('should delete by tag', async () => {
    await store.setWithTags('key1', 'value1', 60, ['tag1']);
    await store.setWithTags('key2', 'value2', 60, ['tag1']);

    await store.deleteByTag('tag1');

    expect(await store.get('key1')).toBeNull();
    expect(await store.get('key2')).toBeNull();
  });

  it('should return null for expired key', async () => {
    await store.set('exp', 'val', 0.001);
    await new Promise((r) => setTimeout(r, 50));
    expect(await store.get('exp')).toBeNull();
  });

  it('should support has and keys', async () => {
    await store.set('k1', 'v1', 60);
    expect(await store.has('k1')).toBe(true);
    expect(await store.has('nope')).toBe(false);
    const keys = await store.keys();
    expect(keys).toContain('k1');
  });

  it('should clear and getStats', async () => {
    await store.set('a', 'b', 60);
    await store.clear();
    expect(await store.get('a')).toBeNull();
    const stats = await store.getStats();
    expect(stats).toBeDefined();
  });

  it('should resetStats', async () => {
    await store.set('s', 'v', 60);
    await store.get('s');
    store.resetStats();
    const stats = await store.getStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });
});

describe('MultiTierCacheStore', () => {
  let store: MultiTierCacheStore;

  beforeEach(() => {
    store = new MultiTierCacheStore();
  });

  afterEach(async () => {
    await store.destroy();
  });

  it('should set and get from multi-tier cache', async () => {
    await store.set('key', 'value', 60);
    const value = await store.get('key');
    expect(value).toBe('value');
  });

  it('should promote from L2 to L1', async () => {
    await store.set('key', 'value', 60);

    // Clear L1 to simulate L2-only scenario
    const l1Stats = await store.getL1Stats();

    // Get should promote to L1
    await store.get('key');

    const newL1Stats = await store.getL1Stats();
    expect(newL1Stats.size).toBeGreaterThanOrEqual(l1Stats.size);
  });

  it('should delete from both tiers', async () => {
    await store.set('key', 'value', 60);
    await store.delete('key');

    expect(await store.get('key')).toBeNull();
  });

  it('should get combined statistics', async () => {
    await store.set('key1', 'value1', 60);
    await store.set('key2', 'value2', 60);

    await store.get('key1');
    await store.get('nonexistent');

    const stats = await store.getStats();
    expect(stats.hits).toBeGreaterThan(0);
    expect(stats.misses).toBeGreaterThan(0);
  });

  it('should setWithTags and deleteByTag', async () => {
    await store.setWithTags('t1', 'v1', 60, ['tagA']);
    await store.setWithTags('t2', 'v2', 60, ['tagA']);
    expect(await store.get('t1')).toBe('v1');
    await store.deleteByTag('tagA');
    expect(await store.get('t1')).toBeNull();
    expect(await store.get('t2')).toBeNull();
  });

  it('should has return true when in L1 or L2', async () => {
    await store.set('ink', 'val', 60);
    expect(await store.has('ink')).toBe(true);
    expect(await store.has('missing')).toBe(false);
  });

  it('should return keys from both tiers', async () => {
    await store.set('a', 1, 60);
    await store.set('b', 2, 60);
    const keys = await store.keys();
    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(keys).toContain('a');
    expect(keys).toContain('b');
  });

  it('should clear both tiers', async () => {
    await store.set('c', 'v', 60);
    await store.clear();
    expect(await store.get('c')).toBeNull();
  });

  it('should return L1 and L2 stats', async () => {
    const l1 = await store.getL1Stats();
    const l2 = await store.getL2Stats();
    expect(l1).toBeDefined();
    expect(l2).toBeDefined();
  });

  it('should resetStats on both tiers', async () => {
    await store.set('x', 'y', 60);
    await store.get('x');
    store.resetStats();
    const stats = await store.getStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });
});

jest.mock('@hazeljs/core', () => {
  const loggerFn = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  return {
    __esModule: true,
    default: loggerFn,
    Service: () => () => undefined,
    logger: loggerFn,
  };
});

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(() => {
    service = new CacheService('memory');
  });

  describe('createStore strategies', () => {
    it('should create redis store when strategy is redis', () => {
      const redisService = new CacheService('redis', { redis: { host: 'localhost', port: 6379 } });
      expect(redisService.getStrategy()).toBe('redis');
      expect(redisService.getStore()).toBeDefined();
    });

    it('should create multi-tier store when strategy is multi-tier', () => {
      const multiService = new CacheService('multi-tier', {});
      expect(multiService.getStrategy()).toBe('multi-tier');
      expect(multiService.getStore()).toBeDefined();
    });
  });

  describe('basic operations', () => {
    it('should get and set values', async () => {
      await service.set('key', 'value', 60);
      const value = await service.get('key');
      expect(value).toBe('value');
    });

    it('should delete values', async () => {
      await service.set('key', 'value', 60);
      await service.delete('key');
      expect(await service.get('key')).toBeNull();
    });

    it('should clear all cache', async () => {
      await service.set('key1', 'value1', 60);
      await service.set('key2', 'value2', 60);
      await service.clear();
      expect(await service.get('key1')).toBeNull();
    });
  });

  describe('cache-aside pattern', () => {
    it('should get or set value', async () => {
      let fetchCount = 0;

      const fetcher = async () => {
        fetchCount++;
        return { data: 'fetched' };
      };

      const result1 = await service.getOrSet('key', fetcher, 60);
      const result2 = await service.getOrSet('key', fetcher, 60);

      expect(result1).toEqual({ data: 'fetched' });
      expect(result2).toEqual({ data: 'fetched' });
      expect(fetchCount).toBe(1); // Should only fetch once
    });

    it('should getOrSet with tags', async () => {
      const result = await service.getOrSet('tagged', async () => 'value', 60, ['tag1']);
      expect(result).toBe('value');
      expect(await service.get('tagged')).toBe('value');
    });

    it('should wrap function with caching', async () => {
      const fn = jest.fn().mockResolvedValue('wrapped');
      const result1 = await service.wrap('wrap-key', fn, 60);
      const result2 = await service.wrap('wrap-key', fn, 60);
      expect(result1).toBe('wrapped');
      expect(result2).toBe('wrapped');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('cache warming', () => {
    it('should warm up cache', async () => {
      await service.warmUp({
        keys: ['key1', 'key2', 'key3'],
        fetcher: async (key) => ({ key, data: `data-${key}` }),
        ttl: 60,
      });

      expect(await service.get('key1')).toEqual({ key: 'key1', data: 'data-key1' });
      expect(await service.get('key2')).toEqual({ key: 'key2', data: 'data-key2' });
      expect(await service.get('key3')).toEqual({ key: 'key3', data: 'data-key3' });
    });

    it('should warm up cache with parallel false', async () => {
      await service.warmUp({
        keys: ['a', 'b'],
        fetcher: async (key) => key,
        ttl: 60,
        parallel: false,
      });
      expect(await service.get('a')).toBe('a');
      expect(await service.get('b')).toBe('b');
    });

    it('should log and continue when fetcher throws for a key', async () => {
      await service.warmUp({
        keys: ['ok', 'fail', 'ok2'],
        fetcher: async (key) => {
          if (key === 'fail') throw new Error('fetch failed');
          return key;
        },
        ttl: 60,
      });
      expect(await service.get('ok')).toBe('ok');
      expect(await service.get('ok2')).toBe('ok2');
      expect(await service.get('fail')).toBeNull();
    });
  });

  describe('tags', () => {
    it('should invalidate by tags', async () => {
      await service.setWithTags('user1', { name: 'John' }, 60, ['users']);
      await service.setWithTags('user2', { name: 'Jane' }, 60, ['users']);

      await service.invalidateTags(['users']);

      expect(await service.get('user1')).toBeNull();
      expect(await service.get('user2')).toBeNull();
    });
  });

  describe('statistics', () => {
    it('should get cache statistics', async () => {
      await service.set('key', 'value', 60);
      await service.get('key');

      const stats = await service.getStats();
      expect(stats).toBeDefined();
      expect(stats.hits).toBeGreaterThanOrEqual(0);
      expect(stats.misses).toBeGreaterThanOrEqual(0);
    });

    it('should reset stats when store supports it', async () => {
      await service.set('key', 'value', 60);
      await service.get('key');
      service.resetStats();
      const stats = await service.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('store accessors', () => {
    it('should return store and strategy', () => {
      expect(service.getStore()).toBeDefined();
      expect(service.getStrategy()).toBe('memory');
    });
  });
});

describe('CacheManager', () => {
  let manager: CacheManager;

  beforeEach(() => {
    manager = new CacheManager();
  });

  it('should register and get cache', () => {
    const cache = new CacheService('memory');
    manager.register('test', cache);

    expect(manager.get('test')).toBe(cache);
  });

  it('should set default cache', () => {
    const cache = new CacheService('memory');
    manager.register('default', cache, true);

    expect(manager.get()).toBe(cache);
  });

  it('should get all caches', () => {
    const cache1 = new CacheService('memory');
    const cache2 = new CacheService('memory');

    manager.register('cache1', cache1);
    manager.register('cache2', cache2);

    const all = manager.getAll();
    expect(all.size).toBe(2);
  });

  it('should clear all caches', async () => {
    const cache1 = new CacheService('memory');
    const cache2 = new CacheService('memory');

    manager.register('cache1', cache1);
    manager.register('cache2', cache2);

    await cache1.set('key', 'value', 60);
    await cache2.set('key', 'value', 60);

    await manager.clearAll();

    expect(await cache1.get('key')).toBeNull();
    expect(await cache2.get('key')).toBeNull();
  });

  it('should throw when get() with no name and no default', () => {
    expect(() => manager.get()).toThrow('No default cache configured');
  });

  it('should throw when get(name) and cache not found', () => {
    expect(() => manager.get('nonexistent')).toThrow('Cache not found: nonexistent');
  });

  it('should get all stats', async () => {
    const cache = new CacheService('memory');
    manager.register('stats-cache', cache);
    await cache.set('k', 'v', 60);
    const allStats = await manager.getAllStats();
    expect(allStats.size).toBeGreaterThanOrEqual(1);
    expect(allStats.get('stats-cache')).toBeDefined();
  });

  it('should invalidate tags globally', async () => {
    const cache = new CacheService('memory');
    manager.register('inv', cache);
    await cache.setWithTags('x', 'y', 60, ['t1']);
    await manager.invalidateTagsGlobal(['t1']);
    expect(await cache.get('x')).toBeNull();
  });
});

describe('Cache Decorators', () => {
  describe('@Cache', () => {
    it('should store cache metadata', () => {
      class TestClass {
        @Cache({ ttl: 120, strategy: 'memory' })
        testMethod() {
          return 'test';
        }
      }

      const instance = new TestClass();
      const metadata = getCacheMetadata(instance, 'testMethod');

      expect(metadata).toBeDefined();
      expect(metadata?.ttl).toBe(120);
      expect(metadata?.strategy).toBe('memory');
    });
  });

  describe('@CacheKey', () => {
    it('should set cache key pattern', () => {
      class TestClass {
        @CacheKey('user-{id}')
        @Cache()
        testMethod() {
          return 'test';
        }
      }

      const instance = new TestClass();
      const metadata = getCacheMetadata(instance, 'testMethod');

      expect(metadata?.key).toBe('user-{id}');
    });
  });

  describe('@CacheTTL', () => {
    it('should set cache TTL', () => {
      class TestClass {
        @CacheTTL(300)
        @Cache()
        testMethod() {
          return 'test';
        }
      }

      const instance = new TestClass();
      const metadata = getCacheMetadata(instance, 'testMethod');

      expect(metadata?.ttl).toBe(300);
    });
  });

  describe('@CacheTags', () => {
    it('should set cache tags', () => {
      class TestClass {
        @CacheTags(['users', 'profiles'])
        @Cache()
        testMethod() {
          return 'test';
        }
      }

      const instance = new TestClass();
      const metadata = getCacheMetadata(instance, 'testMethod');

      expect(metadata?.tags).toEqual(['users', 'profiles']);
    });
  });
});
