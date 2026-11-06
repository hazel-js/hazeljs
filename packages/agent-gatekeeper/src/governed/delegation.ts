/**
 * Capability attenuation for subagents.
 * Does not change @Delegate — this is a new opt-in API.
 */

import { randomUUID } from 'crypto';
import type { DelegationGrant } from './types';
import type { DistributedLock } from './lock';

export interface DelegationStore {
  save(grant: DelegationGrant): Promise<DelegationGrant>;
  get(grantId: string): Promise<DelegationGrant | undefined>;
  updateSpent(grantId: string, spentUsd: number): Promise<DelegationGrant | undefined>;
}

export class MemoryDelegationStore implements DelegationStore {
  private readonly map = new Map<string, DelegationGrant>();

  async save(grant: DelegationGrant): Promise<DelegationGrant> {
    this.map.set(grant.grantId, { ...grant });
    return { ...grant };
  }

  async get(grantId: string): Promise<DelegationGrant | undefined> {
    const g = this.map.get(grantId);
    return g ? { ...g } : undefined;
  }

  async updateSpent(grantId: string, spentUsd: number): Promise<DelegationGrant | undefined> {
    const g = this.map.get(grantId);
    if (!g) return undefined;
    const next = { ...g, spentUsd };
    this.map.set(grantId, next);
    return { ...next };
  }
}

/** Cluster-wide budget counters (Redis or memory). */
export interface SharedBudgetCounter {
  incr(key: string, by: number, ttlMs: number): Promise<number>;
  get(key: string): Promise<number>;
}

export class MemoryBudgetCounter implements SharedBudgetCounter {
  private readonly map = new Map<string, { value: number; expiresAt: number }>();

  async incr(key: string, by: number, ttlMs: number): Promise<number> {
    const now = Date.now();
    const cur = this.map.get(key);
    if (!cur || cur.expiresAt <= now) {
      this.map.set(key, { value: by, expiresAt: now + ttlMs });
      return by;
    }
    cur.value += by;
    return cur.value;
  }

  async get(key: string): Promise<number> {
    const cur = this.map.get(key);
    if (!cur || cur.expiresAt <= Date.now()) return 0;
    return cur.value;
  }
}

export interface IssueDelegationInput {
  parent: {
    tenantId: string;
    actorId: string;
    runId: string;
    capabilities: readonly string[];
    depth: number;
  };
  /** Must be a subset of parent capabilities. */
  capabilities: readonly string[];
  budgetUsd: number;
  maxConcurrency?: number;
  ttlMs?: number;
  maxDepth?: number;
}

export class DelegationService {
  constructor(
    private readonly store: DelegationStore,
    private readonly budgets: SharedBudgetCounter,
    private readonly lock?: DistributedLock
  ) {}

  async issueDelegation(input: IssueDelegationInput): Promise<DelegationGrant> {
    const maxDepth = input.maxDepth ?? 2;
    const nextDepth = input.parent.depth + 1;
    if (nextDepth > maxDepth) {
      throw new Error(`Delegation depth ${nextDepth} exceeds max ${maxDepth}`);
    }

    const parentSet = new Set(input.parent.capabilities);
    for (const cap of input.capabilities) {
      if (!parentSet.has(cap) && !parentSet.has('*')) {
        throw new Error(`Child cannot inherit capability "${cap}" that parent lacks`);
      }
    }

    const grant: DelegationGrant = {
      grantId: `dlg_${randomUUID()}`,
      parentRunId: input.parent.runId,
      tenantId: input.parent.tenantId,
      actorId: input.parent.actorId,
      capabilities: Object.freeze([...input.capabilities]),
      budgetUsd: input.budgetUsd,
      spentUsd: 0,
      maxConcurrency: input.maxConcurrency ?? 2,
      depth: nextDepth,
      expiresAt: new Date(Date.now() + (input.ttlMs ?? 300_000)),
      createdAt: new Date(),
    };

    const concurrentKey = `dlg-conc:${input.parent.tenantId}:${input.parent.runId}`;
    const concurrent = await this.budgets.incr(concurrentKey, 1, input.ttlMs ?? 300_000);
    if (concurrent > grant.maxConcurrency) {
      throw new Error('Delegation concurrency budget exceeded');
    }

    return this.store.save(grant);
  }

  async charge(grantId: string, costUsd: number): Promise<DelegationGrant> {
    const handle = this.lock ? await this.lock.acquire(`dlg:${grantId}`, 3_000) : null;
    try {
      const grant = await this.store.get(grantId);
      if (!grant) throw new Error('Delegation grant not found');
      if (grant.expiresAt.getTime() < Date.now()) {
        throw new Error('Delegation grant expired');
      }
      const nextSpent = grant.spentUsd + costUsd;
      if (nextSpent > grant.budgetUsd) {
        throw new Error('Delegation spend budget exceeded');
      }
      await this.budgets.incr(`dlg-spend:${grant.tenantId}:${grantId}`, costUsd, 3600_000);
      const updated = await this.store.updateSpent(grantId, nextSpent);
      if (!updated) throw new Error('Failed to update delegation spend');
      return updated;
    } finally {
      await handle?.release();
    }
  }
}
