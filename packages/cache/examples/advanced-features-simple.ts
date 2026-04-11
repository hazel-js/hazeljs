/**
 * Advanced Cache Features Demo (Simple Version)
 *
 * Demonstrates all new cache package features without decorator complexity
 */

import {
  CacheService,
  MemoryCacheStore,
  RedisDistributedLock,
  MemoryDistributedLock,
  LockManager,
  CacheWarmingUtils,
} from '../src';

// Mock database for demonstration
class MockDatabase {
  public products = new Map();
  public users = new Map();

  async findProduct(id: string) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return this.products.get(id) || null;
  }

  async findUser(id: string) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return this.users.get(id) || null;
  }

  async updateProduct(id: string, data: any) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    this.products.set(id, { ...this.products.get(id), ...data });
    return this.products.get(id);
  }

  async getAllProducts() {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return Array.from(this.products.values());
  }
}

// Simple service demonstrating cache patterns
class SimpleProductService {
  constructor(
    private cacheService: CacheService,
    private db: MockDatabase,
    private lockManager: LockManager
  ) {}

  /**
   * Example 1: Distributed Cache Locking (manual implementation)
   */
  async expensiveProductAnalysis(id: string) {
    const lockKey = `product-expensive-${id}`;

    return await this.lockManager.withLock(
      lockKey,
      async () => {
        console.log(
          `🔒 Executing expensive analysis for product ${id} (only one instance will run)`
        );

        // Simulate expensive computation
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const product = await this.db.findProduct(id);
        return {
          productId: id,
          analysis: `Complex analysis result for ${product?.name}`,
          timestamp: Date.now(),
        };
      },
      {
        ttl: 30000,
        retryDelay: 1000,
        maxRetries: 3,
      }
    );
  }

  /**
   * Example 2: Cache-Aside Pattern (manual implementation)
   */
  async getProduct(id: string) {
    const cacheKey = `product-${id}`;

    // Try to get from cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached !== null) {
      console.log(`📥 Cache hit for product ${id}`);
      return cached;
    }

    console.log(`📥 Cache miss for product ${id}, fetching from database`);
    const product = await this.db.findProduct(id);

    if (product !== null) {
      await this.cacheService.set(cacheKey, product, 3600); // 1 hour
    }

    return product;
  }

  /**
   * Example 3: Write-Through Caching (manual implementation)
   */
  async updateProduct(id: string, data: any) {
    console.log(`✏️ Write-through: Updating product ${id} in database and cache`);

    // Update database first
    const updatedProduct = await this.db.updateProduct(id, data);

    // Update cache immediately
    const cacheKey = `product-${id}`;
    await this.cacheService.set(cacheKey, updatedProduct, 3600);

    return updatedProduct;
  }

  /**
   * Example 4: Cache Warming (manual implementation)
   */
  async warmProductCache() {
    console.log('🔥 Manual cache warming');

    const keys = ['featured-products', 'all-products'];

    for (const key of keys) {
      let data;

      if (key === 'featured-products') {
        data = await this.db.getAllProducts(); // Simplified for demo
      } else if (key === 'all-products') {
        data = await this.db.getAllProducts();
      }

      if (data) {
        await this.cacheService.set(key, data, 7200); // 2 hours
        console.log(`Warmed cache key: ${key}`);
      }
    }

    return { message: 'Cache warming completed' };
  }
}

/**
 * Demo function to showcase all features
 */
async function demonstrateAdvancedCacheFeatures() {
  console.log('🚀 Advanced Cache Features Demo (Simple Version)\n');

  // Create cache service
  const memoryStore = new MemoryCacheStore();
  const cacheService = new CacheService('memory', { cleanupInterval: 60000 });

  // Create distributed lock
  const memoryLock = new MemoryDistributedLock();
  const lockManager = new LockManager(memoryLock);

  // Create services
  const db = new MockDatabase();
  const productService = new SimpleProductService(cacheService, db, lockManager);

  // Add some sample data
  db.products.set('1', { id: '1', name: 'Premium Laptop', featured: true });
  db.products.set('2', { id: '2', name: 'Wireless Mouse', featured: false });
  db.users.set('1', { id: '1', name: 'John Doe', role: 'user' });

  try {
    console.log('=== 1. Distributed Cache Locking ===');

    // Simulate concurrent requests
    const lockPromises = Array.from({ length: 3 }, (_, i) =>
      productService
        .expensiveProductAnalysis('1')
        .then((result) => console.log(`Lock result ${i + 1}:`, result))
        .catch((error) => console.log(`Lock error ${i + 1}:`, error.message))
    );

    await Promise.all(lockPromises);
    console.log('');

    console.log('=== 2. Cache-Aside Pattern ===');

    // First call - cache miss
    console.log('First call (cache miss):');
    const product1 = await productService.getProduct('1');
    console.log('Result:', product1);

    // Second call - cache hit
    console.log('\nSecond call (cache hit):');
    const product2 = await productService.getProduct('1');
    console.log('Result:', product2);
    console.log('');

    console.log('=== 3. Write-Through Caching ===');

    await productService.updateProduct('1', { name: 'Premium Laptop Pro' });
    console.log('Updated product, cache should be updated immediately');

    // Verify cache is updated
    const updatedProduct = await productService.getProduct('1');
    console.log('Cached product after update:', updatedProduct);
    console.log('');

    console.log('=== 4. Cache Warming ===');

    await productService.warmProductCache();
    console.log('Cache warming completed');
    console.log('');

    console.log('=== 5. Cache Statistics ===');

    const stats = await cacheService.getStats();
    console.log('Cache statistics:', {
      hits: stats.hits,
      misses: stats.misses,
      hitRate: `${stats.hitRate}%`,
      size: stats.size,
      memoryUsage: `${stats.memoryUsage} bytes`,
    });
    console.log('');

    console.log('✅ Advanced cache features demo completed successfully!');

    console.log('\n📋 Features Demonstrated:');
    console.log('✅ Distributed cache locking (prevents stampede)');
    console.log('✅ Cache-aside pattern (manual get/set)');
    console.log('✅ Write-through caching (immediate cache update)');
    console.log('✅ Cache warming (manual pre-population)');
    console.log('✅ Cache statistics and monitoring');
  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    // Clean up
    (memoryLock as any).destroy();
  }
}

// Run demo if executed directly
if (require.main === module) {
  demonstrateAdvancedCacheFeatures().catch(console.error);
}

export { demonstrateAdvancedCacheFeatures, SimpleProductService };
