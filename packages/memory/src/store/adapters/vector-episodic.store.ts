/**
 * Vector-backed episodic (and optional semantic_summary) memory store.
 * Stores MemoryItems in memory and optionally in a vector index for similarity search.
 */

import { randomUUID } from 'crypto';
import { MemoryCategory } from '../../types/category.types';
import { MemoryItem } from '../../types/memory-item.types';
import {
  MemoryQuery,
  MemorySearchOptions,
  MemoryStats,
  PruneOptions,
} from '../../types/store.types';
import { MemoryStore } from '../memory-store.interface';

/** Minimal vector store for episodic search (consumer can pass a real vector DB adapter). */
export interface VectorStoreAdapter {
  add(id: string, embedding: number[], metadata?: Record<string, unknown>): Promise<void>;
  search(
    embedding: number[],
    options: { topK?: number; filter?: { userId?: string; category?: string } }
  ): Promise<Array<{ id: string; score: number }>>;
  delete(id: string): Promise<void>;
}

export interface VectorEpisodicStoreOptions {
  /** Categories this store handles. Default: [EPISODIC, SEMANTIC_SUMMARY]. */
  categories?: MemoryCategory[];
  /** Optional vector store for similarity search. If omitted, search() returns []. */
  vectorStore?: VectorStoreAdapter;
}

const DEFAULT_CATEGORIES: MemoryCategory[] = [
  MemoryCategory.EPISODIC,
  MemoryCategory.SEMANTIC_SUMMARY,
];

/**
 * Store for episodic/semantic_summary only. Items are kept in memory; optional vector store for search.
 */
export class VectorEpisodicStore implements MemoryStore {
  private readonly items = new Map<string, MemoryItem>();
  private readonly byUser = new Map<string, string[]>();
  private readonly byUserCategory = new Map<string, string[]>();
  private readonly categories: Set<MemoryCategory>;
  private readonly vectorStore?: VectorStoreAdapter;

  constructor(options: VectorEpisodicStoreOptions = {}) {
    this.categories = new Set(options.categories ?? DEFAULT_CATEGORIES);
    this.vectorStore = options.vectorStore;
  }

  private assertCategory(category: MemoryCategory): void {
    if (!this.categories.has(category)) {
      throw new Error(
        `VectorEpisodicStore only accepts categories: ${[...this.categories].join(', ')}`
      );
    }
  }

  private index(userId: string, category: MemoryCategory, id: string): void {
    if (!this.byUser.has(userId)) this.byUser.set(userId, []);
    this.byUser.get(userId)!.push(id);
    const uck = `${userId}:${category}`;
    if (!this.byUserCategory.has(uck)) this.byUserCategory.set(uck, []);
    this.byUserCategory.get(uck)!.push(id);
  }

  private unindex(userId: string, category: MemoryCategory, id: string): void {
    const list = this.byUser.get(userId);
    if (list) {
      const i = list.indexOf(id);
      if (i !== -1) list.splice(i, 1);
      if (list.length === 0) this.byUser.delete(userId);
    }
    const uck = `${userId}:${category}`;
    const catList = this.byUserCategory.get(uck);
    if (catList) {
      const i = catList.indexOf(id);
      if (i !== -1) catList.splice(i, 1);
      if (catList.length === 0) this.byUserCategory.delete(uck);
    }
  }

  async initialize(): Promise<void> {
    // No-op
  }

  async save(item: MemoryItem): Promise<string> {
    this.assertCategory(item.category);
    const id = item.id || randomUUID();
    const now = new Date();
    const full: MemoryItem = {
      ...item,
      id,
      createdAt: item.createdAt ?? now,
      updatedAt: item.updatedAt ?? now,
      accessCount: item.accessCount ?? 0,
    };
    const existing = this.items.get(id);
    if (existing) {
      this.unindex(existing.userId, existing.category, id);
      if (this.vectorStore) await this.vectorStore.delete(id);
    }
    this.items.set(id, full);
    this.index(full.userId, full.category, id);
    if (this.vectorStore && Array.isArray(full.value) && full.value.length > 0) {
      await this.vectorStore.add(id, full.value as number[], {
        userId: full.userId,
        category: full.category,
      });
    }
    return id;
  }

  async saveBatch(items: MemoryItem[]): Promise<string[]> {
    const ids: string[] = [];
    for (const item of items) {
      ids.push(await this.save(item));
    }
    return ids;
  }

  async get(id: string): Promise<MemoryItem | null> {
    return this.items.get(id) ?? null;
  }

  async update(id: string, updates: Partial<MemoryItem>): Promise<void> {
    const existing = this.items.get(id);
    if (!existing) return;
    this.assertCategory(existing.category);
    const updated: MemoryItem = {
      ...existing,
      ...updates,
      id: existing.id,
      userId: existing.userId,
      category: existing.category,
      key: existing.key,
      updatedAt: new Date(),
    };
    this.items.set(id, updated);
    if (this.vectorStore && Array.isArray(updated.value) && updated.value.length > 0) {
      await this.vectorStore.delete(id);
      await this.vectorStore.add(id, updated.value as number[], {
        userId: updated.userId,
        category: updated.category,
      });
    }
  }

  async delete(id: string): Promise<void> {
    const item = this.items.get(id);
    if (item) {
      this.unindex(item.userId, item.category, id);
      if (this.vectorStore) await this.vectorStore.delete(id);
    }
    this.items.delete(id);
  }

  async deleteBatch(ids: string[]): Promise<void> {
    for (const id of ids) await this.delete(id);
  }

  async query(options: MemoryQuery): Promise<MemoryItem[]> {
    const categories =
      options.category != null
        ? Array.isArray(options.category)
          ? options.category
          : [options.category]
        : [...this.categories];
    const allowed = categories.filter((c) => this.categories.has(c));
    if (allowed.length === 0) return [];

    let ids: string[] = [];
    for (const cat of allowed) {
      const uck = `${options.userId}:${cat}`;
      const list = this.byUserCategory.get(uck);
      if (list) ids = ids.concat(list);
    }
    ids = [...new Set(ids)];

    let items = ids.map((id) => this.items.get(id)).filter((m): m is MemoryItem => m != null);

    if (options.source != null) {
      const srcs = Array.isArray(options.source) ? options.source : [options.source];
      items = items.filter((m) => srcs.includes(m.source));
    }
    if (options.minConfidence != null) {
      items = items.filter((m) => m.confidence >= options.minConfidence!);
    }
    if (options.notExpired !== false) {
      const now = Date.now();
      items = items.filter((m) => !m.expiresAt || m.expiresAt.getTime() >= now);
    }

    const orderBy = options.orderBy ?? 'updatedAt';
    const order = options.order ?? 'desc';
    items.sort((a, b) => {
      const ta = a[orderBy].getTime();
      const tb = b[orderBy].getTime();
      return order === 'asc' ? ta - tb : tb - ta;
    });

    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;
    return items.slice(offset, offset + limit);
  }

  async search(query: string | number[], options: MemorySearchOptions): Promise<MemoryItem[]> {
    if (!this.vectorStore || !Array.isArray(query) || query.length === 0) {
      if (typeof query === 'string') {
        const items = await this.query({
          userId: options.userId,
          category: options.category,
          limit: options.topK ?? 10,
        });
        const q = query.toLowerCase();
        return items
          .filter(
            (m) =>
              (typeof m.value === 'string' && m.value.toLowerCase().includes(q)) ||
              m.key.toLowerCase().includes(q)
          )
          .slice(0, options.topK ?? 10);
      }
      return [];
    }
    const results = await this.vectorStore.search(query, {
      topK: options.topK ?? 10,
      filter: {
        userId: options.userId,
        category: Array.isArray(options.category) ? options.category[0] : options.category,
      },
    });
    const items: MemoryItem[] = [];
    for (const { id } of results) {
      const item = this.items.get(id);
      if (item) items.push(item);
    }
    return items;
  }

  async getStats(userId?: string): Promise<MemoryStats> {
    const byCategory = Object.values(MemoryCategory).reduce(
      (acc, cat) => ({ ...acc, [cat]: 0 }),
      {} as Record<MemoryCategory, number>
    );
    const iterate = userId ? (this.byUser.get(userId) ?? []) : Array.from(this.items.keys());
    let oldest: number | null = null;
    let newest: number | null = null;
    for (const id of iterate) {
      const item = this.items.get(id);
      if (!item) continue;
      byCategory[item.category]++;
      const t = item.updatedAt.getTime();
      if (oldest == null || t < oldest) oldest = t;
      if (newest == null || t > newest) newest = t;
    }
    return {
      total: Object.values(byCategory).reduce((a, b) => a + b, 0),
      byCategory,
      oldestMemory: oldest != null ? new Date(oldest) : null,
      newestMemory: newest != null ? new Date(newest) : null,
    };
  }

  async prune(options?: PruneOptions): Promise<number> {
    const now = Date.now();
    const userIds = options?.userId ? [options.userId] : Array.from(this.byUser.keys());
    let removed = 0;
    for (const uid of userIds) {
      const ids = this.byUser.get(uid) ?? [];
      for (const id of ids) {
        const item = this.items.get(id);
        if (!item) continue;
        if (options?.category && item.category !== options.category) continue;
        const isExpired = item.expiresAt != null && item.expiresAt.getTime() < now;
        const isTooOld = options?.olderThan != null && item.updatedAt < options.olderThan;
        const isLowConfidence =
          options?.minConfidence != null && item.confidence < options.minConfidence;
        if (isExpired || isTooOld || isLowConfidence) {
          await this.delete(id);
          removed++;
        }
      }
    }
    return removed;
  }
}
