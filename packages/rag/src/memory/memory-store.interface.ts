/**
 * Memory store interface
 */

import { Memory, MemoryQuery, MemorySearchOptions, SummarizeOptions, MemoryStats } from './types';

/**
 * Interface for memory storage backends
 */
export interface MemoryStore {
  /**
   * Initialize the memory store
   */
  initialize(): Promise<void>;

  /**
   * Save a memory
   */
  save(memory: Memory): Promise<string>;

  /**
   * Save multiple memories
   */
  saveBatch(memories: Memory[]): Promise<string[]>;

  /**
   * Retrieve memories by query
   */
  retrieve(query: MemoryQuery): Promise<Memory[]>;

  /**
   * Search memories semantically
   */
  search(query: string, options: MemorySearchOptions): Promise<Memory[]>;

  /**
   * Get a specific memory by ID
   */
  get(id: string): Promise<Memory | null>;

  /**
   * Update a memory
   */
  update(id: string, updates: Partial<Memory>): Promise<void>;

  /**
   * Delete a memory
   */
  delete(id: string): Promise<void>;

  /**
   * Delete multiple memories
   */
  deleteBatch(ids: string[]): Promise<void>;

  /**
   * Clear all memories for a session
   */
  clearSession(sessionId: string): Promise<void>;

  /**
   * Clear all memories
   */
  clear(): Promise<void>;

  /**
   * Summarize memories
   */
  summarize(options: SummarizeOptions): Promise<string>;

  /**
   * Consolidate similar memories
   */
  consolidate(memories: Memory[]): Promise<Memory>;

  /**
   * Get memory statistics
   */
  getStats(sessionId?: string): Promise<MemoryStats>;

  /**
   * Prune old or low-importance memories
   */
  prune(options?: { olderThan?: Date; minImportance?: number }): Promise<number>;
}
