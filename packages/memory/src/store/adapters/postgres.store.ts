/**
 * PostgreSQL memory store adapter.
 * Pass a pool (e.g. from "pg") so this package has no direct pg dependency.
 */

import { MemoryCategory } from '../../types/category.types';
import { MemoryItem, MemorySource } from '../../types/memory-item.types';
import {
  MemoryQuery,
  MemorySearchOptions,
  MemoryStats,
  PruneOptions,
} from '../../types/store.types';
import { MemoryStore } from '../memory-store.interface';

export interface PostgresStoreOptions {
  /** A pool-like client with query(sql, params?) returning rows and optional rowCount. */
  pool: {
    query: (
      sql: string,
      params?: unknown[]
    ) => Promise<{ rows: unknown[]; rowCount?: number }>;
  };
  /** Table name. Default: memory_items. */
  tableName?: string;
}

const DEFAULT_TABLE = 'memory_items';

function parseValue(raw: string): MemoryItem['value'] {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'string') return parsed;
    if (Array.isArray(parsed)) return parsed;
    return parsed as Record<string, unknown>;
  } catch {
    return raw;
  }
}

function rowToItem(row: Record<string, unknown>): MemoryItem {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    category: row.category as MemoryCategory,
    key: row.key as string,
    value: parseValue((row.value as string) ?? 'null'),
    confidence: Number(row.confidence),
    source: row.source as MemorySource,
    evidence: Array.isArray(row.evidence) ? (row.evidence as string[]) : JSON.parse((row.evidence as string) || '[]'),
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
    expiresAt: row.expires_at ? new Date(row.expires_at as string) : undefined,
    accessCount: Number(row.access_count ?? 0),
    sessionId: row.session_id as string | undefined,
  };
}

/**
 * PostgreSQL-backed memory store. Create table with:
 * CREATE TABLE memory_items (
 *   id TEXT PRIMARY KEY,
 *   user_id TEXT NOT NULL,
 *   category TEXT NOT NULL,
 *   key TEXT NOT NULL,
 *   value TEXT NOT NULL,
 *   confidence REAL NOT NULL,
 *   source TEXT NOT NULL,
 *   evidence TEXT NOT NULL,
 *   created_at TIMESTAMPTZ NOT NULL,
 *   updated_at TIMESTAMPTZ NOT NULL,
 *   expires_at TIMESTAMPTZ,
 *   access_count INTEGER NOT NULL DEFAULT 0,
 *   session_id TEXT
 * );
 * CREATE INDEX idx_memory_items_user_category ON memory_items(user_id, category);
 * CREATE INDEX idx_memory_items_expires ON memory_items(expires_at) WHERE expires_at IS NOT NULL;
 */
export class PostgresStore implements MemoryStore {
  private readonly pool: PostgresStoreOptions['pool'];
  private readonly table: string;
  private initialized = false;

  constructor(options: PostgresStoreOptions) {
    this.pool = options.pool;
    this.table = options.tableName ?? DEFAULT_TABLE;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.table} (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        category TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        confidence REAL NOT NULL,
        source TEXT NOT NULL,
        evidence TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        expires_at TIMESTAMPTZ,
        access_count INTEGER NOT NULL DEFAULT 0,
        session_id TEXT
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_${this.table}_user_category
      ON ${this.table}(user_id, category)
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_${this.table}_expires
      ON ${this.table}(expires_at) WHERE expires_at IS NOT NULL
    `);
    this.initialized = true;
  }

  async save(item: MemoryItem): Promise<string> {
    const valueStr = typeof item.value === 'object' && item.value !== null
      ? JSON.stringify(item.value)
      : String(item.value);
    const evidenceStr = JSON.stringify(item.evidence ?? []);
    await this.pool.query(
      `INSERT INTO ${this.table} (id, user_id, category, key, value, confidence, source, evidence, created_at, updated_at, expires_at, access_count, session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET
         value = EXCLUDED.value, confidence = EXCLUDED.confidence, evidence = EXCLUDED.evidence,
         updated_at = EXCLUDED.updated_at, expires_at = EXCLUDED.expires_at, access_count = EXCLUDED.access_count`,
      [
        item.id,
        item.userId,
        item.category,
        item.key,
        valueStr,
        item.confidence,
        item.source,
        evidenceStr,
        item.createdAt,
        item.updatedAt,
        item.expiresAt ?? null,
        item.accessCount ?? 0,
        item.sessionId ?? null,
      ]
    );
    return item.id;
  }

  async saveBatch(items: MemoryItem[]): Promise<string[]> {
    const ids: string[] = [];
    for (const item of items) {
      ids.push(await this.save(item));
    }
    return ids;
  }

  async get(id: string): Promise<MemoryItem | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${this.table} WHERE id = $1`,
      [id]
    );
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    const item = rowToItem(row);
    if (item.expiresAt && item.expiresAt.getTime() < Date.now()) {
      await this.delete(id);
      return null;
    }
    return item;
  }

  async update(id: string, updates: Partial<MemoryItem>): Promise<void> {
    const existing = await this.get(id);
    if (!existing) return;

    const valueStr = updates.value !== undefined
      ? (typeof updates.value === 'object' && updates.value !== null ? JSON.stringify(updates.value) : String(updates.value))
      : (typeof existing.value === 'object' ? JSON.stringify(existing.value) : String(existing.value));
    const evidenceStr = updates.evidence !== undefined ? JSON.stringify(updates.evidence) : JSON.stringify(existing.evidence);

    await this.pool.query(
      `UPDATE ${this.table} SET
        value = $2, confidence = COALESCE($3, confidence), source = COALESCE($4, source),
        evidence = $5, updated_at = $6, expires_at = COALESCE($7, expires_at), access_count = COALESCE($8, access_count)
       WHERE id = $1`,
      [
        id,
        valueStr,
        updates.confidence ?? existing.confidence,
        updates.source ?? existing.source,
        evidenceStr,
        new Date(),
        updates.expiresAt !== undefined ? updates.expiresAt : existing.expiresAt,
        updates.accessCount ?? existing.accessCount,
      ]
    );
  }

  async delete(id: string): Promise<void> {
    await this.pool.query(`DELETE FROM ${this.table} WHERE id = $1`, [id]);
  }

  async deleteBatch(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    await this.pool.query(`DELETE FROM ${this.table} WHERE id IN (${placeholders})`, ids);
  }

  async query(options: MemoryQuery): Promise<MemoryItem[]> {
    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [options.userId];
    let paramIndex = 2;

    if (options.category != null) {
      const cats = Array.isArray(options.category) ? options.category : [options.category];
      conditions.push(`category = ANY($${paramIndex})`);
      params.push(cats);
      paramIndex++;
    }
    if (options.source != null) {
      const srcs = Array.isArray(options.source) ? options.source : [options.source];
      conditions.push(`source = ANY($${paramIndex})`);
      params.push(srcs);
      paramIndex++;
    }
    if (options.minConfidence != null) {
      conditions.push(`confidence >= $${paramIndex}`);
      params.push(options.minConfidence);
      paramIndex++;
    }
    if (options.notExpired !== false) {
      conditions.push(`(expires_at IS NULL OR expires_at > NOW())`);
    }

    const orderByCol = options.orderBy === 'createdAt' ? 'created_at' : 'updated_at';
    const order = options.order ?? 'desc';
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;

    const { rows } = await this.pool.query(
      `SELECT * FROM ${this.table} WHERE ${conditions.join(' AND ')} ORDER BY ${orderByCol} ${order} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return (rows as Record<string, unknown>[]).map(rowToItem);
  }

  async getStats(userId?: string): Promise<MemoryStats> {
    const byCategory = Object.values(MemoryCategory).reduce(
      (acc, cat) => ({ ...acc, [cat]: 0 }),
      {} as Record<MemoryCategory, number>
    );

    const where = userId ? 'WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())' : 'WHERE expires_at IS NULL OR expires_at > NOW()';
    const params = userId ? [userId] : [];

    const { rows } = await this.pool.query(
      `SELECT category, COUNT(*) as cnt FROM ${this.table} ${where} GROUP BY category`,
      params
    );
    for (const row of rows as { category: string; cnt: string }[]) {
      if (row.category in byCategory) byCategory[row.category as MemoryCategory] = parseInt(row.cnt, 10);
    }

    const { rows: agg } = await this.pool.query(
      `SELECT MIN(updated_at) as oldest, MAX(updated_at) as newest FROM ${this.table} ${where}`,
      params
    );
    const a = (agg[0] as { oldest: string | null; newest: string | null }) ?? {};
    const total = Object.values(byCategory).reduce((s, n) => s + n, 0);

    return {
      total,
      byCategory,
      oldestMemory: a.oldest ? new Date(a.oldest) : null,
      newestMemory: a.newest ? new Date(a.newest) : null,
    };
  }

  async prune(options?: PruneOptions): Promise<number> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options?.userId) {
      conditions.push(`user_id = $${paramIndex}`);
      params.push(options.userId);
      paramIndex++;
    }
    if (options?.category) {
      conditions.push(`category = $${paramIndex}`);
      params.push(options.category);
      paramIndex++;
    }
    if (options?.olderThan) {
      conditions.push(`updated_at < $${paramIndex}`);
      params.push(options.olderThan);
      paramIndex++;
    }
    if (options?.minConfidence != null) {
      conditions.push(`confidence < $${paramIndex}`);
      params.push(options.minConfidence);
      paramIndex++;
    }
    conditions.push('(expires_at IS NOT NULL AND expires_at < NOW())');

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const result = await this.pool.query(
      `DELETE FROM ${this.table} ${where}`,
      params
    );
    return typeof result.rowCount === 'number' ? result.rowCount : 0;
  }
}
