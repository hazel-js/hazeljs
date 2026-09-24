/**
 * Explicit decision cache — never global / automatic.
 * Callers opt in; state fingerprint invalidates entries.
 * Cached results never re-execute capabilities.
 */

import { createHash } from 'crypto';
import type { DecisionRequest, DecisionResult } from '../types';

export interface DecisionCacheOptions {
  /** Max entries (default 256). */
  maxEntries?: number;
  /** TTL in ms (default 60_000). */
  ttlMs?: number;
}

export interface DecisionCacheEntry {
  key: string;
  result: DecisionResult;
  storedAt: number;
  expiresAt: number;
}

export interface CachedDecisionResult extends DecisionResult {
  cached: true;
  cacheKey: string;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/**
 * Fingerprint for cache keys — includes objective, choices, risk, provider, strategy, state.
 * Does not include runId / traceId (those are per-invocation).
 */
export function decisionCacheKey(request: DecisionRequest): string {
  const payload = {
    name: request.name,
    objective: request.objective,
    choices: request.choices,
    risk: request.risk,
    strategy: request.strategy,
    provider: request.provider,
    state: request.state,
    tenantId: request.context?.tenantId,
  };
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

export class DecisionCache {
  private readonly store = new Map<string, DecisionCacheEntry>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(options: DecisionCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? 256;
    this.ttlMs = options.ttlMs ?? 60_000;
  }

  get(key: string): CachedDecisionResult | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return {
      ...entry.result,
      execution: {
        requested: false,
        authorized: entry.result.execution?.authorized,
        capability: entry.result.execution?.capability,
        invoked: false,
      },
      cached: true,
      cacheKey: key,
    };
  }

  set(key: string, result: DecisionResult): void {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }
    const now = Date.now();
    this.store.set(key, {
      key,
      result: {
        ...result,
        execution: result.execution ? { ...result.execution, invoked: false } : result.execution,
      },
      storedAt: now,
      expiresAt: now + this.ttlMs,
    });
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}
