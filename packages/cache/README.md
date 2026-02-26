# @hazeljs/cache

**Multi-Tier Caching Module for HazelJS - Memory, Redis, and CDN Support**

Smart caching system with automatic invalidation, tag-based management, and decorator-based API.

[![npm version](https://img.shields.io/npm/v/@hazeljs/cache.svg)](https://www.npmjs.com/package/@hazeljs/cache)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/cache)](https://www.npmjs.com/package/@hazeljs/cache)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- 💾 **Multiple Strategies** - Memory, Redis, and CDN caching
- 🎨 **Decorator-Based API** - `@Cache`, `@CacheEvict`, `@CacheTTL`
- 🏷️ **Tag-Based Management** - Group and invalidate related caches
- ⏰ **TTL Support** - Automatic expiration
- 🔄 **Cache Warming** - Pre-populate cache on startup
- 📊 **Statistics** - Hit/miss rates and performance metrics
- 🔑 **Key Generation** - Automatic and custom key generation
- 🧹 **Auto Cleanup** - Automatic removal of expired entries

## Installation

```bash
npm install @hazeljs/cache
```

### Optional Dependencies

```bash
# For Redis caching
npm install ioredis
```

## Quick Start

### Memory Cache

```typescript
import { CacheModule } from '@hazeljs/cache';

@HazelModule({
  imports: [
    CacheModule.forRoot({
      strategy: 'memory',
      ttl: 3600, // 1 hour
      max: 1000, // Max 1000 entries
    }),
  ],
})
export class AppModule {}
```

### Using Cache Decorator

```typescript
import { Injectable } from '@hazeljs/core';
import { Cache, CacheEvict } from '@hazeljs/cache';

@Injectable()
export class ProductService {
  @Cache({
    key: 'product-{id}',
    ttl: 3600,
  })
  async findOne(id: string) {
    // Expensive database query - cached for 1 hour
    return await this.db.product.findUnique({ where: { id } });
  }

  @Cache({
    key: 'products-all',
    ttl: 1800,
  })
  async findAll() {
    return await this.db.product.findMany();
  }

  @CacheEvict({
    keys: ['product-{id}', 'products-all'],
  })
  async update(id: string, data: any) {
    return await this.db.product.update({
      where: { id },
      data,
    });
  }

  @CacheEvict({
    keys: ['product-*'], // Wildcard pattern
  })
  async deleteAll() {
    return await this.db.product.deleteMany();
  }
}
```

## Cache Strategies

### Memory Cache (Development)

```typescript
CacheModule.forRoot({
  strategy: 'memory',
  ttl: 3600,
  max: 1000,
  updateAgeOnGet: true,
})
```

**Best for:** Development, testing, single-instance applications

### Redis Cache (Production)

```typescript
import Redis from 'ioredis';

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  password: 'your-password',
  db: 0,
});

CacheModule.forRoot({
  strategy: 'redis',
  redis: redis,
  ttl: 3600,
  keyPrefix: 'myapp:',
})
```

**Best for:** Production, distributed systems, shared cache

### Hybrid Cache

```typescript
CacheModule.forRoot({
  strategy: 'hybrid',
  memory: {
    ttl: 300, // 5 minutes in memory
    max: 100,
  },
  redis: {
    client: redis,
    ttl: 3600, // 1 hour in Redis
    keyPrefix: 'myapp:',
  },
})
```

**Best for:** High-performance applications, frequently accessed data

## Decorators

### @Cache()

Cache method results:

```typescript
@Cache({
  key: 'user-{id}',
  ttl: 3600,
  strategy: 'redis',
})
async getUser(id: string) {
  return await this.userService.findOne(id);
}

// Dynamic key generation
@Cache({
  key: (args) => `search-${args[0]}-${args[1]}`,
  ttl: 1800,
})
async search(query: string, page: number) {
  return await this.searchService.search(query, page);
}
```

### @CacheEvict()

Invalidate cache entries:

```typescript
// Evict specific keys
@CacheEvict({
  keys: ['user-{id}'],
})
async updateUser(id: string, data: any) {
  return await this.userService.update(id, data);
}

// Evict multiple keys
@CacheEvict({
  keys: ['user-{id}', 'users-all', 'users-active'],
})
async deleteUser(id: string) {
  return await this.userService.delete(id);
}

// Evict by pattern
@CacheEvict({
  keys: ['user-*'],
})
async clearAllUsers() {
  return await this.userService.deleteAll();
}

// Evict by tags
@CacheEvict({
  tags: ['users', 'profiles'],
})
async updateUserProfile(id: string, data: any) {
  return await this.userService.updateProfile(id, data);
}
```

### @CacheTTL()

Set TTL dynamically:

```typescript
@Cache({ key: 'data-{id}' })
@CacheTTL((result) => {
  // Cache premium users for 1 hour, others for 5 minutes
  return result.isPremium ? 3600 : 300;
})
async getData(id: string) {
  return await this.dataService.find(id);
}
```

## Tag-Based Caching

Group related cache entries with tags:

```typescript
@Injectable()
export class ProductService {
  @Cache({
    key: 'product-{id}',
    tags: ['products', 'catalog'],
    ttl: 3600,
  })
  async findOne(id: string) {
    return await this.db.product.findUnique({ where: { id } });
  }

  @Cache({
    key: 'products-featured',
    tags: ['products', 'featured'],
    ttl: 1800,
  })
  async findFeatured() {
    return await this.db.product.findMany({ where: { featured: true } });
  }

  // Invalidate all product-related caches
  @CacheEvict({
    tags: ['products'],
  })
  async updateProduct(id: string, data: any) {
    return await this.db.product.update({ where: { id }, data });
  }
}
```

## Direct Cache Service Usage

```typescript
import { Injectable } from '@hazeljs/core';
import { CacheService } from '@hazeljs/cache';

@Injectable()
export class MyService {
  constructor(private cacheService: CacheService) {}

  async getData(key: string) {
    // Get from cache
    const cached = await this.cacheService.get(key);
    if (cached) return cached;

    // Fetch data
    const data = await this.fetchData(key);

    // Store in cache
    await this.cacheService.set(key, data, 3600);

    return data;
  }

  async invalidate(key: string) {
    await this.cacheService.del(key);
  }

  async invalidatePattern(pattern: string) {
    await this.cacheService.delPattern(pattern);
  }

  async invalidateTags(tags: string[]) {
    await this.cacheService.delByTags(tags);
  }
}
```

## Cache Warming

Pre-populate cache on application startup:

```typescript
import { Injectable, OnModuleInit } from '@hazeljs/core';
import { CacheService } from '@hazeljs/cache';

@Injectable()
export class CacheWarmer implements OnModuleInit {
  constructor(
    private cacheService: CacheService,
    private productService: ProductService
  ) {}

  async onModuleInit() {
    // Warm up featured products cache
    const featured = await this.productService.findFeatured();
    await this.cacheService.set('products-featured', featured, 3600);

    // Warm up categories cache
    const categories = await this.productService.findCategories();
    await this.cacheService.set('categories-all', categories, 7200);

    console.log('Cache warmed up successfully');
  }
}
```

## Statistics

Monitor cache performance:

```typescript
const stats = await cacheService.getStats();

console.log('Hits:', stats.hits);
console.log('Misses:', stats.misses);
console.log('Hit Rate:', stats.hitRate);
console.log('Total Keys:', stats.keys);
console.log('Memory Usage:', stats.memoryUsage);
```

## Advanced Configuration

### Custom Key Generator

```typescript
CacheModule.forRoot({
  strategy: 'redis',
  redis: redis,
  keyGenerator: (target, methodName, args) => {
    return `${target.constructor.name}:${methodName}:${JSON.stringify(args)}`;
  },
})
```

### Conditional Caching

```typescript
@Cache({
  key: 'user-{id}',
  condition: (args, result) => {
    // Only cache if user is active
    return result?.status === 'active';
  },
})
async getUser(id: string) {
  return await this.userService.findOne(id);
}
```

### Cache Compression

```typescript
CacheModule.forRoot({
  strategy: 'redis',
  redis: redis,
  compression: {
    enabled: true,
    threshold: 1024, // Compress if > 1KB
  },
})
```

## API Reference

### CacheService

```typescript
class CacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  delPattern(pattern: string): Promise<void>;
  delByTags(tags: string[]): Promise<void>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  getStats(): Promise<CacheStats>;
  keys(pattern?: string): Promise<string[]>;
}
```

### Decorators

```typescript
@Cache({
  key: string | ((args: any[]) => string);
  ttl?: number;
  strategy?: 'memory' | 'redis' | 'hybrid';
  tags?: string[];
  condition?: (args: any[], result: any) => boolean;
})

@CacheEvict({
  keys?: string[];
  tags?: string[];
  allEntries?: boolean;
})

@CacheTTL((result: any) => number)
```

## Use Cases

### API Response Caching

```typescript
@Controller('/api')
export class ApiController {
  @Get('/products')
  @Cache({
    key: 'api-products-{page}-{limit}',
    ttl: 300,
    tags: ['api', 'products'],
  })
  async getProducts(
    @Query('page') page: number,
    @Query('limit') limit: number
  ) {
    return await this.productService.findAll(page, limit);
  }
}
```

### Database Query Caching

```typescript
@Injectable()
export class UserRepository {
  @Cache({
    key: 'db-user-{id}',
    ttl: 3600,
    tags: ['database', 'users'],
  })
  async findById(id: string) {
    return await this.prisma.user.findUnique({ where: { id } });
  }

  @CacheEvict({
    keys: ['db-user-{id}'],
    tags: ['users'],
  })
  async update(id: string, data: any) {
    return await this.prisma.user.update({ where: { id }, data });
  }
}
```

### Computed Results Caching

```typescript
@Injectable()
export class AnalyticsService {
  @Cache({
    key: 'analytics-{startDate}-{endDate}',
    ttl: 7200, // 2 hours
    tags: ['analytics'],
  })
  async getReport(startDate: string, endDate: string) {
    // Expensive computation
    return await this.computeAnalytics(startDate, endDate);
  }
}
```

## Best Practices

- **Use appropriate TTL** - Short TTL for frequently changing data, long TTL for static data
- **Tag related caches** - Group caches that should be invalidated together
- **Monitor hit rates** - Adjust caching strategy based on statistics
- **Use Redis for production** - Memory cache is only for development
- **Invalidate proactively** - Clear cache when data changes
- **Avoid caching user-specific data** - Unless using user-specific keys

## Examples

See the [examples](../../example/src/cache) directory for complete working examples.

## Testing

```bash
npm test
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

Apache 2.0 © [HazelJS](https://hazeljs.com)

## Links

- [Documentation](https://hazeljs.com/docs/packages/cache)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazeljs/hazel-js/issues)
- [Discord](https://discord.gg/hazeljs)
