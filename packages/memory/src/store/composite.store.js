"use strict";
/**
 * Composite memory store — routes by category to primary and optional episodic (vector) store.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompositeMemoryStore = void 0;
const category_types_1 = require("../types/category.types");
const DEFAULT_EPISODIC_CATEGORIES = [
    category_types_1.MemoryCategory.EPISODIC,
    category_types_1.MemoryCategory.SEMANTIC_SUMMARY,
];
/**
 * Routes saves/queries by category to primary or episodic store.
 */
class CompositeMemoryStore {
    constructor(options) {
        this.primary = options.primary;
        this.episodic = options.episodic;
        this.episodicCategories = new Set(options.episodicCategories ?? DEFAULT_EPISODIC_CATEGORIES);
    }
    route(category) {
        if (this.episodic && this.episodicCategories.has(category)) {
            return this.episodic;
        }
        return this.primary;
    }
    async initialize() {
        await this.primary.initialize();
        if (this.episodic)
            await this.episodic.initialize();
    }
    async save(item) {
        return this.route(item.category).save(item);
    }
    async saveBatch(items) {
        const ids = [];
        for (const item of items) {
            ids.push(await this.route(item.category).save(item));
        }
        return ids;
    }
    async get(id) {
        const fromPrimary = await this.primary.get(id);
        if (fromPrimary)
            return fromPrimary;
        if (this.episodic)
            return this.episodic.get(id);
        return null;
    }
    async update(id, updates) {
        const fromPrimary = await this.primary.get(id);
        if (fromPrimary) {
            await this.primary.update(id, updates);
            return;
        }
        if (this.episodic)
            await this.episodic.update(id, updates);
    }
    async delete(id) {
        await this.primary.delete(id);
        if (this.episodic)
            await this.episodic.delete(id);
    }
    async deleteBatch(ids) {
        await this.primary.deleteBatch(ids);
        if (this.episodic)
            await this.episodic.deleteBatch(ids);
    }
    async query(options) {
        const categories = options.category != null
            ? Array.isArray(options.category)
                ? options.category
                : [options.category]
            : Object.values(category_types_1.MemoryCategory);
        const primaryCats = categories.filter((c) => !this.episodicCategories.has(c));
        const episodicCats = categories.filter((c) => this.episodicCategories.has(c));
        const results = [];
        if (primaryCats.length > 0) {
            const primaryResults = await this.primary.query({
                ...options,
                category: primaryCats.length === 1 ? primaryCats[0] : primaryCats,
            });
            results.push(...primaryResults);
        }
        if (this.episodic && episodicCats.length > 0) {
            const episodicResults = await this.episodic.query({
                ...options,
                category: episodicCats.length === 1 ? episodicCats[0] : episodicCats,
            });
            results.push(...episodicResults);
        }
        const orderBy = options.orderBy ?? 'updatedAt';
        const order = options.order ?? 'desc';
        results.sort((a, b) => {
            const ta = a[orderBy].getTime();
            const tb = b[orderBy].getTime();
            return order === 'asc' ? ta - tb : tb - ta;
        });
        const offset = options.offset ?? 0;
        const limit = options.limit ?? 100;
        return results.slice(offset, offset + limit);
    }
    async search(query, options) {
        if (this.episodic && typeof this.episodic.search === 'function') {
            return this.episodic.search(query, options);
        }
        if (typeof this.primary.search === 'function') {
            return this.primary.search(query, options);
        }
        return [];
    }
    async getStats(userId) {
        const primaryStats = await this.primary.getStats(userId);
        if (!this.episodic)
            return primaryStats;
        const episodicStats = await this.episodic.getStats(userId);
        const byCategory = { ...primaryStats.byCategory };
        for (const cat of this.episodicCategories) {
            byCategory[cat] = (byCategory[cat] ?? 0) + (episodicStats.byCategory[cat] ?? 0);
        }
        const total = Object.values(byCategory).reduce((a, b) => a + b, 0);
        const oldest = primaryStats.oldestMemory && episodicStats.oldestMemory
            ? new Date(Math.min(primaryStats.oldestMemory.getTime(), episodicStats.oldestMemory.getTime()))
            : (primaryStats.oldestMemory ?? episodicStats.oldestMemory);
        const newest = primaryStats.newestMemory && episodicStats.newestMemory
            ? new Date(Math.max(primaryStats.newestMemory.getTime(), episodicStats.newestMemory.getTime()))
            : (primaryStats.newestMemory ?? episodicStats.newestMemory);
        return {
            total,
            byCategory,
            oldestMemory: oldest,
            newestMemory: newest,
        };
    }
    async prune(options) {
        const primaryRemoved = await this.primary.prune(options);
        let episodicRemoved = 0;
        if (this.episodic) {
            const episodicOptions = options?.category
                ? this.episodicCategories.has(options.category)
                    ? options
                    : undefined
                : options;
            if (episodicOptions)
                episodicRemoved = await this.episodic.prune(episodicOptions);
        }
        return primaryRemoved + episodicRemoved;
    }
}
exports.CompositeMemoryStore = CompositeMemoryStore;
