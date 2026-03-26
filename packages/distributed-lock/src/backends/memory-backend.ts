import { ILock, ILockBackend, LockOptions } from '../interfaces';

export class MemoryLock implements ILock {
  constructor(
    private readonly backend: MemoryLockBackend,
    private readonly key: string,
    private readonly identifier: string,
    private expiration: number
  ) {}

  async release(): Promise<void> {
    return this.backend.release(this.key, this.identifier);
  }

  async extend(ttl: number): Promise<boolean> {
    return this.backend.extend(this.key, this.identifier, ttl);
  }
}

export class MemoryLockBackend implements ILockBackend {
  private readonly locks = new Map<
    string,
    { identifier: string; expiration: number; timer?: NodeJS.Timeout }
  >();

  async acquire(options: LockOptions): Promise<ILock | null> {
    const { key, ttl = 30000, retry } = options;
    const identifier = Math.random().toString(36).substring(2);

    const attempt = async (): Promise<ILock | null> => {
      const current = this.locks.get(key);
      const now = Date.now();

      if (!current || current.expiration < now) {
        if (current?.timer) {
          clearTimeout(current.timer);
        }

        const expiration = now + ttl;
        const timer = setTimeout(() => {
          this.release(key, identifier);
        }, ttl);

        this.locks.set(key, { identifier, expiration, timer });
        return new MemoryLock(this, key, identifier, expiration);
      }
      return null;
    };

    let lock = await attempt();
    if (lock) return lock;

    if (retry) {
      for (let i = 0; i < retry.attempts; i++) {
        await new Promise((resolve) => setTimeout(resolve, retry.delay));
        lock = await attempt();
        if (lock) return lock;
      }
    }

    return null;
  }

  async release(key: string, identifier: string): Promise<void> {
    const current = this.locks.get(key);
    if (current && current.identifier === identifier) {
      if (current.timer) {
        clearTimeout(current.timer);
      }
      this.locks.delete(key);
    }
  }

  async extend(key: string, identifier: string, ttl: number): Promise<boolean> {
    const current = this.locks.get(key);
    if (current && current.identifier === identifier) {
      if (current.timer) {
        clearTimeout(current.timer);
      }

      const expiration = Date.now() + ttl;
      const timer = setTimeout(() => {
        this.release(key, identifier);
      }, ttl);

      this.locks.set(key, { identifier, expiration, timer });
      return true;
    }
    return false;
  }

  async close(): Promise<void> {
    for (const lock of this.locks.values()) {
      if (lock.timer) {
        clearTimeout(lock.timer);
      }
    }
    this.locks.clear();
  }
}
