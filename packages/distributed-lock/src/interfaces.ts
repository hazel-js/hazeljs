export interface LockOptions {
  key: string;
  ttl?: number; // Time to live in milliseconds
  retry?: {
    attempts: number;
    delay: number;
  };
  backend?: 'redis' | 'memory' | string;
}

export interface ILock {
  release(): Promise<void>;
  extend(ttl: number): Promise<boolean>;
}

export interface ILockBackend {
  acquire(options: LockOptions): Promise<ILock | null>;
  release(key: string, identifier: string): Promise<void>;
  extend(key: string, identifier: string, ttl: number): Promise<boolean>;
  close?(): Promise<void>;
}

export type DistributedLockOptions = LockOptions;
