/**
 * Memory categories (buckets) for the unified memory model.
 */
export declare enum MemoryCategory {
    PROFILE = "profile",
    PREFERENCE = "preference",
    BEHAVIORAL = "behavioral",
    EMOTIONAL = "emotional",
    EPISODIC = "episodic",
    SEMANTIC_SUMMARY = "semantic_summary"
}
/**
 * Categories that are typically stored in the primary store (non-vector).
 */
export declare const PRIMARY_CATEGORIES: MemoryCategory[];
/**
 * Categories that benefit from vector search (episodic / semantic recall).
 */
export declare const VECTOR_CATEGORIES: MemoryCategory[];
export interface CategoryBucketConfig {
    defaultTtlMs?: number;
    maxItemsPerUser?: number;
    supportsVectorSearch?: boolean;
}
/**
 * Default per-category configuration (e.g. TTL for emotional).
 */
export declare const DEFAULT_CATEGORY_CONFIG: Record<MemoryCategory, CategoryBucketConfig>;
//# sourceMappingURL=category.types.d.ts.map