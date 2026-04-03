"use strict";
/**
 * Memory categories (buckets) for the unified memory model.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CATEGORY_CONFIG = exports.VECTOR_CATEGORIES = exports.PRIMARY_CATEGORIES = exports.MemoryCategory = void 0;
var MemoryCategory;
(function (MemoryCategory) {
    MemoryCategory["PROFILE"] = "profile";
    MemoryCategory["PREFERENCE"] = "preference";
    MemoryCategory["BEHAVIORAL"] = "behavioral";
    MemoryCategory["EMOTIONAL"] = "emotional";
    MemoryCategory["EPISODIC"] = "episodic";
    MemoryCategory["SEMANTIC_SUMMARY"] = "semantic_summary";
})(MemoryCategory || (exports.MemoryCategory = MemoryCategory = {}));
/**
 * Categories that are typically stored in the primary store (non-vector).
 */
exports.PRIMARY_CATEGORIES = [
    MemoryCategory.PROFILE,
    MemoryCategory.PREFERENCE,
    MemoryCategory.BEHAVIORAL,
    MemoryCategory.EMOTIONAL,
    MemoryCategory.SEMANTIC_SUMMARY,
];
/**
 * Categories that benefit from vector search (episodic / semantic recall).
 */
exports.VECTOR_CATEGORIES = [
    MemoryCategory.EPISODIC,
    MemoryCategory.SEMANTIC_SUMMARY,
];
/**
 * Default per-category configuration (e.g. TTL for emotional).
 */
exports.DEFAULT_CATEGORY_CONFIG = {
    [MemoryCategory.PROFILE]: { maxItemsPerUser: 500 },
    [MemoryCategory.PREFERENCE]: { maxItemsPerUser: 1000 },
    [MemoryCategory.BEHAVIORAL]: { maxItemsPerUser: 500 },
    [MemoryCategory.EMOTIONAL]: { defaultTtlMs: 30 * 60 * 1000, maxItemsPerUser: 100 }, // 30 min default TTL
    [MemoryCategory.EPISODIC]: { maxItemsPerUser: 5000, supportsVectorSearch: true },
    [MemoryCategory.SEMANTIC_SUMMARY]: { maxItemsPerUser: 50, supportsVectorSearch: true },
};
