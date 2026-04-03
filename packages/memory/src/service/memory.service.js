"use strict";
/**
 * High-level memory API — store-agnostic service.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryService = void 0;
const crypto_1 = require("crypto");
const category_types_1 = require("../types/category.types");
const memory_config_1 = require("../config/memory.config");
class MemoryService {
    constructor(store, config) {
        this.store = store;
        this.config = { ...memory_config_1.DEFAULT_MEMORY_SERVICE_CONFIG, ...config };
    }
    /**
     * Initialize the underlying store.
     */
    async initialize() {
        await this.store.initialize();
    }
    /**
     * Save a memory item (generates id and timestamps if omitted).
     */
    async save(input) {
        const now = new Date();
        let expiresAt = input.expiresAt;
        if (input.category === category_types_1.MemoryCategory.EMOTIONAL &&
            expiresAt == null &&
            (0, memory_config_1.getDefaultTtlForCategory)(category_types_1.MemoryCategory.EMOTIONAL)) {
            expiresAt = new Date(Date.now() +
                (this.config.defaultEmotionalTtlMs ?? (0, memory_config_1.getDefaultTtlForCategory)(category_types_1.MemoryCategory.EMOTIONAL)));
        }
        const item = {
            id: input.id ?? (0, crypto_1.randomUUID)(),
            userId: input.userId,
            category: input.category,
            key: input.key,
            value: input.value,
            confidence: input.confidence,
            source: input.source,
            evidence: input.evidence ?? [],
            createdAt: now,
            updatedAt: now,
            expiresAt,
            accessCount: input.accessCount ?? 0,
            sessionId: input.sessionId,
        };
        const id = await this.store.save(item);
        return { ...item, id };
    }
    /**
     * Get a memory item by id.
     */
    async get(id) {
        return this.store.get(id);
    }
    /**
     * Query memory items with filters.
     */
    async query(options) {
        return this.store.query(options);
    }
    /**
     * Get memories by user and category.
     */
    async getByUserAndCategory(userId, category, options) {
        return this.store.query({
            userId,
            category,
            notExpired: true,
            limit: options?.limit ?? 100,
            offset: options?.offset ?? 0,
            orderBy: options?.orderBy ?? 'updatedAt',
            order: options?.order ?? 'desc',
        });
    }
    /**
     * Update an existing memory. If explicitOverInferred is true, explicit source overrides inferred.
     */
    async update(id, updates) {
        const existing = await this.store.get(id);
        if (!existing)
            return;
        if (this.config.explicitOverInferred &&
            updates.source === 'inferred' &&
            existing.source === 'explicit') {
            return;
        }
        await this.store.update(id, {
            ...updates,
            updatedAt: new Date(),
        });
    }
    /**
     * Delete a memory item.
     */
    async delete(id) {
        await this.store.delete(id);
    }
    /**
     * Increment access count and updatedAt.
     */
    async incrementAccess(id) {
        const item = await this.store.get(id);
        if (!item)
            return;
        await this.store.update(id, {
            accessCount: item.accessCount + 1,
            updatedAt: new Date(),
        });
    }
    /**
     * Search memories (text or vector). No-op if store does not support search.
     */
    async search(query, options) {
        if (typeof this.store.search !== 'function')
            return [];
        return this.store.search(query, options);
    }
    /**
     * Get memory statistics.
     */
    async getStats(userId) {
        return this.store.getStats(userId);
    }
    /**
     * Prune expired, old, or low-confidence items.
     */
    async prune(options) {
        return this.store.prune(options);
    }
}
exports.MemoryService = MemoryService;
