/**
 * High-level memory API — store-agnostic service.
 */
import { MemoryCategory } from '../types/category.types';
import { MemoryItem, MemoryItemInput } from '../types/memory-item.types';
import { MemoryQuery, MemorySearchOptions, MemoryStats, PruneOptions } from '../types/store.types';
import { MemoryStore } from '../store/memory-store.interface';
import { MemoryServiceConfig } from '../config/memory.config';
export declare class MemoryService {
  private readonly store;
  private readonly config;
  constructor(store: MemoryStore, config?: MemoryServiceConfig);
  /**
   * Initialize the underlying store.
   */
  initialize(): Promise<void>;
  /**
   * Save a memory item (generates id and timestamps if omitted).
   */
  save(input: MemoryItemInput): Promise<MemoryItem>;
  /**
   * Get a memory item by id.
   */
  get(id: string): Promise<MemoryItem | null>;
  /**
   * Query memory items with filters.
   */
  query(options: MemoryQuery): Promise<MemoryItem[]>;
  /**
   * Get memories by user and category.
   */
  getByUserAndCategory(
    userId: string,
    category: MemoryCategory,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: 'createdAt' | 'updatedAt';
      order?: 'asc' | 'desc';
    }
  ): Promise<MemoryItem[]>;
  /**
   * Update an existing memory. If explicitOverInferred is true, explicit source overrides inferred.
   */
  update(id: string, updates: Partial<MemoryItem>): Promise<void>;
  /**
   * Delete a memory item.
   */
  delete(id: string): Promise<void>;
  /**
   * Increment access count and updatedAt.
   */
  incrementAccess(id: string): Promise<void>;
  /**
   * Search memories (text or vector). No-op if store does not support search.
   */
  search(query: string | number[], options: MemorySearchOptions): Promise<MemoryItem[]>;
  /**
   * Get memory statistics.
   */
  getStats(userId?: string): Promise<MemoryStats>;
  /**
   * Prune expired, old, or low-confidence items.
   */
  prune(options?: PruneOptions): Promise<number>;
}
//# sourceMappingURL=memory.service.d.ts.map
