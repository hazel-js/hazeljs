# @hazeljs/distributed-lock

**Distributed Locking for HazelJS. Mutual exclusion across all your nodes, simplified.**

Ensure that your critical code paths are only executed by one instance at a time. HazelJS Distributed Lock provides a unified interface for multiple backends (Redis, In-Memory) and a powerful decorator-based API with dynamic key resolution.

[![npm version](https://img.shields.io/npm/v/@hazeljs/distributed-lock.svg)](https://www.npmjs.com/package/@hazeljs/distributed-lock)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/distributed-lock)](https://www.npmjs.com/package/@hazeljs/distributed-lock)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- 🔒 **Decorator-Based API** — Use `@DistributedLock()` for declarative, method-level locking across your distributed system.
- 📂 **Multiple Backends** — First-class support for **Redis** (production) and **Memory** (local development/testing).
- 🔢 **Dynamic Key Resolution** — Support for template placeholders (e.g., `{id}`, `{user.token}`) that automatically resolve from method arguments.
- ⚖️ **Atomic Mutual Exclusion** — Guarantees that exactly one process executes a given snippet at any moment across all nodes.
- 🔄 **Wait & Retry Strategies** — Highly configurable lock acquisition logic, including retry counts, delays, and TTLs.
- 🧹 **Automatic Cleanup** — Locks are automatically released upon method completion, regardless of success or failure.

---

## Installation

```bash
npm install @hazeljs/distributed-lock
```

### Optional Peer Dependencies

For production environments using Redis, you'll need the following:

```bash
npm install redis
```

---

## Quick Start (Decorator)

The easiest way to use distributed locking is through the `@DistributedLock` decorator.

### 1. Simple Locking

Lock a method for a specific user based on an argument.

```typescript
import { DistributedLock } from '@hazeljs/distributed-lock';

class UserProfileService {
  @DistributedLock({ 
    key: 'update-profile-{userId}', 
    ttl: 10000, 
    wait: true 
  })
  async updateProfile(userId: string, data: any) {
    // This code is now thread-safe across all distributed nodes
    // for this specific userId.
    return await this.saveProfile(userId, data);
  }
}
```

### 2. Manual Programmatic API

You can also acquire and release locks manually using the `LockManager`.

```typescript
import { LockManager } from '@hazeljs/distributed-lock';

const lockManager = LockManager.getInstance();

async function myTask() {
  const lock = await lockManager.acquire({
    key: 'manual-task-lock',
    ttl: 5000,
  });

  if (!lock) return; // Could not acquire lock

  try {
    // Perform critical task...
  } finally {
    // Always release in finally block
    await lock.release();
  }
}
```

---

## Lock Backends

Choose the backend that fits your deployment strategy.

### In-Memory (Default)

Great for development or single-node deployments.

```typescript
import { LockManager } from '@hazeljs/distributed-lock';

const lockManager = LockManager.getInstance();
lockManager.setDefaultBackend('memory');
```

### Redis (Production)

Recommended for multi-node production systems.

```typescript
import { LockManager } from '@hazeljs/distributed-lock';

const lockManager = LockManager.getInstance();

lockManager.setupRedis({
  url: 'redis://localhost:6379',
}, 'redis-prod');

lockManager.setDefaultBackend('redis-prod');
```

---

## Backend Comparison

| | In-Memory | Redis | Custom |
|---|:---:|:---:|:---:|
| **Distributed** | ❌ (Single node) | ✅ (All nodes) | ✅ (Interface-based) |
| **Setup** | None | Required | Custom impl |
| **Best For** | Development / Testing | Production / High Load | Specialized systems |
| **Performance** | Nano-seconds | Milli-seconds | Backend-dependent |

---

## Configuration Options

| Option | Type | Description |
| --- | --- | --- |
| `key` | `string` | The unique lock identifier. Supports `{param}` placeholders from method args. |
| `ttl` | `number` | Time-To-Live in milliseconds. Default: `5000`. |
| `wait` | `boolean` | If true, will wait for the lock if held. Default: `false`. |
| `retryCount`| `number` | Number of retries if `wait` is true. Default: `3`. |
| `retryDelay`| `number` | Time between retries in milliseconds. Default: `100`. |
| `backend` | `string` | Override the default backend (e.g., `'memory'`, `'redis'`). |

---

## API Reference

### `LockManager` (Singleton)

```typescript
class LockManager {
  static getInstance(): LockManager;
  registerBackend(name: string, backend: ILockBackend): void;
  setDefaultBackend(name: string): void;
  acquire(options: LockOptions): Promise<ILock | null>;
  setupRedis(redisOptions: any, name?: string): void;
}
```

### `Interfaces`

- **`ILock`** — An acquired lock. Contains `release(): Promise<void>`.
- **`ILockBackend`** — The interface for implementing custom lock providers.

---

## Use Cases

- 💰 **Payment Processing** — Preventing double-charging on concurrent requests.
- 📦 **Inventory Management** — Ensuring stock counts remain accurate across multiple instances.
- 👤 **Global Singletons** — Guaranteeing that only one cron job or worker runs a task globally.
- 🏗️ **Resource Provisioning** — Atomically creating cloud resources like databases or VMs.

---

## License

Apache-2.0

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.
