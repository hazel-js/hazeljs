import { ILock, ILockBackend, LockOptions } from './interfaces';
import { MemoryLockBackend } from './backends/memory-backend';
import { RedisLockBackend } from './backends/redis-backend';

export class LockManager {
  private static instance: LockManager;
  private readonly backends = new Map<string, ILockBackend>();
  private defaultBackendName: string = 'memory';

  private constructor() {
    this.registerBackend('memory', new MemoryLockBackend());
  }

  static getInstance(): LockManager {
    if (!LockManager.instance) {
      LockManager.instance = new LockManager();
    }
    return LockManager.instance;
  }

  registerBackend(name: string, backend: ILockBackend): void {
    this.backends.set(name, backend);
  }

  setDefaultBackend(name: string): void {
    if (!this.backends.has(name)) {
      throw new Error(`Backend '${name}' is not registered.`);
    }
    this.defaultBackendName = name;
  }

  async acquire(options: LockOptions): Promise<ILock | null> {
    const backendName = options.backend || this.defaultBackendName;
    const backend = this.backends.get(backendName);

    if (!backend) {
      throw new Error(`Lock backend '${backendName}' not found`);
    }

    return backend.acquire(options);
  }

  // Helper method to setup Redis backend quickly
  setupRedis(redisOptions: unknown, name: string = 'redis'): void {
    const backend = new RedisLockBackend(redisOptions);
    this.registerBackend(name, backend);
    if (this.defaultBackendName === 'memory') {
      this.defaultBackendName = name;
    }
  }

  async close(): Promise<void> {
    for (const backend of this.backends.values()) {
      if (backend.close) {
        await backend.close();
      }
    }
    this.backends.clear();
    this.registerBackend('memory', new MemoryLockBackend());
  }
}
