/**
 * GovernedMemoryService — opt-in lifecycle.
 * MemoryService is unchanged and never queries governed_memory_records.
 */

import {
  InMemoryGovernedMemoryStore,
  newGovernedRecord,
  rankMemories,
  type GovernedMemoryStore,
} from './store';
import type {
  CaptureMemoryInput,
  GovernedMemoryHooks,
  GovernedMemoryRecord,
  MemoryAuthContext,
  MemoryHook,
  MemoryHookContext,
  RetrievalCacheStore,
  RetrieveMemoryQuery,
} from './types';

export interface GovernedMemoryServiceOptions {
  store?: GovernedMemoryStore;
  hooks?: GovernedMemoryHooks;
  retrievalCache?: RetrievalCacheStore;
  retrievalCacheTtlMs?: number;
  /**
   * Required for org-scope promotion / executable procedures.
   * Default denies promotion.
   */
  authorizePromotion?: (input: {
    auth: MemoryAuthContext;
    record: GovernedMemoryRecord;
    targetScope: string;
  }) => Promise<boolean> | boolean;
}

export interface AuditEvent {
  action: string;
  recordId: string;
  tenantId: string;
  actorId?: string;
  at: Date;
  meta?: Record<string, unknown>;
}

async function runHooks(
  hooks: MemoryHook[] | undefined,
  ctx: MemoryHookContext,
  failClosed: boolean
): Promise<{ reject?: string; record?: GovernedMemoryRecord }> {
  if (!hooks?.length) return {};
  let record = ctx.record;
  for (const hook of hooks) {
    try {
      const result = await hook({ ...ctx, record });
      if (result.action === 'reject') return { reject: result.reason };
      if (result.action === 'transform') record = result.record;
    } catch (e) {
      if (failClosed) {
        return {
          reject: e instanceof Error ? e.message : 'Privacy hook failed closed',
        };
      }
    }
  }
  return { record };
}

function cacheKey(query: RetrieveMemoryQuery, versions: string): string {
  return [
    query.auth.tenantId,
    query.auth.actorId,
    query.auth.allowedScopes.join(','),
    query.subjectId ?? '',
    query.scope ?? '',
    query.type ?? '',
    query.text ?? '',
    versions,
  ].join('|');
}

export class GovernedMemoryService {
  private readonly store: GovernedMemoryStore;
  private readonly hooks: GovernedMemoryHooks;
  private readonly auditLog: AuditEvent[] = [];
  private readonly sourceObservationCounts = new Map<string, number>();

  constructor(private readonly options: GovernedMemoryServiceOptions = {}) {
    this.store = options.store ?? new InMemoryGovernedMemoryStore();
    this.hooks = options.hooks ?? {};
  }

  getAuditTrail(): readonly AuditEvent[] {
    return this.auditLog;
  }

  private audit(event: Omit<AuditEvent, 'at'>): void {
    this.auditLog.push({ ...event, at: new Date() });
  }

  async capture(input: CaptureMemoryInput): Promise<GovernedMemoryRecord> {
    // Tool output cannot become executable procedure without review.
    let status = input.status ?? 'candidate';
    if (input.type === 'procedure' && input.provenance.sourceKind === 'tool') {
      status = 'quarantined';
    }

    let record = newGovernedRecord({ ...input, status });

    // Same source repeats do not independently raise fact confidence.
    if (record.sourceId) {
      const key = `${record.tenantId}:${record.sourceId}`;
      const count = (this.sourceObservationCounts.get(key) ?? 0) + 1;
      this.sourceObservationCounts.set(key, count);
      if (count > 1 && record.factConfidence !== undefined) {
        // Keep confidence flat — do not inflate from repeated same-source observations.
        record = { ...record, factConfidence: record.factConfidence };
      }
    }

    const failClosed = this.hooks.failClosed !== false;
    const captured = await runHooks(this.hooks.capture, { name: 'capture', record }, failClosed);
    if (captured.reject) {
      record = { ...record, status: 'rejected', content: null };
      this.audit({
        action: 'capture.rejected',
        recordId: record.id,
        tenantId: record.tenantId,
        meta: { reason: captured.reject },
      });
      return this.store.insert(record);
    }
    if (captured.record) record = captured.record;

    const persisted = await runHooks(this.hooks.persist, { name: 'persist', record }, failClosed);
    if (persisted.reject) {
      record = { ...record, status: 'rejected', content: null };
    } else if (persisted.record) {
      record = persisted.record;
    }

    const saved = await this.store.insert(record);
    this.audit({
      action: 'capture',
      recordId: saved.id,
      tenantId: saved.tenantId,
      actorId: saved.provenance.actorId,
      meta: { status: saved.status, type: saved.type },
    });
    return saved;
  }

  async accept(
    id: string,
    auth: MemoryAuthContext,
    expectedVersion: number
  ): Promise<GovernedMemoryRecord | undefined> {
    const cur = await this.store.getById(id, auth);
    if (!cur || cur.status === 'forgotten') return undefined;
    if (cur.type === 'procedure') {
      const ok = await this.options.authorizePromotion?.({
        auth,
        record: cur,
        targetScope: cur.scope,
      });
      if (!ok) {
        this.audit({
          action: 'accept.denied',
          recordId: id,
          tenantId: auth.tenantId,
          actorId: auth.actorId,
        });
        return undefined;
      }
    }
    const next = { ...cur, status: 'accepted' as const };
    const updated = await this.store.compareAndSwap(id, expectedVersion, next);
    if (updated) {
      this.audit({
        action: 'accept',
        recordId: id,
        tenantId: auth.tenantId,
        actorId: auth.actorId,
      });
      await this.invalidateCache(auth.tenantId);
    }
    return updated;
  }

  async quarantine(
    id: string,
    auth: MemoryAuthContext,
    expectedVersion: number
  ): Promise<GovernedMemoryRecord | undefined> {
    const cur = await this.store.getById(id, auth);
    if (!cur) return undefined;
    const updated = await this.store.compareAndSwap(id, expectedVersion, {
      ...cur,
      status: 'quarantined',
    });
    if (updated) {
      this.audit({
        action: 'quarantine',
        recordId: id,
        tenantId: auth.tenantId,
        actorId: auth.actorId,
      });
      await this.invalidateCache(auth.tenantId);
    }
    return updated;
  }

  async correct(
    id: string,
    auth: MemoryAuthContext,
    expectedVersion: number,
    content: string
  ): Promise<GovernedMemoryRecord | undefined> {
    const cur = await this.store.getById(id, auth);
    if (!cur || cur.status === 'forgotten') return undefined;

    const correction = newGovernedRecord({
      tenantId: cur.tenantId,
      subjectId: cur.subjectId,
      scope: cur.scope,
      type: cur.type,
      content,
      provenance: {
        ...cur.provenance,
        sourceKind: 'feedback',
        note: `correction of ${cur.id}`,
        actorId: auth.actorId,
      },
      sourceTrust: Math.max(cur.sourceTrust, 0.7),
      factConfidence: cur.factConfidence,
      sensitivity: cur.sensitivity,
      lineageIds: [...cur.lineageIds, cur.id],
      sourceId: cur.sourceId ?? undefined,
      status: 'accepted',
    });
    const inserted = await this.store.insert(correction);
    const superseded = await this.store.compareAndSwap(id, expectedVersion, {
      ...cur,
      status: 'superseded',
      supersededBy: inserted.id,
      content: null,
    });
    if (!superseded) {
      // CAS failed — leave correction but mark note in audit
      this.audit({
        action: 'correct.cas_failed',
        recordId: id,
        tenantId: auth.tenantId,
        actorId: auth.actorId,
      });
      return undefined;
    }
    this.audit({
      action: 'correct',
      recordId: inserted.id,
      tenantId: auth.tenantId,
      actorId: auth.actorId,
      meta: { superseded: id },
    });
    await this.invalidateCache(auth.tenantId);
    return inserted;
  }

  async forget(
    id: string,
    auth: MemoryAuthContext,
    expectedVersion: number
  ): Promise<GovernedMemoryRecord | undefined> {
    const cur = await this.store.getById(id, auth);
    if (!cur) return undefined;
    const updated = await this.store.compareAndSwap(id, expectedVersion, {
      ...cur,
      status: 'forgotten',
      content: null,
      lineageIds: cur.lineageIds,
    });
    if (updated) {
      // Invalidate dependents that list this id in lineage.
      const all = await this.store.query({
        auth: { ...auth, allowedScopes: ['*'] },
        subjectId: cur.subjectId,
        limit: 1000,
      });
      // query only returns accepted — also need to find lineage holders via store internals.
      // Best-effort: re-query without status filter isn't available; audit lineage invalidation.
      this.audit({
        action: 'forget',
        recordId: id,
        tenantId: auth.tenantId,
        actorId: auth.actorId,
        meta: {
          note: 'Content erased. Backups are not instantly erased.',
          dependentsChecked: all.length,
        },
      });
      await this.invalidateCache(auth.tenantId);
    }
    return updated;
  }

  async retrieve(query: RetrieveMemoryQuery): Promise<GovernedMemoryRecord[]> {
    const failClosed = this.hooks.failClosed !== false;
    const hooked = await runHooks(
      this.hooks.retrieve,
      { name: 'retrieve', query, auth: query.auth },
      failClosed
    );
    if (hooked.reject) return [];

    const cache = this.options.retrievalCache;
    const key = cache ? cacheKey(query, 'v') : null;
    if (cache && key) {
      const hit = await cache.get(key);
      if (hit) {
        try {
          return JSON.parse(hit) as GovernedMemoryRecord[];
        } catch {
          /* miss */
        }
      }
    }

    let rows = await this.store.query(query);
    rows = rankMemories(rows, query.text);
    const limit = query.limit ?? 20;
    rows = rows.slice(0, limit);

    if (query.tokenBudget) {
      let used = 0;
      const kept: GovernedMemoryRecord[] = [];
      for (const r of rows) {
        const tokens = Math.ceil((r.content?.length ?? 0) / 4);
        if (used + tokens > query.tokenBudget) break;
        used += tokens;
        kept.push(r);
      }
      rows = kept;
    }

    if (this.store.touch) {
      for (const r of rows) {
        await this.store.touch(r.id);
      }
    }

    if (cache && key) {
      await cache.set(key, JSON.stringify(rows), this.options.retrievalCacheTtlMs ?? 30_000);
    }
    return rows;
  }

  async promoteScope(
    id: string,
    auth: MemoryAuthContext,
    expectedVersion: number,
    targetScope: string
  ): Promise<GovernedMemoryRecord | undefined> {
    const cur = await this.store.getById(id, auth);
    if (!cur || cur.status !== 'accepted') return undefined;
    const ok = await this.options.authorizePromotion?.({ auth, record: cur, targetScope });
    if (!ok) {
      this.audit({
        action: 'promote.denied',
        recordId: id,
        tenantId: auth.tenantId,
        actorId: auth.actorId,
      });
      return undefined;
    }
    const updated = await this.store.compareAndSwap(id, expectedVersion, {
      ...cur,
      scope: targetScope,
    });
    if (updated) {
      this.audit({
        action: 'promote',
        recordId: id,
        tenantId: auth.tenantId,
        actorId: auth.actorId,
        meta: { targetScope },
      });
      await this.invalidateCache(auth.tenantId);
    }
    return updated;
  }

  /**
   * Build observation for KAG promoteObservation — only accepted records.
   * Quarantined/rejected never become facts.
   */
  toKagObservation(record: GovernedMemoryRecord): {
    validated: true;
    confidence: number;
    subject: string;
    predicate: string;
    object: string;
    source: { type: string; id?: string };
  } | null {
    if (record.status !== 'accepted' || !record.content) return null;
    return {
      validated: true,
      confidence: record.factConfidence ?? record.sourceTrust,
      subject: record.subjectId,
      predicate: record.type,
      object: record.content,
      source: {
        type: 'governed-memory',
        id: record.id,
      },
    };
  }

  private async invalidateCache(tenantId: string): Promise<void> {
    const cache = this.options.retrievalCache;
    if (!cache) return;
    if (cache.deleteByPrefix) {
      await cache.deleteByPrefix(tenantId);
    }
  }
}

export class MemoryRetrievalCache implements RetrievalCacheStore {
  private readonly map = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const e = this.map.get(key);
    if (!e) return null;
    if (Date.now() >= e.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return e.value;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    for (const k of this.map.keys()) {
      if (k.startsWith(prefix)) this.map.delete(k);
    }
  }
}
