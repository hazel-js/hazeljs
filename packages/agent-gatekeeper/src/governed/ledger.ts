/**
 * Tool attempt ledger — shared across replicas for consequential actions.
 * Memory for single-process tests; Redis for multi-instance.
 */

import type { ToolAttemptRecord, ToolAttemptStatus } from './types';
import type { DistributedLock } from './lock';

export interface ToolAttemptLedger {
  get(idempotencyKey: string): Promise<ToolAttemptRecord | undefined>;
  /**
   * Atomically claim dispatch. Returns existing record if already claimed.
   */
  beginDispatch(
    record: Omit<ToolAttemptRecord, 'status' | 'createdAt' | 'updatedAt'> & {
      status?: ToolAttemptStatus;
    }
  ): Promise<{ created: boolean; record: ToolAttemptRecord }>;
  update(
    idempotencyKey: string,
    patch: Partial<Pick<ToolAttemptRecord, 'status' | 'outcome' | 'error'>>
  ): Promise<ToolAttemptRecord | undefined>;
}

export class MemoryToolAttemptLedger implements ToolAttemptLedger {
  private readonly map = new Map<string, ToolAttemptRecord>();

  constructor(private readonly lock?: DistributedLock) {}

  async get(idempotencyKey: string): Promise<ToolAttemptRecord | undefined> {
    const r = this.map.get(idempotencyKey);
    return r ? { ...r } : undefined;
  }

  async beginDispatch(
    input: Omit<ToolAttemptRecord, 'status' | 'createdAt' | 'updatedAt'> & {
      status?: ToolAttemptStatus;
    }
  ): Promise<{ created: boolean; record: ToolAttemptRecord }> {
    const handle = this.lock
      ? await this.lock.acquire(`attempt:${input.idempotencyKey}`, 5_000)
      : null;
    if (this.lock && !handle) {
      const existing = this.map.get(input.idempotencyKey);
      if (existing) return { created: false, record: { ...existing } };
      throw new Error('Could not acquire attempt lock');
    }
    try {
      const existing = this.map.get(input.idempotencyKey);
      if (existing) {
        return { created: false, record: { ...existing } };
      }
      const now = new Date();
      const record: ToolAttemptRecord = {
        ...input,
        status: input.status ?? 'dispatched',
        createdAt: now,
        updatedAt: now,
      };
      this.map.set(input.idempotencyKey, record);
      return { created: true, record: { ...record } };
    } finally {
      await handle?.release();
    }
  }

  async update(
    idempotencyKey: string,
    patch: Partial<Pick<ToolAttemptRecord, 'status' | 'outcome' | 'error'>>
  ): Promise<ToolAttemptRecord | undefined> {
    const existing = this.map.get(idempotencyKey);
    if (!existing) return undefined;
    const next: ToolAttemptRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date(),
    };
    this.map.set(idempotencyKey, next);
    return { ...next };
  }
}

export interface RedisLedgerClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
}

export class RedisToolAttemptLedger implements ToolAttemptLedger {
  constructor(
    private readonly redis: RedisLedgerClient,
    private readonly lock: DistributedLock,
    private readonly keyPrefix = 'hazel:tool-attempt:'
  ) {}

  private k(id: string): string {
    return `${this.keyPrefix}${id}`;
  }

  private serialize(r: ToolAttemptRecord): string {
    return JSON.stringify({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    });
  }

  private deserialize(raw: string): ToolAttemptRecord | undefined {
    try {
      const p = JSON.parse(raw) as ToolAttemptRecord & {
        createdAt: string;
        updatedAt: string;
      };
      return {
        ...p,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      };
    } catch {
      return undefined;
    }
  }

  async get(idempotencyKey: string): Promise<ToolAttemptRecord | undefined> {
    const raw = await this.redis.get(this.k(idempotencyKey));
    return raw ? this.deserialize(raw) : undefined;
  }

  async beginDispatch(
    input: Omit<ToolAttemptRecord, 'status' | 'createdAt' | 'updatedAt'> & {
      status?: ToolAttemptStatus;
    }
  ): Promise<{ created: boolean; record: ToolAttemptRecord }> {
    const handle = await this.lock.acquire(`attempt:${input.idempotencyKey}`, 5_000);
    if (!handle) {
      const existing = await this.get(input.idempotencyKey);
      if (existing) return { created: false, record: existing };
      throw new Error('Could not acquire attempt lock');
    }
    try {
      const existing = await this.get(input.idempotencyKey);
      if (existing) return { created: false, record: existing };
      const now = new Date();
      const record: ToolAttemptRecord = {
        ...input,
        status: input.status ?? 'dispatched',
        createdAt: now,
        updatedAt: now,
      };
      await this.redis.set(this.k(input.idempotencyKey), this.serialize(record));
      return { created: true, record };
    } finally {
      await handle.release();
    }
  }

  async update(
    idempotencyKey: string,
    patch: Partial<Pick<ToolAttemptRecord, 'status' | 'outcome' | 'error'>>
  ): Promise<ToolAttemptRecord | undefined> {
    const existing = await this.get(idempotencyKey);
    if (!existing) return undefined;
    const next: ToolAttemptRecord = { ...existing, ...patch, updatedAt: new Date() };
    await this.redis.set(this.k(idempotencyKey), this.serialize(next));
    return next;
  }
}
