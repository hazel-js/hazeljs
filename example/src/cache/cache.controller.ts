import { Controller, Get, Post, Delete, Param, Body } from '@hazeljs/core';
import { Cache, CacheKey, CacheTTL, CacheTags, CacheEvict } from '@hazeljs/cache';
import { Swagger, ApiOperation } from '@hazeljs/swagger';
import { CacheService } from '@hazeljs/cache';

/**
 * Cache controller demonstrating caching features
 */
@Controller('/cache')
@Swagger({
  title: 'Cache API',
  description: 'Endpoints demonstrating smart caching system',
  version: '1.0.0',
  tags: [{ name: 'cache', description: 'Cache operations' }],
})
export class CacheController {
  constructor(private cacheService: CacheService) {}

  /**
   * Get data with memory caching
   */
  @Get('/memory/:id')
  @Cache({
    strategy: 'memory',
    ttl: 60,
    key: 'data-{id}',
  })
  @ApiOperation({
    summary: 'Get data with memory cache',
    description: 'Cached for 60 seconds in memory',
    tags: ['cache'],
  })
  async getWithMemoryCache(@Param('id') id: string) {
    // Simulate expensive operation
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      id,
      data: `Data for ${id}`,
      timestamp: new Date().toISOString(),
      cached: false,
    };
  }

  /**
   * Get data with tags
   */
  @Get('/tagged/:id')
  @Cache({
    strategy: 'memory',
    ttl: 300,
    key: 'user-{id}',
    tags: ['users', 'profiles'],
  })
  @CacheTags(['users', 'profiles'])
  @ApiOperation({
    summary: 'Get data with cache tags',
    description: 'Cached with tags for group invalidation',
    tags: ['cache'],
  })
  async getWithTags(@Param('id') id: string) {
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      id,
      user: {
        name: `User ${id}`,
        email: `user${id}@example.com`,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get data with custom TTL
   */
  @Get('/ttl/:id')
  @CacheTTL(120)
  @CacheKey('custom-{id}')
  @ApiOperation({
    summary: 'Get data with custom TTL',
    description: 'Cached for 120 seconds',
    tags: ['cache'],
  })
  async getWithCustomTTL(@Param('id') id: string) {
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      id,
      data: `Custom TTL data for ${id}`,
      ttl: 120,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create data and evict cache
   */
  @Post('/users')
  @CacheEvict({ tags: ['users'] })
  @ApiOperation({
    summary: 'Create user and evict cache',
    description: 'Invalidates all cache entries with "users" tag',
    tags: ['cache'],
  })
  async createUser(@Body() userData: any) {
    // Simulate user creation
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Manually invalidate cache
    await this.cacheService.invalidateTags(['users']);

    return {
      message: 'User created',
      user: userData,
      cacheInvalidated: true,
    };
  }

  /**
   * Delete cache entry
   */
  @Delete('/entry/:key')
  @ApiOperation({
    summary: 'Delete cache entry',
    description: 'Manually delete a specific cache entry',
    tags: ['cache'],
  })
  async deleteEntry(@Param('key') key: string) {
    await this.cacheService.delete(key);

    return {
      message: 'Cache entry deleted',
      key,
    };
  }

  /**
   * Invalidate by tag
   */
  @Post('/invalidate/tag/:tag')
  @ApiOperation({
    summary: 'Invalidate cache by tag',
    description: 'Invalidate all cache entries with a specific tag',
    tags: ['cache'],
  })
  async invalidateByTag(@Param('tag') tag: string) {
    await this.cacheService.deleteByTag(tag);

    return {
      message: 'Cache invalidated',
      tag,
    };
  }

  /**
   * Get cache statistics
   */
  @Get('/stats')
  @ApiOperation({
    summary: 'Get cache statistics',
    description: 'Get cache hit/miss statistics',
    tags: ['cache'],
  })
  async getStats() {
    const stats = await this.cacheService.getStats();

    return {
      stats,
      strategy: this.cacheService.getStrategy(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Clear all cache
   */
  @Delete('/clear')
  @ApiOperation({
    summary: 'Clear all cache',
    description: 'Clear all cache entries',
    tags: ['cache'],
  })
  async clearCache() {
    await this.cacheService.clear();

    return {
      message: 'Cache cleared',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Warm up cache
   */
  @Post('/warmup')
  @ApiOperation({
    summary: 'Warm up cache',
    description: 'Pre-populate cache with data',
    tags: ['cache'],
  })
  async warmUpCache(@Body() body: { keys: string[] }) {
    await this.cacheService.warmUp({
      keys: body.keys,
      fetcher: async (key: string) => {
        return { key, data: `Warmed data for ${key}`, timestamp: new Date().toISOString() };
      },
      ttl: 300,
      parallel: true,
    });

    return {
      message: 'Cache warmed up',
      keys: body.keys,
    };
  }

  /**
   * Test cache-aside pattern
   */
  @Get('/aside/:id')
  @ApiOperation({
    summary: 'Test cache-aside pattern',
    description: 'Get or set pattern demonstration',
    tags: ['cache'],
  })
  async testCacheAside(@Param('id') id: string) {
    const data = await this.cacheService.getOrSet(
      `aside-${id}`,
      async () => {
        // Simulate fetching from database
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          id,
          data: `Fetched data for ${id}`,
          timestamp: new Date().toISOString(),
        };
      },
      60
    );

    return data;
  }
}
