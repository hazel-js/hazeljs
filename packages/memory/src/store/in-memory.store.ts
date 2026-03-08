/**
 * In-memory memory store — default implementation, no external dependencies.
 */

import { randomUUID } from 'crypto';
import { MemoryCategory } from '../types/category.types';
import { MemoryItem } from '../types/memory-item.types';
import { MemoryQuery, MemorySearchOptions, MemoryStats, PruneOptions } from '../types/store.types';
import { MemoryStore } from './memory-store.interface';
import { DEFAULT_CATEGORY_CONFIG } from '../types/category.types';

export interface InMemoryStoreOptions {
  /** Max total items across all users (evict oldest by updatedAt when exceeded). */
  maxTotalItems?: number;
  /** Max items per user per category (evict oldest when exceeded). */
  maxItemsPerUserPerCategory?: number;
  /** Default TTL in ms for items with expiresAt (emotional). Applied on read for lazy expiry. */
  defaultEmotionalTtlMs?: number;
}

const DEFAULT_MAX_TOTAL = 100_000;
const DEFAULT_MAX_PER_USER_PER_CATEGORY = 5000;

/**
 * In-memory store with Map by id and in-memory indexes for fast query.
 */
export class InMemoryStore implements MemoryStore {
  private items = new Map<string, MemoryItem>();
  private byUser = new Map<string, string[]>();
  private byUserCategory = new Map<string, string[]>();
  private byUserCategoryKey = new Map<string, string>();
  private options: Required<InMemoryStoreOptions>;

  constructor(options: InMemoryStoreOptions = {}) {
    this.options = {
      maxTotalItems: options.maxTotalItems ?? DEFAULT_MAX_TOTAL,
      maxItemsPerUserPerCategory:
        options.maxItemsPerUserPerCategory ?? DEFAULT_MAX_PER_USER_PER_CATEGORY,
      defaultEmotionalTtlMs: options.defaultEmotionalTtlMs ?? 30 * 60 * 1000,
    };
  }

  async initialize(): Promise<void> {
    // No-op for in-memory
  }

  private indexItem(id: string, item: MemoryItem): void {
    const uid = item.userId;
    const cat = item.category;
    const key = item.key;

    if (!this.byUser.has(uid)) this.byUser.set(uid, []);
    this.byUser.get(uid)!.push(id);

    const uck = `${uid}:${cat}`;
    if (!this.byUserCategory.has(uck)) this.byUserCategory.set(uck, []);
    this.byUserCategory.get(uck)!.push(id);

    this.byUserCategoryKey.set(`${uid}:${cat}:${key}`, id);
  }

  private unindexItem(id: string, item: MemoryItem): void {
    const uid = item.userId;
    const cat = item.category;
    const key = item.key;

    const userIds = this.byUser.get(uid);
    if (userIds) {
      const i = userIds.indexOf(id);
      if (i !== -1) userIds.splice(i, 1);
      if (userIds.length === 0) this.byUser.delete(uid);
    }

    const uck = `${uid}:${cat}`;
    const catIds = this.byUserCategory.get(uck);
    if (catIds) {
      const i = catIds.indexOf(id);
      if (i !== -1) catIds.splice(i, 1);
      if (catIds.length === 0) this.byUserCategory.delete(uck);
    }

    this.byUserCategoryKey.delete(`${uid}:${cat}:${key}`);
  }

  private evictIfNeeded(userId: string, category: MemoryCategory): void {
    const uck = `${userId}:${category}`;
    const ids = this.byUserCategory.get(uck);
    if (!ids) return;
    const max = this.options.maxItemsPerUserPerCategory;
    if (ids.length <= max) return;

    const items = ids
      .map((id) => this.items.get(id))
      .filter((m): m is MemoryItem => m != null)
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());

    const toRemove = items.slice(0, items.length - max);
    for (const m of toRemove) {
      this.items.delete(m.id);
      this.unindexItem(m.id, m);
    }
  }

  private evictGlobalIfNeeded(): void {
    if (this.items.size <= this.options.maxTotalItems) return;
    const all = Array.from(this.items.values()).sort(
      (a, b) => a.updatedAt.getTime() - b.updatedAt.getTime()
    );
    const toRemove = all.slice(0, all.length - this.options.maxTotalItems);
    for (const m of toRemove) {
      this.items.delete(m.id);
      this.unindexItem(m.id, m);
    }
  }

  async save(item: MemoryItem): Promise<string> {
    const config = DEFAULT_CATEGORY_CONFIG[item.category];
    if (item.category === MemoryCategory.EMOTIONAL && !item.expiresAt && config.defaultTtlMs) {
      item = {
        ...item,
        expiresAt: new Date(Date.now() + config.defaultTtlMs),
      };
    }
    const id = item.id || randomUUID();
    const now = new Date();
    const full: MemoryItem = {
      ...item,
      id,
      createdAt: item.createdAt ?? now,
      updatedAt: item.updatedAt ?? now,
      accessCount: item.accessCount ?? 0,
    };
    if (this.items.has(id)) {
      const old = this.items.get(id)!;
      this.unindexItem(id, old);
    }
    this.items.set(id, full);
    this.indexItem(id, full);
    this.evictIfNeeded(full.userId, full.category);
    this.evictGlobalIfNeeded();
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
    const item = this.items.get(id) ?? null;
    if (item?.expiresAt && item.expiresAt.getTime() < Date.now()) {
      await this.delete(id);
      return null;
    }
    return item;
  }

  async update(id: string, updates: Partial<MemoryItem>): Promise<void> {
    const existing = this.items.get(id);
    if (!existing) return;
    this.unindexItem(id, existing);
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
    this.indexItem(id, updated);
  }

  async delete(id: string): Promise<void> {
    const item = this.items.get(id);
    if (item) {
      this.items.delete(id);
      this.unindexItem(id, item);
    }
  }

  async deleteBatch(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.delete(id);
    }
  }

  async query(options: MemoryQuery): Promise<MemoryItem[]> {
    const now = Date.now();
    const categories =
      options.category != null
        ? Array.isArray(options.category)
          ? options.category
          : [options.category]
        : Object.values(MemoryCategory);
    const sources =
      options.source != null
        ? Array.isArray(options.source)
          ? options.source
          : [options.source]
        : null;

    let ids: string[] = [];
    for (const cat of categories) {
      const uck = `${options.userId}:${cat}`;
      const list = this.byUserCategory.get(uck);
      if (list) ids = ids.concat(list);
    }
    if (ids.length === 0) return [];

    const seen = new Set<string>();
    const items: MemoryItem[] = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      const item = this.items.get(id);
      if (!item) continue;
      if (item.expiresAt && item.expiresAt.getTime() < now) {
        this.items.delete(id);
        this.unindexItem(id, item);
        continue;
      }
      if (sources && !sources.includes(item.source)) continue;
      if (options.minConfidence != null && item.confidence < options.minConfidence) continue;
      if (options.notExpired !== false && item.expiresAt && item.expiresAt.getTime() < now)
        continue;
      seen.add(id);
      items.push(item);
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

  search(query: string | number[], options: MemorySearchOptions): Promise<MemoryItem[]> {
    if (typeof query !== 'string') {
      return Promise.resolve([]);
    }
    const q = query.toLowerCase();
    const items = Array.from(this.items.values()).filter(
      (m) =>
        m.userId === options.userId &&
        (!options.category ||
          (Array.isArray(options.category)
            ? options.category.includes(m.category)
            : m.category === options.category)) &&
        (typeof m.value === 'string'
          ? m.value.toLowerCase().includes(q)
          : m.key.toLowerCase().includes(q))
    );
    const topK = options.topK ?? 10;
    items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return Promise.resolve(items.slice(0, topK));
  }

  async getStats(userId?: string): Promise<MemoryStats> {
    const now = Date.now();
    const byCategory = Object.values(MemoryCategory).reduce(
      (acc, cat) => ({ ...acc, [cat]: 0 }),
      {} as Record<MemoryCategory, number>
    );
    let oldest: number | null = null;
    let newest: number | null = null;

    const iterate = userId ? (this.byUser.get(userId) ?? []) : Array.from(this.items.keys());

    for (const id of iterate) {
      const item = this.items.get(id);
      if (!item) continue;
      if (item.expiresAt && item.expiresAt.getTime() < now) continue;
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
    let removed = 0;

    const idsToCheck = options?.userId
      ? (this.byUser.get(options.userId) ?? [])
      : Array.from(this.items.keys());

    for (const id of idsToCheck) {
      const item = this.items.get(id);
      if (!item) continue;
      if (options?.userId && item.userId !== options.userId) continue;
      if (options?.category && item.category !== options.category) continue;

      const isExpired = item.expiresAt != null && item.expiresAt.getTime() < now;
      const isTooOld = options?.olderThan != null && item.updatedAt < options.olderThan;
      const isLowConfidence =
        options?.minConfidence != null && item.confidence < options.minConfidence;

      if (!isExpired && !isTooOld && !isLowConfidence) continue;

      this.items.delete(id);
      this.unindexItem(id, item);
      removed++;
    }

    if (options?.maxItemsPerUser != null && options.userId) {
      const catKeys = options.category
        ? [`${options.userId}:${options.category}`]
        : Array.from(this.byUserCategory.keys()).filter((k) => k.startsWith(options.userId! + ':'));
      for (const uck of catKeys) {
        const ids = this.byUserCategory.get(uck);
        if (!ids || ids.length <= options.maxItemsPerUser!) continue;
        const sorted = ids
          .map((id) => this.items.get(id))
          .filter((m): m is MemoryItem => m != null)
          .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
        const toRemove = sorted.slice(0, sorted.length - options.maxItemsPerUser!);
        for (const m of toRemove) {
          this.items.delete(m.id);
          this.unindexItem(m.id, m);
          removed++;
        }
      }
    }

    return removed;
  }
}

/**
 * Create the default in-memory store (no external dependencies).
 */
export function createDefaultMemoryStore(options?: InMemoryStoreOptions): MemoryStore {
  return new InMemoryStore(options);
}
