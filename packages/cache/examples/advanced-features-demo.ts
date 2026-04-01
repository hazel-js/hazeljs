/**
 * Advanced Cache Features Demo
 * 
 * Demonstrates all new cache package features:
 * - Distributed cache locking
 * - Cache-aside pattern
 * - Write-through/write-behind caching
 * - Smart cache warming
 */

import { Injectable } from '@hazeljs/core';
import {
  CacheModule,
  CacheService,
  // Original decorators
  Cache,
  CacheEvict,
  // New advanced decorators
  CacheLock,
  CacheAside,
  CacheAsideWithFallback,
  WriteThrough,
  WriteBehind,
  CacheWarm,
  CacheWarmingUtils,
} from '../src';

// Mock database for demonstration
class MockDatabase {
  public products = new Map();
  public users = new Map();

  async findProduct(id: string) {
    // Simulate slow database query
    await new Promise(resolve => setTimeout(resolve, 100));
    return this.products.get(id) || null;
  }

  async findUser(id: string) {
    // Simulate slow database query
    await new Promise(resolve => setTimeout(resolve, 100));
    return this.users.get(id) || null;
  }

  async updateProduct(id: string, data: any) {
    await new Promise(resolve => setTimeout(resolve, 50));
    this.products.set(id, { ...this.products.get(id), ...data });
    return this.products.get(id);
  }

  async updateUser(id: string, data: any) {
    await new Promise(resolve => setTimeout(resolve, 50));
    this.users.set(id, { ...this.users.get(id), ...data });
    return this.users.get(id);
  }

  async getAllProducts() {
    await new Promise(resolve => setTimeout(resolve, 200));
    return Array.from(this.products.values());
  }

  async getFeaturedProducts() {
    await new Promise(resolve => setTimeout(resolve, 150));
    return Array.from(this.products.values()).filter(p => p.featured);
  }
}

@Injectable()
export class ProductService {
  constructor(
    private cacheService: CacheService,
    private db: MockDatabase
  ) {}

  /**
   * Example 1: Distributed Cache Locking
   * Prevents cache stampede when multiple requests try to compute the same value
   */
  @CacheLock({
    key: 'product-expensive-{id}',
    ttl: 30000, // 30 seconds
    retryDelay: 1000,
    maxRetries: 3
  })
  async expensiveProductAnalysis(id: string) {
    console.log(`🔒 Executing expensive analysis for product ${id} (only one instance will run)`);
    
    // Simulate expensive computation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const product = await this.db.findProduct(id);
    return {
      productId: id,
      analysis: `Complex analysis result for ${product?.name}`,
      timestamp: Date.now()
    };
  }

  /**
   * Example 2: Cache-Aside Pattern
   * Automatic get/set logic with fallback
   */
  @CacheAside({
    key: 'product-{id}',
    ttl: 3600, // 1 hour
    fallback: () => Promise.resolve({ id: 'default', name: 'Default Product' })
  })
  async getProduct(id: string) {
    console.log(`📥 Cache-aside: Fetching product ${id} from database`);
    return await this.db.findProduct(id);
  }

  /**
   * Example 3: Cache-Aside with explicit fallback
   */
  @CacheAsideWithFallback({
    key: 'user-{id}',
    ttl: 1800, // 30 minutes
    fallbackValue: { id: 'unknown', name: 'Guest User', role: 'guest' }
  })
  async getUser(id: string) {
    console.log(`👤 Cache-aside with fallback: Fetching user ${id}`);
    return await this.db.findUser(id);
  }

  /**
   * Example 4: Write-Through Caching
   * Updates cache immediately when data changes
   */
  @WriteThrough({
    key: 'product-{id}',
    ttl: 3600
  })
  async updateProduct(id: string, data: any) {
    console.log(`✏️ Write-through: Updating product ${id} in database and cache`);
    return await this.db.updateProduct(id, data);
  }

  /**
   * Example 5: Write-Behind Caching
   * Queues cache updates for better performance
   */
  @WriteBehind({
    key: 'user-{id}',
    ttl: 1800,
    async: true
  })
  async updateUser(id: string, data: any) {
    console.log(`⏱️ Write-behind: Updating user ${id} in database, cache update queued`);
    return await this.db.updateUser(id, data);
  }

  /**
   * Example 6: Smart Cache Warming
   * Pre-populates cache on schedule
   */
  @CacheWarm({
    keys: ['featured-products', 'all-products'],
    fetcher: async function(this: ProductService, key: string) {
      console.log(`🔥 Warming cache key: ${key}`);
      if (key === 'featured-products') {
        return await this.db.getFeaturedProducts();
      } else if (key === 'all-products') {
        return await this.db.getAllProducts();
      }
      return null;
    },
    ttl: 7200, // 2 hours
    parallel: true,
    schedule: '0 */6 * * *', // Every 6 hours
    condition: 'low-traffic' // Only warm during low traffic hours
  })
  async warmProductCache() {
    console.log('🌡️ Cache warming method executed');
    return { message: 'Cache warming completed' };
  }

  /**
   * Example 7: Traditional caching with new features
   */
  @Cache({
    key: 'product-stats-{id}',
    ttl: 1800,
    tags: ['products', 'stats']
  })
  async getProductStats(id: string) {
    console.log(`📊 Computing stats for product ${id}`);
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      views: Math.floor(Math.random() * 1000),
      purchases: Math.floor(Math.random() * 100),
      rating: (Math.random() * 5).toFixed(1)
    };
  }

  /**
   * Example 8: Cache invalidation with tags
   */
  @CacheEvict({
    tags: ['products', 'stats']
  })
  async clearProductStats() {
    console.log('🗑️ Cleared all product-related caches');
    return { cleared: true };
  }
}

/**
 * Demo function to showcase all features
 */
async function demonstrateAdvancedCacheFeatures() {
  console.log('🚀 Advanced Cache Features Demo\n');

  // Initialize cache module
  const cacheModule = CacheModule.forRoot({
    strategy: 'memory',
    cleanupInterval: 60000
  });

  // Create services
  const db = new MockDatabase();
  const productService = new ProductService(
    new CacheService('memory'),
    db
  );

  // Add some sample data
  db.products.set('1', { id: '1', name: 'Premium Laptop', featured: true });
  db.products.set('2', { id: '2', name: 'Wireless Mouse', featured: false });
  db.users.set('1', { id: '1', name: 'John Doe', role: 'user' });

  try {
    console.log('=== 1. Distributed Cache Locking ===');
    
    // Simulate concurrent requests
    const lockPromises = Array.from({ length: 3 }, (_, i) => 
      productService.expensiveProductAnalysis('1')
        .then(result => console.log(`Lock result ${i + 1}:`, result))
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
    
    // Call with non-existent ID - fallback
    console.log('\nCall with fallback:');
    const product3 = await productService.getProduct('999');
    console.log('Result:', product3);
    console.log('');

    console.log('=== 3. Cache-Aside with Fallback ===');
    
    const user1 = await productService.getUser('1');
    console.log('User result:', user1);
    
    const user2 = await productService.getUser('999');
    console.log('Fallback user result:', user2);
    console.log('');

    console.log('=== 4. Write-Through Caching ===');
    
    await productService.updateProduct('1', { name: 'Premium Laptop Pro' });
    console.log('Updated product, cache should be updated immediately');
    
    // Verify cache is updated
    const updatedProduct = await productService.getProduct('1');
    console.log('Cached product after update:', updatedProduct);
    console.log('');

    console.log('=== 5. Write-Behind Caching ===');
    
    await productService.updateUser('1', { name: 'John Smith' });
    console.log('Updated user, cache update is queued');
    console.log('');

    console.log('=== 6. Traditional Caching with Tags ===');
    
    const stats1 = await productService.getProductStats('1');
    console.log('Product stats (computed):', stats1);
    
    const stats2 = await productService.getProductStats('1');
    console.log('Product stats (cached):', stats2);
    console.log('');

    console.log('=== 7. Cache Invalidation ===');
    
    await productService.clearProductStats();
    console.log('Cleared caches, next call will recompute');
    
    const stats3 = await productService.getProductStats('1');
    console.log('Product stats after invalidation:', stats3);
    console.log('');

    console.log('=== 8. Cache Warming Utilities ===');
    
    // List warming jobs
    const jobs = CacheWarmingUtils.listJobs();
    console.log('Active warming jobs:', jobs);
    
    // Manual warm up
    if (jobs.length > 0) {
      console.log('Manually triggering cache warming...');
      await CacheWarmingUtils.warmUp(jobs[0]);
      console.log('Cache warming completed');
    }
    console.log('');

    console.log('✅ Advanced cache features demo completed successfully!');
    
    console.log('\n📋 Features Demonstrated:');
    console.log('✅ Distributed cache locking (prevents stampede)');
    console.log('✅ Cache-aside pattern (automatic get/set)');
    console.log('✅ Cache-aside with fallback values');
    console.log('✅ Write-through caching (immediate cache update)');
    console.log('✅ Write-behind caching (queued cache update)');
    console.log('✅ Smart cache warming (scheduled pre-population)');
    console.log('✅ Traditional caching with tags');
    console.log('✅ Cache invalidation with tags');
    console.log('✅ Cache warming utilities');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    // Clean up warming jobs
    CacheWarmingUtils.destroy();
  }
}

// Run demo if executed directly
if (require.main === module) {
  demonstrateAdvancedCacheFeatures().catch(console.error);
}

export { demonstrateAdvancedCacheFeatures };
