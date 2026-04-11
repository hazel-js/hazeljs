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
export declare const DEFAULT_MEMORY_SERVICE_CONFIG: Required<MemoryServiceConfig>;
export { DEFAULT_CATEGORY_CONFIG };
/**
 * Get default TTL for a category (e.g. emotional).
 */
export declare function getDefaultTtlForCategory(category: MemoryCategory): number | undefined;
//# sourceMappingURL=memory.config.d.ts.map
