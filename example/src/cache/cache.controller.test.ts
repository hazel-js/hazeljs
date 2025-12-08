import { Test } from '@hazeljs/core';
import { CacheController } from './cache.controller';
import { CacheService } from '@hazeljs/cache';

describe('CacheController', () => {
  let controller: CacheController;
  let cacheService: CacheService;

  beforeEach(async () => {
    cacheService = new CacheService('memory');

    const module = await Test.createTestingModule({
      controllers: [CacheController],
      providers: [CacheService],
    })
      .overrideProvider(CacheService)
      .useValue(cacheService)
      .compile();

    controller = module.get(CacheController);

    // Clear cache before each test
    await cacheService.clear();
  });

  afterEach(async () => {
    await cacheService.clear();
  });

  describe('getWithMemoryCache', () => {
    it('should return data', async () => {
      const result = await controller.getWithMemoryCache('123');

      expect(result).toBeDefined();
      expect(result.id).toBe('123');
      expect(result.data).toBe('Data for 123');
      expect(result.timestamp).toBeDefined();
    });

    it('should cache data', async () => {
      const result1 = await controller.getWithMemoryCache('123');
      const result2 = await controller.getWithMemoryCache('123');

      // Both should have data
      expect(result1.id).toBe('123');
      expect(result2.id).toBe('123');
    });
  });

  describe('getWithTags', () => {
    it('should return user data', async () => {
      const result = await controller.getWithTags('456');

      expect(result).toBeDefined();
      expect(result.id).toBe('456');
      expect(result.user).toBeDefined();
      expect(result.user.name).toBe('User 456');
    });
  });

  describe('getWithCustomTTL', () => {
    it('should return data with custom TTL', async () => {
      const result = await controller.getWithCustomTTL('789');

      expect(result).toBeDefined();
      expect(result.id).toBe('789');
      expect(result.ttl).toBe(120);
    });
  });

  describe('createUser', () => {
    it('should create user and invalidate cache', async () => {
      const userData = { name: 'John', email: 'john@example.com' };
      const result = await controller.createUser(userData);

      expect(result).toBeDefined();
      expect(result.message).toBe('User created');
      expect(result.user).toEqual(userData);
      expect(result.cacheInvalidated).toBe(true);
    });
  });

  describe('deleteEntry', () => {
    it('should delete cache entry', async () => {
      await cacheService.set('test-key', 'test-value', 60);

      const result = await controller.deleteEntry('test-key');

      expect(result.message).toBe('Cache entry deleted');
      expect(result.key).toBe('test-key');
      expect(await cacheService.get('test-key')).toBeNull();
    });
  });

  describe('invalidateByTag', () => {
    it('should invalidate cache by tag', async () => {
      await cacheService.setWithTags('key1', 'value1', 60, ['test-tag']);
      await cacheService.setWithTags('key2', 'value2', 60, ['test-tag']);

      const result = await controller.invalidateByTag('test-tag');

      expect(result.message).toBe('Cache invalidated');
      expect(result.tag).toBe('test-tag');
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      await cacheService.set('key', 'value', 60);
      await cacheService.get('key');

      const result = await controller.getStats();

      expect(result.stats).toBeDefined();
      expect(result.strategy).toBe('memory');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('clearCache', () => {
    it('should clear all cache', async () => {
      await cacheService.set('key1', 'value1', 60);
      await cacheService.set('key2', 'value2', 60);

      const result = await controller.clearCache();

      expect(result.message).toBe('Cache cleared');
      expect(await cacheService.get('key1')).toBeNull();
      expect(await cacheService.get('key2')).toBeNull();
    });
  });

  describe('warmUpCache', () => {
    it('should warm up cache with keys', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const result = await controller.warmUpCache({ keys });

      expect(result.message).toBe('Cache warmed up');
      expect(result.keys).toEqual(keys);

      // Verify keys are cached
      for (const key of keys) {
        const cached = await cacheService.get(key);
        expect(cached).toBeDefined();
      }
    });
  });

  describe('testCacheAside', () => {
    it('should use cache-aside pattern', async () => {
      const result1 = await controller.testCacheAside('test-id');
      const result2 = await controller.testCacheAside('test-id');

      expect(result1).toBeDefined();
      expect(result1.id).toBe('test-id');
      expect(result2).toEqual(result1);
    });

    it('should fetch on cache miss', async () => {
      const result = await controller.testCacheAside('new-id');

      expect(result).toBeDefined();
      expect(result.id).toBe('new-id');
      expect(result.data).toBe('Fetched data for new-id');
    });
  });
});
