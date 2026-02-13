/**
 * PostgreSQL KYC store - production persistence
 */

import type { Pool } from 'pg';
import type { KycStore, KycSession } from './store';
import { nowISO } from '../../utils/time';

export interface PgKycStoreOptions {
  /** pg Pool instance */
  pool: Pool;
  /** Table name (default: riskos_kyc_sessions) */
  tableName?: string;
}

const DEFAULT_TABLE = 'riskos_kyc_sessions';

/** Production KYC store backed by PostgreSQL */
export class PgKycStore implements KycStore {
  private table: string;

  constructor(private options: PgKycStoreOptions) {
    this.table = options.tableName ?? DEFAULT_TABLE;
  }

  async create(tenantId?: string): Promise<KycSession> {
    const id = `kyc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const now = nowISO();
    const session: KycSession = {
      id,
      tenantId,
      createdAt: now,
      updatedAt: now,
      answers: {},
      documents: {},
      raw: {},
      normalized: {},
      checks: {},
    };
    await this.options.pool.query(
      `INSERT INTO ${this.table} (id, tenant_id, created_at, updated_at, answers, documents, raw, normalized, checks)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        tenantId ?? null,
        now,
        now,
        JSON.stringify(session.answers),
        JSON.stringify(session.documents),
        JSON.stringify(session.raw),
        JSON.stringify(session.normalized),
        JSON.stringify(session.checks),
      ]
    );
    return session;
  }

  async get(id: string): Promise<KycSession | null> {
    const res = await this.options.pool.query(`SELECT * FROM ${this.table} WHERE id = $1`, [id]);
    const row = res.rows[0];
    if (!row) return null;
    return this.rowToSession(row);
  }

  async update(id: string, updates: Partial<KycSession>): Promise<KycSession | null> {
    const existing = await this.get(id);
    if (!existing) return null;

    const merged: KycSession = {
      ...existing,
      ...updates,
      updatedAt: nowISO(),
    };

    await this.options.pool.query(
      `UPDATE ${this.table} SET
        tenant_id = $2, updated_at = $3, answers = $4, documents = $5,
        raw = $6, normalized = $7, checks = $8, decision = $9
       WHERE id = $1`,
      [
        id,
        merged.tenantId ?? null,
        merged.updatedAt,
        JSON.stringify(merged.answers),
        JSON.stringify(merged.documents),
        JSON.stringify(merged.raw),
        JSON.stringify(merged.normalized),
        JSON.stringify(merged.checks),
        merged.decision ? JSON.stringify(merged.decision) : null,
      ]
    );
    return merged;
  }

  private rowToSession(row: Record<string, unknown>): KycSession {
    return {
      id: row.id as string,
      tenantId: (row.tenant_id as string) ?? undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      answers: (row.answers as Record<string, unknown>) ?? {},
      documents: (row.documents as Record<string, string>) ?? {},
      raw: (row.raw as Record<string, unknown>) ?? {},
      normalized: (row.normalized as Record<string, unknown>) ?? {},
      checks: (row.checks as KycSession['checks']) ?? {},
      decision: row.decision as KycSession['decision'],
    };
  }
}
