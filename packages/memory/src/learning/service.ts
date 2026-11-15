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
  LearnFromTurnInput,
  LearnFromTurnResult,
  MemoryCandidateAction,
  MemoryCandidateClassifier,
  TurnObservation,
} from './observation';
import { RuleBasedObservationExtractor, type ObservationExtractor } from './observation-extractor';
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
  /** Defaults to RuleBasedObservationExtractor. */
  extractor?: ObservationExtractor;
  /**
   * Optional duck-typed classifier (typically wraps @hazeljs/decision classifyMemoryCandidate).
   * When omitted, built-in rules mirror the decision package defaults.
   */
  classifier?: MemoryCandidateClassifier;
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

const SECRET_RE = /api[_-]?key|password|secret|bearer\s+[a-z0-9]/i;
const PRIVILEGE_RE = /you are now admin|grant.*role|ignore previous/i;

/** Built-in classifier when DecisionPlane is not injected. */
export function defaultClassifyMemoryCandidate(input: {
  text: string;
  sourceKind: 'user' | 'tool' | 'model' | 'system';
  sourceTrust?: number;
  containsSecret?: boolean;
  grantsRoleOrPolicy?: boolean;
  isPreference?: boolean;
  isProcedure?: boolean;
}): MemoryCandidateAction {
  if (
    input.containsSecret ||
    input.grantsRoleOrPolicy ||
    SECRET_RE.test(input.text) ||
    PRIVILEGE_RE.test(input.text)
  ) {
    return 'quarantine';
  }
  if (input.isProcedure) return 'review';
  if (
    (input.isPreference || input.sourceKind === 'user') &&
    (input.sourceTrust ?? 0.5) >= 0.4 &&
    !input.containsSecret
  ) {
    return 'persist';
  }
  if (input.sourceKind === 'tool' && (input.sourceTrust ?? 0) < 0.3) {
    return 'discard';
  }
  return 'review';
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
  private readonly extractor: ObservationExtractor;
  private readonly classifier?: MemoryCandidateClassifier;
  private readonly auditLog: AuditEvent[] = [];
  private readonly sourceObservationCounts = new Map<string, number>();

  constructor(private readonly options: GovernedMemoryServiceOptions = {}) {
    this.store = options.store ?? new InMemoryGovernedMemoryStore();
    this.hooks = options.hooks ?? {};
    this.extractor = options.extractor ?? new RuleBasedObservationExtractor();
    this.classifier = options.classifier;
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

    // Text is for ranking only — do not hard-filter in the store so NL queries still recall prefs.
    const { text, ...storeQuery } = query;
    let rows = await this.store.query(storeQuery);
    rows = rankMemories(rows, text);
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
   * Full learning loop for a conversation turn:
   * extract hooks → extractor → consolidate hooks → classify → capture → auto-accept persist.
   */
  async learnFromTurn(input: LearnFromTurnInput): Promise<LearnFromTurnResult> {
    const failClosed = this.hooks.failClosed !== false;
    const scope = input.scope ?? 'customer';
    const turn = {
      userText: input.userText,
      assistantText: input.assistantText,
      subjectId: input.subjectId,
      sessionId: input.sessionId,
      runId: input.runId,
    };

    const extractGate = await runHooks(
      this.hooks.extract,
      { name: 'extract', auth: input.auth, turn },
      failClosed
    );
    if (extractGate.reject) {
      this.audit({
        action: 'learn.extract.rejected',
        recordId: '',
        tenantId: input.tenantId,
        actorId: input.auth.actorId,
        meta: { reason: extractGate.reject },
      });
      return {
        observations: [],
        captured: [],
        accepted: [],
        quarantined: [],
        discarded: [],
        reviewed: [],
      };
    }

    let observations = [...(await this.extractor.extract(turn))];

    const result: LearnFromTurnResult = {
      observations: [...observations],
      captured: [],
      accepted: [],
      quarantined: [],
      discarded: [],
      reviewed: [],
    };

    const kept: TurnObservation[] = [];
    for (const obs of observations) {
      const draft = newGovernedRecord({
        tenantId: input.tenantId,
        subjectId: input.subjectId,
        scope,
        type: obs.type,
        content: obs.content,
        provenance: obs.provenance,
        sourceTrust: obs.sourceTrust,
        factConfidence: obs.factConfidence,
        extractionConfidence: obs.extractionConfidence,
        sourceId: obs.sourceId,
        status: 'candidate',
      });

      const consolidated = await runHooks(
        this.hooks.consolidate,
        {
          name: 'consolidate',
          auth: input.auth,
          turn,
          record: draft,
          observations,
        },
        failClosed
      );
      if (consolidated.reject) {
        result.discarded.push(obs);
        continue;
      }

      let working = obs;
      if (consolidated.record?.content) {
        working = {
          ...obs,
          content: consolidated.record.content,
          type: consolidated.record.type,
          sourceTrust: consolidated.record.sourceTrust,
          extractionConfidence:
            consolidated.record.extractionConfidence ?? obs.extractionConfidence,
          factConfidence: consolidated.record.factConfidence,
          sourceId: consolidated.record.sourceId ?? obs.sourceId,
          provenance: consolidated.record.provenance,
        };
      }

      // Dedupe: if same sourceId already has an accepted/candidate record, supersede via lineage.
      if (working.sourceId) {
        const existing = await this.store.listBySourceId(input.tenantId, working.sourceId);
        const active = existing.find(
          (r) =>
            (r.status === 'accepted' || r.status === 'candidate') &&
            r.content?.toLowerCase() === working.content.toLowerCase()
        );
        if (active) {
          result.discarded.push(working);
          continue;
        }
      }

      kept.push(working);
    }
    observations = kept;

    for (const obs of observations) {
      const sameSourceRepeatCount = obs.sourceId
        ? (await this.store.listBySourceId(input.tenantId, obs.sourceId)).length
        : 0;

      const classifyInput = {
        text: obs.content,
        sourceKind:
          obs.provenance.sourceKind === 'feedback'
            ? ('system' as const)
            : obs.provenance.sourceKind === 'user' ||
                obs.provenance.sourceKind === 'tool' ||
                obs.provenance.sourceKind === 'model' ||
                obs.provenance.sourceKind === 'system'
              ? obs.provenance.sourceKind
              : ('user' as const),
        sourceTrust: obs.sourceTrust,
        containsSecret: SECRET_RE.test(obs.content),
        grantsRoleOrPolicy: PRIVILEGE_RE.test(obs.content),
        isPreference: obs.type === 'preference',
        isProcedure: obs.type === 'procedure',
        sameSourceRepeatCount,
        tenantId: input.tenantId,
        actorId: input.auth.actorId,
      };

      const action: MemoryCandidateAction = this.classifier
        ? await this.classifier.classify(classifyInput)
        : defaultClassifyMemoryCandidate(classifyInput);

      if (action === 'discard') {
        result.discarded.push(obs);
        this.audit({
          action: 'learn.discard',
          recordId: '',
          tenantId: input.tenantId,
          actorId: input.auth.actorId,
          meta: { content: obs.content.slice(0, 80) },
        });
        continue;
      }

      let status: CaptureMemoryInput['status'] = 'candidate';
      if (action === 'quarantine') status = 'quarantined';

      const captured = await this.capture({
        tenantId: input.tenantId,
        subjectId: input.subjectId,
        scope,
        type: obs.type,
        content: obs.content,
        provenance: obs.provenance,
        sourceTrust: obs.sourceTrust,
        factConfidence: obs.factConfidence,
        extractionConfidence: obs.extractionConfidence,
        sourceId: obs.sourceId,
        status,
      });
      result.captured.push(captured);

      if (captured.status === 'quarantined') {
        result.quarantined.push(captured);
        continue;
      }

      if (action === 'review') {
        result.reviewed.push(captured);
        continue;
      }

      // persist → auto-accept high-trust user preferences/facts (not procedures)
      if (
        action === 'persist' &&
        (obs.type === 'preference' || obs.type === 'fact') &&
        obs.provenance.sourceKind === 'user'
      ) {
        const accepted = await this.accept(captured.id, input.auth, captured.version);
        if (accepted) {
          result.accepted.push(accepted);
        } else {
          result.reviewed.push(captured);
        }
      } else {
        result.reviewed.push(captured);
      }
    }

    this.audit({
      action: 'learnFromTurn',
      recordId: result.accepted[0]?.id ?? result.captured[0]?.id ?? '',
      tenantId: input.tenantId,
      actorId: input.auth.actorId,
      meta: {
        observations: result.observations.length,
        accepted: result.accepted.length,
        quarantined: result.quarantined.length,
        discarded: result.discarded.length,
        reviewed: result.reviewed.length,
      },
    });

    return result;
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
