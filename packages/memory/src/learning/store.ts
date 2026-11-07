/**
 * Governed memory store port + in-memory implementation.
 * Tenant/actor filters apply before ranking.
 */

import { randomUUID } from 'crypto';
import type {
  CaptureMemoryInput,
  GovernedMemoryRecord,
  MemoryAuthContext,
  RetrieveMemoryQuery,
} from './types';

export interface GovernedMemoryStore {
  insert(record: GovernedMemoryRecord): Promise<GovernedMemoryRecord>;
  getById(id: string, auth: MemoryAuthContext): Promise<GovernedMemoryRecord | undefined>;
  /**
   * Compare-and-swap update. Returns undefined if version mismatch.
   */
  compareAndSwap(
    id: string,
    expectedVersion: number,
    next: GovernedMemoryRecord
  ): Promise<GovernedMemoryRecord | undefined>;
  /**
   * Query with tenant + status filters applied before any ranking.
   */
  query(query: RetrieveMemoryQuery): Promise<GovernedMemoryRecord[]>;
  listBySourceId(tenantId: string, sourceId: string): Promise<GovernedMemoryRecord[]>;
  /** Increment access without changing version (telemetry only). */
  touch?(id: string): Promise<void>;
}

function clone(r: GovernedMemoryRecord): GovernedMemoryRecord {
  return {
    ...r,
    provenance: { ...r.provenance },
    lineageIds: [...r.lineageIds],
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
    expiresAt: r.expiresAt ? new Date(r.expiresAt) : r.expiresAt,
  };
}

function scopeAllowed(auth: MemoryAuthContext, scope: string): boolean {
  return auth.allowedScopes.includes('*') || auth.allowedScopes.includes(scope);
}

export class InMemoryGovernedMemoryStore implements GovernedMemoryStore {
  private readonly map = new Map<string, GovernedMemoryRecord>();

  async insert(record: GovernedMemoryRecord): Promise<GovernedMemoryRecord> {
    const stored = clone(record);
    this.map.set(stored.id, stored);
    return clone(stored);
  }

  async getById(id: string, auth: MemoryAuthContext): Promise<GovernedMemoryRecord | undefined> {
    const r = this.map.get(id);
    if (!r) return undefined;
    if (r.tenantId !== auth.tenantId) return undefined;
    if (!scopeAllowed(auth, r.scope)) return undefined;
    return clone(r);
  }

  async compareAndSwap(
    id: string,
    expectedVersion: number,
    next: GovernedMemoryRecord
  ): Promise<GovernedMemoryRecord | undefined> {
    const cur = this.map.get(id);
    if (!cur || cur.version !== expectedVersion) return undefined;
    const stored = clone({ ...next, version: expectedVersion + 1, updatedAt: new Date() });
    this.map.set(id, stored);
    return clone(stored);
  }

  async query(query: RetrieveMemoryQuery): Promise<GovernedMemoryRecord[]> {
    const { auth } = query;
    const now = Date.now();
    const rows: GovernedMemoryRecord[] = [];
    for (const r of this.map.values()) {
      if (r.tenantId !== auth.tenantId) continue;
      if (!scopeAllowed(auth, r.scope)) continue;
      if (r.status !== 'accepted') continue;
      if (r.supersededBy) continue;
      if (r.expiresAt && r.expiresAt.getTime() < now) continue;
      if (query.subjectId && r.subjectId !== query.subjectId) continue;
      if (query.scope && r.scope !== query.scope) continue;
      if (query.type && r.type !== query.type) continue;
      if (query.text) {
        const hay = (r.content ?? '').toLowerCase();
        if (!hay.includes(query.text.toLowerCase())) continue;
      }
      rows.push(clone(r));
    }
    return rows;
  }

  async listBySourceId(tenantId: string, sourceId: string): Promise<GovernedMemoryRecord[]> {
    return [...this.map.values()]
      .filter((r) => r.tenantId === tenantId && r.sourceId === sourceId)
      .map(clone);
  }

  async touch(id: string): Promise<void> {
    const cur = this.map.get(id);
    if (cur) cur.accessCount += 1;
  }
}

export function newGovernedRecord(input: CaptureMemoryInput): GovernedMemoryRecord {
  const now = new Date();
  return {
    id: `gmem_${randomUUID()}`,
    tenantId: input.tenantId,
    subjectId: input.subjectId,
    scope: input.scope,
    type: input.type,
    content: input.content,
    provenance: { ...input.provenance },
    sourceTrust: input.sourceTrust,
    factConfidence: input.factConfidence,
    extractionConfidence: input.extractionConfidence,
    version: 1,
    status: input.status ?? 'candidate',
    sensitivity: input.sensitivity ?? 'normal',
    expiresAt: input.expiresAt ?? null,
    lineageIds: input.lineageIds ?? [],
    sourceId: input.sourceId ?? input.provenance.sourceId ?? null,
    supersededBy: null,
    createdAt: now,
    updatedAt: now,
    accessCount: 0,
  };
}

/** Rank by relevance (text), recency, source trust, usage. */
export function rankMemories(rows: GovernedMemoryRecord[], text?: string): GovernedMemoryRecord[] {
  const now = Date.now();
  const scored = rows.map((r) => {
    let relevance = 0.5;
    if (text && r.content) {
      const t = text.toLowerCase();
      const c = r.content.toLowerCase();
      relevance = c.includes(t) ? 1 : t.split(/\s+/).filter((w) => c.includes(w)).length * 0.2;
    }
    const ageHours = (now - r.updatedAt.getTime()) / 3_600_000;
    const recency = 1 / (1 + ageHours / 24);
    const usage = Math.min(1, r.accessCount / 10);
    const score = relevance * 0.4 + recency * 0.25 + r.sourceTrust * 0.25 + usage * 0.1;
    return { r, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.r);
}
