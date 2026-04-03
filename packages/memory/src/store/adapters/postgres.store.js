"use strict";
/**
 * PostgreSQL memory store adapter.
 * Pass a pool (e.g. from "pg") so this package has no direct pg dependency.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresStore = void 0;
const category_types_1 = require("../../types/category.types");
const DEFAULT_TABLE = 'memory_items';
function parseValue(raw) {
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string')
            return parsed;
        if (Array.isArray(parsed))
            return parsed;
        return parsed;
    }
    catch {
        return raw;
    }
}
function rowToItem(row) {
    return {
        id: row.id,
        userId: row.user_id,
        category: row.category,
        key: row.key,
        value: parseValue(row.value ?? 'null'),
        confidence: Number(row.confidence),
        source: row.source,
        evidence: Array.isArray(row.evidence)
            ? row.evidence
            : JSON.parse(row.evidence || '[]'),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
        accessCount: Number(row.access_count ?? 0),
        sessionId: row.session_id,
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
class PostgresStore {
    constructor(options) {
        this.initialized = false;
        this.pool = options.pool;
        this.table = options.tableName ?? DEFAULT_TABLE;
    }
    async initialize() {
        if (this.initialized)
            return;
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
    async save(item) {
        const valueStr = typeof item.value === 'object' && item.value !== null
            ? JSON.stringify(item.value)
            : String(item.value);
        const evidenceStr = JSON.stringify(item.evidence ?? []);
        await this.pool.query(`INSERT INTO ${this.table} (id, user_id, category, key, value, confidence, source, evidence, created_at, updated_at, expires_at, access_count, session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET
         value = EXCLUDED.value, confidence = EXCLUDED.confidence, evidence = EXCLUDED.evidence,
         updated_at = EXCLUDED.updated_at, expires_at = EXCLUDED.expires_at, access_count = EXCLUDED.access_count`, [
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
        ]);
        return item.id;
    }
    async saveBatch(items) {
        const ids = [];
        for (const item of items) {
            ids.push(await this.save(item));
        }
        return ids;
    }
    async get(id) {
        const { rows } = await this.pool.query(`SELECT * FROM ${this.table} WHERE id = $1`, [id]);
        const row = rows[0];
        if (!row)
            return null;
        const item = rowToItem(row);
        if (item.expiresAt && item.expiresAt.getTime() < Date.now()) {
            await this.delete(id);
            return null;
        }
        return item;
    }
    async update(id, updates) {
        const existing = await this.get(id);
        if (!existing)
            return;
        const valueStr = updates.value !== undefined
            ? typeof updates.value === 'object' && updates.value !== null
                ? JSON.stringify(updates.value)
                : String(updates.value)
            : typeof existing.value === 'object'
                ? JSON.stringify(existing.value)
                : String(existing.value);
        const evidenceStr = updates.evidence !== undefined
            ? JSON.stringify(updates.evidence)
            : JSON.stringify(existing.evidence);
        await this.pool.query(`UPDATE ${this.table} SET
        value = $2, confidence = COALESCE($3, confidence), source = COALESCE($4, source),
        evidence = $5, updated_at = $6, expires_at = COALESCE($7, expires_at), access_count = COALESCE($8, access_count)
       WHERE id = $1`, [
            id,
            valueStr,
            updates.confidence ?? existing.confidence,
            updates.source ?? existing.source,
            evidenceStr,
            new Date(),
            updates.expiresAt !== undefined ? updates.expiresAt : existing.expiresAt,
            updates.accessCount ?? existing.accessCount,
        ]);
    }
    async delete(id) {
        await this.pool.query(`DELETE FROM ${this.table} WHERE id = $1`, [id]);
    }
    async deleteBatch(ids) {
        if (ids.length === 0)
            return;
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
        await this.pool.query(`DELETE FROM ${this.table} WHERE id IN (${placeholders})`, ids);
    }
    async query(options) {
        const conditions = ['user_id = $1'];
        const params = [options.userId];
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
        const { rows } = await this.pool.query(`SELECT * FROM ${this.table} WHERE ${conditions.join(' AND ')} ORDER BY ${orderByCol} ${order} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`, [...params, limit, offset]);
        return rows.map(rowToItem);
    }
    async getStats(userId) {
        const byCategory = Object.values(category_types_1.MemoryCategory).reduce((acc, cat) => ({ ...acc, [cat]: 0 }), {});
        const where = userId
            ? 'WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())'
            : 'WHERE expires_at IS NULL OR expires_at > NOW()';
        const params = userId ? [userId] : [];
        const { rows } = await this.pool.query(`SELECT category, COUNT(*) as cnt FROM ${this.table} ${where} GROUP BY category`, params);
        for (const row of rows) {
            if (row.category in byCategory)
                byCategory[row.category] = parseInt(row.cnt, 10);
        }
        const { rows: agg } = await this.pool.query(`SELECT MIN(updated_at) as oldest, MAX(updated_at) as newest FROM ${this.table} ${where}`, params);
        const a = agg[0] ?? {};
        const total = Object.values(byCategory).reduce((s, n) => s + n, 0);
        return {
            total,
            byCategory,
            oldestMemory: a.oldest ? new Date(a.oldest) : null,
            newestMemory: a.newest ? new Date(a.newest) : null,
        };
    }
    async prune(options) {
        const conditions = [];
        const params = [];
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
        const result = await this.pool.query(`DELETE FROM ${this.table} ${where}`, params);
        return typeof result.rowCount === 'number' ? result.rowCount : 0;
    }
}
exports.PostgresStore = PostgresStore;
