# Distributed Locking

HazelJS provides a robust distributed locking system via the `@hazeljs/distributed-lock` package. This allows you to synchronize access to shared resources across multiple service instances.

## 📦 Installation

```bash
npm install @hazeljs/distributed-lock
```

## 🚀 Quick Start

### 1. Register the Lock Module

First, register the `DistributedLockModule` in your application module. You can choose between `memory` (for development) or `redis` (for production) backends.

```typescript
import { HazelModule } from '@hazeljs/core';
import { DistributedLockModule } from '@hazeljs/distributed-lock';

@HazelModule({
  imports: [
    DistributedLockModule.forRoot({
      backend: 'redis', // or 'memory'
      prefix: 'myapp:', 
      redis: {
        host: 'localhost',
        port: 6379,
      },
      defaultTtl: 30000, // 30 seconds
    }),
  ],
})
export class AppModule {}
```

### 2. Using the `@DistributedLock` Decorator

The easiest way to use locking is via the `@DistributedLock` decorator on controller or service methods.

```typescript
import { Controller, Post, Body } from '@hazeljs/core';
import { DistributedLock } from '@hazeljs/distributed-lock';

@Controller('/inventory')
export class InventoryController {
  @Post('/update')
  @DistributedLock({ 
    key: 'inventory:update:{{body.productId}}', 
    ttl: 5000 
  })
  async updateInventory(@Body() { productId, quantity }: { productId: string, quantity: number }) {
    // This code is protected by a distributed lock for the specific productId
    // Only one instance can process this product at a time
    return await this.inventoryService.update(productId, quantity);
  }
}
```

### 3. Using the `LockManager` Programmatically

For more control, you can inject the `LockManager` and manage locks manually.

```typescript
import { Injectable } from '@hazeljs/core';
import { LockManager } from '@hazeljs/distributed-lock';

@Injectable()
export class CriticalService {
  constructor(private lockManager: LockManager) {}

  async processTask(id: string) {
    const lockKey = `task:${id}`;
    
    // Acquire lock
    const lock = await this.lockManager.acquire(lockKey, {
      ttl: 10000,
      wait: true, // Wait if already locked
      waitTimeout: 5000, // Wait up to 5s
    });

    try {
      // Critical section
      await this.doWork();
    } finally {
      // Always release the lock
      await this.lockManager.release(lock);
    }
  }
}
```

## 🛠️ Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `backend` | `memory` or `redis` | `memory` |
| `prefix` | Prefix for all lock keys | `hazel:lock:` |
| `defaultTtl` | Default lock timeout (ms) | `30000` |
| `redis` | Redis connection options | `undefined` |

## 🔑 Key Patterns

The `@DistributedLock` decorator supports template strings for keys:
- `{{body.fieldName}}` - Access request body
- `{{params.id}}` - Access URL parameters
- `{{query.name}}` - Access query parameters
- `{{user.id}}` - Access authenticated user info (if using `@hazeljs/auth`)

## 🛡️ Best Practices

1. **Always use a timeout**: Never acquire a lock without a TTL to prevent deadlocks if a process crashes.
2. **Short critical sections**: Keep the code inside the lock as fast as possible.
3. **Release in `finally`**: Always release locks in a `finally` block to ensure they are freed even on errors.
4. **Use specific keys**: Instead of a global lock, use granular keys (e.g., `user:123:update`) to maximize concurrency.
