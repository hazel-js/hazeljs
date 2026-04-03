"use strict";
/**
 * Redis memory store adapter.
 * Pass a Redis client (e.g. from "ioredis") so this package has no direct redis dependency.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisStore = void 0;
const category_types_1 = require("../../types/category.types");
const DEFAULT_PREFIX = 'memory';
function itemKey(prefix, id) {
    return `${prefix}:item:${id}`;
}
function userSetKey(prefix, userId) {
    return `${prefix}:user:${userId}:ids`;
}
function userCategorySetKey(prefix, userId, category) {
    return `${prefix}:user:${userId}:${category}:ids`;
}
class RedisStore {
    constructor(options) {
        this.client = options.client;
        this.prefix = options.keyPrefix ?? DEFAULT_PREFIX;
        this.defaultTtlSeconds = options.defaultTtlSeconds ?? 30 * 60; // 30 min
    }
    async initialize() {
        // No schema needed for Redis
    }
    serialize(item) {
        return JSON.stringify({
            ...item,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
            expiresAt: item.expiresAt?.toISOString(),
        });
    }
    static deserialize(raw) {
        const o = JSON.parse(raw);
        return {
            ...o,
            createdAt: new Date(o.createdAt),
            updatedAt: new Date(o.updatedAt),
            expiresAt: o.expiresAt ? new Date(o.expiresAt) : undefined,
        };
    }
    async save(item) {
        const key = itemKey(this.prefix, item.id);
        const value = this.serialize(item);
        const ttl = item.expiresAt != null
            ? Math.max(0, Math.ceil((item.expiresAt.getTime() - Date.now()) / 1000))
            : item.category === category_types_1.MemoryCategory.EMOTIONAL
                ? this.defaultTtlSeconds
                : 0;
        if (ttl > 0) {
            await this.client.set(key, value, 'EX', String(ttl));
        }
        else {
            await this.client.set(key, value);
        }
        await this.client.sadd(userSetKey(this.prefix, item.userId), item.id);
        await this.client.sadd(userCategorySetKey(this.prefix, item.userId, item.category), item.id);
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
        const key = itemKey(this.prefix, id);
        const raw = await this.client.get(key);
        if (!raw)
            return null;
        const item = RedisStore.deserialize(raw);
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
        const updated = {
            ...existing,
            ...updates,
            id: existing.id,
            userId: existing.userId,
            category: existing.category,
            key: existing.key,
            updatedAt: new Date(),
        };
        await this.save(updated);
    }
    async delete(id) {
        const item = await this.get(id);
        const key = itemKey(this.prefix, id);
        await this.client.del(key);
        if (item) {
            await this.client.srem(userSetKey(this.prefix, item.userId), id);
            await this.client.srem(userCategorySetKey(this.prefix, item.userId, item.category), id);
        }
    }
    async deleteBatch(ids) {
        for (const id of ids) {
            await this.delete(id);
        }
    }
    async query(options) {
        const categories = options.category != null
            ? Array.isArray(options.category)
                ? options.category
                : [options.category]
            : Object.values(category_types_1.MemoryCategory);
        let ids = [];
        for (const cat of categories) {
            const setKey = userCategorySetKey(this.prefix, options.userId, cat);
            const memberIds = await this.client.smembers(setKey);
            ids = ids.concat(memberIds);
        }
        ids = [...new Set(ids)];
        if (ids.length === 0)
            return [];
        const keys = ids.map((id) => itemKey(this.prefix, id));
        const raws = await this.client.mget(...keys);
        const items = [];
        const now = Date.now();
        for (let i = 0; i < raws.length; i++) {
            const raw = raws[i];
            if (!raw)
                continue;
            const item = RedisStore.deserialize(raw);
            if (item.expiresAt && item.expiresAt.getTime() < now) {
                await this.delete(item.id);
                continue;
            }
            if (options.source != null) {
                const srcs = Array.isArray(options.source) ? options.source : [options.source];
                if (!srcs.includes(item.source))
                    continue;
            }
            if (options.minConfidence != null && item.confidence < options.minConfidence)
                continue;
            if (options.notExpired !== false && item.expiresAt && item.expiresAt.getTime() < now)
                continue;
            items.push(item);
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
        if (typeof query !== 'string')
            return [];
        const q = query.toLowerCase();
        const items = await this.query({
            userId: options.userId,
            category: options.category,
            limit: options.topK ?? 10,
        });
        const filtered = items.filter((m) => (typeof m.value === 'string' && m.value.toLowerCase().includes(q)) ||
            m.key.toLowerCase().includes(q));
        return filtered.slice(0, options.topK ?? 10);
    }
    async getStats(userId) {
        const byCategory = Object.values(category_types_1.MemoryCategory).reduce((acc, cat) => ({ ...acc, [cat]: 0 }), {});
        const iterateUserIds = userId
            ? [userId]
            : (await this.client.keys(`${this.prefix}:user:*:ids`))
                .map((k) => {
                const m = k.match(new RegExp(`^${this.prefix}:user:(.+):ids$`));
                return m ? m[1] : '';
            })
                .filter(Boolean);
        const now = Date.now();
        for (const uid of iterateUserIds) {
            const ids = await this.client.smembers(userSetKey(this.prefix, uid));
            const keys = ids.map((id) => itemKey(this.prefix, id));
            if (keys.length === 0)
                continue;
            const raws = await this.client.mget(...keys);
            for (const raw of raws) {
                if (!raw)
                    continue;
                const item = RedisStore.deserialize(raw);
                if (item.expiresAt && item.expiresAt.getTime() < now)
                    continue;
                byCategory[item.category]++;
            }
        }
        let oldest = null;
        let newest = null;
        for (const uid of iterateUserIds) {
            const ids = await this.client.smembers(userSetKey(this.prefix, uid));
            const keys = ids.map((id) => itemKey(this.prefix, id));
            if (keys.length === 0)
                continue;
            const raws = await this.client.mget(...keys);
            for (const raw of raws) {
                if (!raw)
                    continue;
                const item = RedisStore.deserialize(raw);
                if (item.expiresAt && item.expiresAt.getTime() < now)
                    continue;
                const t = item.updatedAt.getTime();
                if (oldest == null || t < oldest)
                    oldest = t;
                if (newest == null || t > newest)
                    newest = t;
            }
        }
        const total = Object.values(byCategory).reduce((a, b) => a + b, 0);
        return {
            total,
            byCategory,
            oldestMemory: oldest != null ? new Date(oldest) : null,
            newestMemory: newest != null ? new Date(newest) : null,
        };
    }
    async prune(options) {
        const now = Date.now();
        const userIds = options?.userId
            ? [options.userId]
            : (await this.client.keys(`${this.prefix}:user:*:ids`))
                .map((k) => {
                const m = k.match(new RegExp(`^${this.prefix}:user:(.+):ids$`));
                return m ? m[1] : '';
            })
                .filter(Boolean);
        let removed = 0;
        for (const uid of userIds) {
            const ids = await this.client.smembers(userSetKey(this.prefix, uid));
            for (const id of ids) {
                const item = await this.get(id);
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
exports.RedisStore = RedisStore;
