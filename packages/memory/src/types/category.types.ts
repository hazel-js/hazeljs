/**
 * Memory categories (buckets) for the unified memory model.
 */

export enum MemoryCategory {
  PROFILE = 'profile',
  PREFERENCE = 'preference',
  BEHAVIORAL = 'behavioral',
  EMOTIONAL = 'emotional',
  EPISODIC = 'episodic',
  SEMANTIC_SUMMARY = 'semantic_summary',
}

/**
 * Categories that are typically stored in the primary store (non-vector).
 */
export const PRIMARY_CATEGORIES: MemoryCategory[] = [
  MemoryCategory.PROFILE,
  MemoryCategory.PREFERENCE,
  MemoryCategory.BEHAVIORAL,
  MemoryCategory.EMOTIONAL,
  MemoryCategory.SEMANTIC_SUMMARY,
];

/**
 * Categories that benefit from vector search (episodic / semantic recall).
 */
export const VECTOR_CATEGORIES: MemoryCategory[] = [
  MemoryCategory.EPISODIC,
  MemoryCategory.SEMANTIC_SUMMARY,
];

export interface CategoryBucketConfig {
  defaultTtlMs?: number;
  maxItemsPerUser?: number;
  supportsVectorSearch?: boolean;
}

/**
 * Default per-category configuration (e.g. TTL for emotional).
 */
export const DEFAULT_CATEGORY_CONFIG: Record<MemoryCategory, CategoryBucketConfig> = {
  [MemoryCategory.PROFILE]: { maxItemsPerUser: 500 },
  [MemoryCategory.PREFERENCE]: { maxItemsPerUser: 1000 },
  [MemoryCategory.BEHAVIORAL]: { maxItemsPerUser: 500 },
  [MemoryCategory.EMOTIONAL]: { defaultTtlMs: 30 * 60 * 1000, maxItemsPerUser: 100 }, // 30 min default TTL
  [MemoryCategory.EPISODIC]: { maxItemsPerUser: 5000, supportsVectorSearch: true },
  [MemoryCategory.SEMANTIC_SUMMARY]: { maxItemsPerUser: 50, supportsVectorSearch: true },
};
