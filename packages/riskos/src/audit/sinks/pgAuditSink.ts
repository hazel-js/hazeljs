/**
 * PostgreSQL audit sink - production persistence with hash chain continuity
 */

import type { Pool } from 'pg';
import type { AuditSink } from '../sink';
import type { ComplianceTrace } from '../trace';
import type { EvidencePack } from '../evidence/pack';
import { nowISO } from '../../utils/time';

export interface PgAuditSinkOptions {
  /** pg Pool instance */
  pool: Pool;
  /** Table name (default: riskos_audit_traces) */
  tableName?: string;
}

const DEFAULT_TABLE = 'riskos_audit_traces';
const GENESIS_HASH = 'genesis';

/** Production audit sink with hash chain continuity across instances */
export class PgAuditSink implements AuditSink {
  private table: string;

  constructor(private options: PgAuditSinkOptions) {
    this.table = options.tableName ?? DEFAULT_TABLE;
  }

  async write(traceEvent: ComplianceTrace): Promise<void> {
    const prevHash = await this.getLastHash();
    const { computeTraceHash } = await import('../integrity/hashChain');
    const hash = computeTraceHash(traceEvent, prevHash);

    await this.options.pool.query(
      `INSERT INTO ${this.table} (
        request_id, ts_start, ts_end, tenant_id, actor, purpose, action_name,
        policy_results, data_access_events, ai_call_events, decision_events,
        error, integrity_hash, prev_hash, versions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        traceEvent.requestId,
        traceEvent.tsStart,
        traceEvent.tsEnd,
        traceEvent.tenantId ?? null,
        traceEvent.actor ? JSON.stringify(traceEvent.actor) : null,
        traceEvent.purpose ?? null,
        traceEvent.actionName,
        traceEvent.policyResults ? JSON.stringify(traceEvent.policyResults) : null,
        traceEvent.dataAccessEvents ? JSON.stringify(traceEvent.dataAccessEvents) : null,
        traceEvent.aiCallEvents ? JSON.stringify(traceEvent.aiCallEvents) : null,
        traceEvent.decisionEvents ? JSON.stringify(traceEvent.decisionEvents) : null,
        traceEvent.error ?? null,
        hash,
        prevHash,
        traceEvent.versions ? JSON.stringify(traceEvent.versions) : null,
      ],
    );
  }

  async buildEvidencePack(criteria: {
    requestId?: string;
    timeRange?: { start: string; end: string };
    tenantId?: string;
  }): Promise<EvidencePack> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (criteria.requestId) {
      conditions.push(`request_id = $${i++}`);
      params.push(criteria.requestId);
    }
    if (criteria.tenantId) {
      conditions.push(`tenant_id = $${i++}`);
      params.push(criteria.tenantId);
    }
    if (criteria.timeRange) {
      conditions.push(`ts_start >= $${i}`);
      params.push(criteria.timeRange.start);
      i++;
      conditions.push(`ts_end <= $${i}`);
      params.push(criteria.timeRange.end);
      i++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const res = await this.options.pool.query(
      `SELECT * FROM ${this.table} ${where} ORDER BY id ASC`,
      params,
    );

    const traces = res.rows.map(this.rowToTrace.bind(this));
    const id = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    return {
      id,
      createdAt: nowISO(),
      manifest: {
        requestIds: criteria.requestId ? [criteria.requestId] : undefined,
        timeRange: criteria.timeRange,
        tenantId: criteria.tenantId,
        traceCount: traces.length,
      },
      traces,
    };
  }

  private async getLastHash(): Promise<string> {
    const res = await this.options.pool.query(
      `SELECT integrity_hash FROM ${this.table} ORDER BY id DESC LIMIT 1`,
    );
    return res.rows[0]?.integrity_hash ?? GENESIS_HASH;
  }

  private rowToTrace(row: Record<string, unknown>): ComplianceTrace {
    return {
      requestId: row.request_id as string,
      tsStart: row.ts_start as string,
      tsEnd: row.ts_end as string,
      tenantId: (row.tenant_id as string) ?? undefined,
      actor: row.actor as ComplianceTrace['actor'],
      purpose: (row.purpose as string) ?? undefined,
      actionName: row.action_name as string,
      policyResults: row.policy_results as ComplianceTrace['policyResults'],
      dataAccessEvents: row.data_access_events as ComplianceTrace['dataAccessEvents'],
      aiCallEvents: row.ai_call_events as ComplianceTrace['aiCallEvents'],
      decisionEvents: row.decision_events as ComplianceTrace['decisionEvents'],
      error: (row.error as string) ?? undefined,
      integrity: {
        hash: row.integrity_hash as string,
        prevHash: row.prev_hash as string,
      },
      versions: row.versions as ComplianceTrace['versions'],
    };
  }
}
