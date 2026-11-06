/**
 * Shared Decision Plane cache port.
 * Memory for tests / single process; Redis for multi-instance.
 * Keys never include raw sensitive context.
 */

import { createHash } from 'crypto';
import type { DecisionDefinition } from './definition';
import type { PlaneExecutionContext, PlaneResult } from './result';

export interface DecisionCacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
  delete?(key: string): Promise<void>;
}

export class MemoryDecisionCacheStore implements DecisionCacheStore {
  private readonly map = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    this.map.set(key, { value, expiresAt: Date.now() + Math.max(1, ttlMs) });
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
}

/** Duck-typed Redis client (ioredis / @hazeljs/redis). */
export interface RedisLikeCacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del?(...keys: string[]): Promise<unknown>;
}

export class RedisDecisionCacheStore implements DecisionCacheStore {
  constructor(
    private readonly redis: RedisLikeCacheClient,
    private readonly keyPrefix = 'hazel:decision-plane:'
  ) {}

  private k(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(this.k(key));
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    const seconds = Math.max(1, Math.ceil(ttlMs / 1000));
    await this.redis.set(this.k(key), value, 'EX', seconds);
  }

  async delete(key: string): Promise<void> {
    if (this.redis.del) await this.redis.del(this.k(key));
  }
}

/**
 * Shared fake Redis for two logical instances in tests.
 * Mirrors FakeRedisClient pattern from @hazeljs/cag.
 */
export class FakeRedisDecisionClient implements RedisLikeCacheClient {
  private readonly data = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ...args: unknown[]): Promise<'OK'> {
    let expiresAt: number | undefined;
    if (args[0] === 'EX' && typeof args[1] === 'number') {
      expiresAt = Date.now() + args[1] * 1000;
    }
    this.data.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let n = 0;
    for (const k of keys) {
      if (this.data.delete(k)) n += 1;
    }
    return n;
  }
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

export function planeInputDigest(context: unknown): string {
  return createHash('sha256').update(canonicalJson(context)).digest('hex');
}

export function planeCacheKey(parts: {
  definition: DecisionDefinition;
  execution: PlaneExecutionContext;
  inputDigest: string;
  providerStrategy: string;
}): string {
  const payload = {
    tenantId: parts.execution.tenantId,
    actorId: parts.execution.actorId,
    permissionScope: parts.execution.permissionScope,
    definitionId: parts.definition.id,
    definitionVersion: parts.definition.version,
    policyVersion: parts.execution.policyVersion ?? parts.definition.policyVersion ?? '',
    providerStrategy: parts.providerStrategy,
    inputDigest: parts.inputDigest,
  };
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

export function serializePlaneResult(result: PlaneResult): string {
  return JSON.stringify(result);
}

export function deserializePlaneResult(raw: string): PlaneResult | null {
  try {
    const parsed = JSON.parse(raw) as PlaneResult;
    if (!parsed?.status || !parsed?.decisionId) return null;
    return parsed;
  } catch {
    return null;
  }
}
