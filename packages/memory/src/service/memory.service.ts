/**
 * High-level memory API — store-agnostic service.
 */

import { randomUUID } from 'crypto';
import { MemoryCategory } from '../types/category.types';
import { MemoryItem, MemoryItemInput } from '../types/memory-item.types';
import { MemoryQuery, MemorySearchOptions, MemoryStats, PruneOptions } from '../types/store.types';
import { MemoryStore } from '../store/memory-store.interface';
import {
  MemoryServiceConfig,
  DEFAULT_MEMORY_SERVICE_CONFIG,
  getDefaultTtlForCategory,
} from '../config/memory.config';

export class MemoryService {
  private readonly store: MemoryStore;
  private readonly config: Required<MemoryServiceConfig>;

  constructor(store: MemoryStore, config?: MemoryServiceConfig) {
    this.store = store;
    this.config = { ...DEFAULT_MEMORY_SERVICE_CONFIG, ...config };
  }

  /**
   * Initialize the underlying store.
   */
  async initialize(): Promise<void> {
    await this.store.initialize();
  }

  /**
   * Save a memory item (generates id and timestamps if omitted).
   */
  async save(input: MemoryItemInput): Promise<MemoryItem> {
    const now = new Date();
    let expiresAt = input.expiresAt;
    if (
      input.category === MemoryCategory.EMOTIONAL &&
      expiresAt == null &&
      getDefaultTtlForCategory(MemoryCategory.EMOTIONAL)
    ) {
      expiresAt = new Date(
        Date.now() +
          (this.config.defaultEmotionalTtlMs ?? getDefaultTtlForCategory(MemoryCategory.EMOTIONAL)!)
      );
    }
    const item: MemoryItem = {
      id: input.id ?? randomUUID(),
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
  async get(id: string): Promise<MemoryItem | null> {
    return this.store.get(id);
  }

  /**
   * Query memory items with filters.
   */
  async query(options: MemoryQuery): Promise<MemoryItem[]> {
    return this.store.query(options);
  }

  /**
   * Get memories by user and category.
   */
  async getByUserAndCategory(
    userId: string,
    category: MemoryCategory,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: 'createdAt' | 'updatedAt';
      order?: 'asc' | 'desc';
    }
  ): Promise<MemoryItem[]> {
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
  async update(id: string, updates: Partial<MemoryItem>): Promise<void> {
    const existing = await this.store.get(id);
    if (!existing) return;
    if (
      this.config.explicitOverInferred &&
      updates.source === 'inferred' &&
      existing.source === 'explicit'
    ) {
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
  async delete(id: string): Promise<void> {
    await this.store.delete(id);
  }

  /**
   * Increment access count and updatedAt.
   */
  async incrementAccess(id: string): Promise<void> {
    const item = await this.store.get(id);
    if (!item) return;
    await this.store.update(id, {
      accessCount: item.accessCount + 1,
      updatedAt: new Date(),
    });
  }

  /**
   * Search memories (text or vector). No-op if store does not support search.
   */
  async search(query: string | number[], options: MemorySearchOptions): Promise<MemoryItem[]> {
    if (typeof this.store.search !== 'function') return [];
    return this.store.search(query, options);
  }

  /**
   * Get memory statistics.
   */
  async getStats(userId?: string): Promise<MemoryStats> {
    return this.store.getStats(userId);
  }

  /**
   * Prune expired, old, or low-confidence items.
   */
  async prune(options?: PruneOptions): Promise<number> {
    return this.store.prune(options);
  }
}
