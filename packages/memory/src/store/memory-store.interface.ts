/**
 * Store-agnostic interface for memory backends.
 */

import { MemoryItem } from '../types/memory-item.types';
import { MemoryQuery, MemorySearchOptions, MemoryStats, PruneOptions } from '../types/store.types';

/**
 * Interface for memory storage backends.
 * All stores (in-memory, Postgres, Redis, vector) implement this.
 */
export interface MemoryStore {
  /**
   * Initialize the store (e.g. connect to DB, create tables).
   */
  initialize(): Promise<void>;

  /**
   * Save a single memory item. Returns the item id.
   */
  save(item: MemoryItem): Promise<string>;

  /**
   * Save multiple memory items. Returns array of ids.
   */
  saveBatch(items: MemoryItem[]): Promise<string[]>;

  /**
   * Get a memory item by id.
   */
  get(id: string): Promise<MemoryItem | null>;

  /**
   * Update an existing memory item (partial update).
   */
  update(id: string, updates: Partial<MemoryItem>): Promise<void>;

  /**
   * Delete a memory item by id.
   */
  delete(id: string): Promise<void>;

  /**
   * Delete multiple memory items by id.
   */
  deleteBatch(ids: string[]): Promise<void>;

  /**
   * Query memory items with filters (userId, category, source, etc.).
   */
  query(options: MemoryQuery): Promise<MemoryItem[]>;

  /**
   * Search memories (text or vector). Optional; stores that do not support search may throw or return [].
   */
  search?(query: string | number[], options: MemorySearchOptions): Promise<MemoryItem[]>;

  /**
   * Get memory statistics (counts by category, oldest/newest).
   */
  getStats(userId?: string): Promise<MemoryStats>;

  /**
   * Prune old, expired, or low-confidence items. Returns number of items removed.
   */
  prune(options?: PruneOptions): Promise<number>;
}
