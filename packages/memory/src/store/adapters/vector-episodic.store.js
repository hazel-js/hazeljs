"use strict";
/**
 * Vector-backed episodic (and optional semantic_summary) memory store.
 * Stores MemoryItems in memory and optionally in a vector index for similarity search.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorEpisodicStore = void 0;
const crypto_1 = require("crypto");
const category_types_1 = require("../../types/category.types");
const DEFAULT_CATEGORIES = [
    category_types_1.MemoryCategory.EPISODIC,
    category_types_1.MemoryCategory.SEMANTIC_SUMMARY,
];
/**
 * Store for episodic/semantic_summary only. Items are kept in memory; optional vector store for search.
 */
class VectorEpisodicStore {
    constructor(options = {}) {
        this.items = new Map();
        this.byUser = new Map();
        this.byUserCategory = new Map();
        this.categories = new Set(options.categories ?? DEFAULT_CATEGORIES);
        this.vectorStore = options.vectorStore;
    }
    assertCategory(category) {
        if (!this.categories.has(category)) {
            throw new Error(`VectorEpisodicStore only accepts categories: ${[...this.categories].join(', ')}`);
        }
    }
    index(userId, category, id) {
        if (!this.byUser.has(userId))
            this.byUser.set(userId, []);
        this.byUser.get(userId).push(id);
        const uck = `${userId}:${category}`;
        if (!this.byUserCategory.has(uck))
            this.byUserCategory.set(uck, []);
        this.byUserCategory.get(uck).push(id);
    }
    unindex(userId, category, id) {
        const list = this.byUser.get(userId);
        if (list) {
            const i = list.indexOf(id);
            if (i !== -1)
                list.splice(i, 1);
            if (list.length === 0)
                this.byUser.delete(userId);
        }
        const uck = `${userId}:${category}`;
        const catList = this.byUserCategory.get(uck);
        if (catList) {
            const i = catList.indexOf(id);
            if (i !== -1)
                catList.splice(i, 1);
            if (catList.length === 0)
                this.byUserCategory.delete(uck);
        }
    }
    async initialize() {
        // No-op
    }
    async save(item) {
        this.assertCategory(item.category);
        const id = item.id || (0, crypto_1.randomUUID)();
        const now = new Date();
        const full = {
            ...item,
            id,
            createdAt: item.createdAt ?? now,
            updatedAt: item.updatedAt ?? now,
            accessCount: item.accessCount ?? 0,
        };
        const existing = this.items.get(id);
        if (existing) {
            this.unindex(existing.userId, existing.category, id);
            if (this.vectorStore)
                await this.vectorStore.delete(id);
        }
        this.items.set(id, full);
        this.index(full.userId, full.category, id);
        if (this.vectorStore && Array.isArray(full.value) && full.value.length > 0) {
            await this.vectorStore.add(id, full.value, {
                userId: full.userId,
                category: full.category,
            });
        }
        return id;
    }
    async saveBatch(items) {
        const ids = [];
        for (const item of items) {
            ids.push(await this.save(item));
        }
        return ids;
    }
    async get(id) {
        return this.items.get(id) ?? null;
    }
    async update(id, updates) {
        const existing = this.items.get(id);
        if (!existing)
            return;
        this.assertCategory(existing.category);
        const updated = {
            ...existing,
            ...updates,
            id: existing.id,
            userId: existing.userId,
            category: existing.category,
            key: existing.key,
            updatedAt: new Date(),
        };
        this.items.set(id, updated);
        if (this.vectorStore && Array.isArray(updated.value) && updated.value.length > 0) {
            await this.vectorStore.delete(id);
            await this.vectorStore.add(id, updated.value, {
                userId: updated.userId,
                category: updated.category,
            });
        }
    }
    async delete(id) {
        const item = this.items.get(id);
        if (item) {
            this.unindex(item.userId, item.category, id);
            if (this.vectorStore)
                await this.vectorStore.delete(id);
        }
        this.items.delete(id);
    }
    async deleteBatch(ids) {
        for (const id of ids)
            await this.delete(id);
    }
    async query(options) {
        const categories = options.category != null
            ? Array.isArray(options.category)
                ? options.category
                : [options.category]
            : [...this.categories];
        const allowed = categories.filter((c) => this.categories.has(c));
        if (allowed.length === 0)
            return [];
        let ids = [];
        for (const cat of allowed) {
            const uck = `${options.userId}:${cat}`;
            const list = this.byUserCategory.get(uck);
            if (list)
                ids = ids.concat(list);
        }
        ids = [...new Set(ids)];
        let items = ids.map((id) => this.items.get(id)).filter((m) => m != null);
        if (options.source != null) {
            const srcs = Array.isArray(options.source) ? options.source : [options.source];
            items = items.filter((m) => srcs.includes(m.source));
        }
        if (options.minConfidence != null) {
            items = items.filter((m) => m.confidence >= options.minConfidence);
        }
        if (options.notExpired !== false) {
            const now = Date.now();
            items = items.filter((m) => !m.expiresAt || m.expiresAt.getTime() >= now);
        }
        const orderBy = options.orderBy ?? 'updatedAt';
        const order = options.order ?? 'desc';
        items.sort((a, b) => {
            const ta = a[orderBy].getTime();
            const tb = b[orderBy].getTime();
            return order === 'asc' ? ta - tb : tb - ta;
        });
        const offset = options.offset ?? 0;
        const limit = options.limit ?? 100;
        return items.slice(offset, offset + limit);
    }
    async search(query, options) {
        if (!this.vectorStore || !Array.isArray(query) || query.length === 0) {
            if (typeof query === 'string') {
                const items = await this.query({
                    userId: options.userId,
                    category: options.category,
                    limit: options.topK ?? 10,
                });
                const q = query.toLowerCase();
                return items
                    .filter((m) => (typeof m.value === 'string' && m.value.toLowerCase().includes(q)) ||
                    m.key.toLowerCase().includes(q))
                    .slice(0, options.topK ?? 10);
            }
            return [];
        }
        const results = await this.vectorStore.search(query, {
            topK: options.topK ?? 10,
            filter: {
                userId: options.userId,
                category: Array.isArray(options.category) ? options.category[0] : options.category,
            },
        });
        const items = [];
        for (const { id } of results) {
            const item = this.items.get(id);
            if (item)
                items.push(item);
        }
        return items;
    }
    async getStats(userId) {
        const byCategory = Object.values(category_types_1.MemoryCategory).reduce((acc, cat) => ({ ...acc, [cat]: 0 }), {});
        const iterate = userId ? (this.byUser.get(userId) ?? []) : Array.from(this.items.keys());
        let oldest = null;
        let newest = null;
        for (const id of iterate) {
            const item = this.items.get(id);
            if (!item)
                continue;
            byCategory[item.category]++;
            const t = item.updatedAt.getTime();
            if (oldest == null || t < oldest)
                oldest = t;
            if (newest == null || t > newest)
                newest = t;
        }
        return {
            total: Object.values(byCategory).reduce((a, b) => a + b, 0),
            byCategory,
            oldestMemory: oldest != null ? new Date(oldest) : null,
            newestMemory: newest != null ? new Date(newest) : null,
        };
    }
    async prune(options) {
        const now = Date.now();
        const userIds = options?.userId ? [options.userId] : Array.from(this.byUser.keys());
        let removed = 0;
        for (const uid of userIds) {
            const ids = this.byUser.get(uid) ?? [];
            for (const id of ids) {
                const item = this.items.get(id);
                if (!item)
                    continue;
                if (options?.category && item.category !== options.category)
                    continue;
                const isExpired = item.expiresAt != null && item.expiresAt.getTime() < now;
                const isTooOld = options?.olderThan != null && item.updatedAt < options.olderThan;
                const isLowConfidence = options?.minConfidence != null && item.confidence < options.minConfidence;
                if (isExpired || isTooOld || isLowConfidence) {
                    await this.delete(id);
                    removed++;
                }
            }
        }
        return removed;
    }
}
exports.VectorEpisodicStore = VectorEpisodicStore;
