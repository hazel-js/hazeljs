/**
 * Default configuration for memory (TTLs, retention, category defaults).
 */

import { MemoryCategory, DEFAULT_CATEGORY_CONFIG } from '../types/category.types';

export interface MemoryServiceConfig {
  /** Default TTL in ms for emotional category when expiresAt not set. */
  defaultEmotionalTtlMs?: number;
  /** Enforce explicit over inferred on update (default true). */
  explicitOverInferred?: boolean;
}

export const DEFAULT_MEMORY_SERVICE_CONFIG: Required<MemoryServiceConfig> = {
  defaultEmotionalTtlMs: 30 * 60 * 1000, // 30 min
  explicitOverInferred: true,
};

export { DEFAULT_CATEGORY_CONFIG };

/**
 * Get default TTL for a category (e.g. emotional).
 */
export function getDefaultTtlForCategory(category: MemoryCategory): number | undefined {
  return DEFAULT_CATEGORY_CONFIG[category]?.defaultTtlMs;
}
