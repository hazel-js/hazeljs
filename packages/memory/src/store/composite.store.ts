/**
 * Composite memory store — routes by category to primary and optional episodic (vector) store.
 */

import { MemoryCategory } from '../types/category.types';
import { MemoryItem } from '../types/memory-item.types';
import { MemoryQuery, MemorySearchOptions, MemoryStats, PruneOptions } from '../types/store.types';
import { MemoryStore } from './memory-store.interface';

export interface CompositeMemoryStoreOptions {
  /** Primary store for profile, preference, behavioral, emotional, and optionally semantic_summary. */
  primary: MemoryStore;
  /** Optional store for episodic (and optionally semantic_summary) with vector search. */
  episodic?: MemoryStore;
  /** Categories to route to episodic store. Default: [EPISODIC, SEMANTIC_SUMMARY]. */
  episodicCategories?: MemoryCategory[];
}

const DEFAULT_EPISODIC_CATEGORIES: MemoryCategory[] = [
  MemoryCategory.EPISODIC,
  MemoryCategory.SEMANTIC_SUMMARY,
];

/**
 * Routes saves/queries by category to primary or episodic store.
 */
export class CompositeMemoryStore implements MemoryStore {
  private readonly primary: MemoryStore;
  private readonly episodic: MemoryStore | undefined;
  private readonly episodicCategories: Set<MemoryCategory>;

  constructor(options: CompositeMemoryStoreOptions) {
    this.primary = options.primary;
    this.episodic = options.episodic;
    this.episodicCategories = new Set(options.episodicCategories ?? DEFAULT_EPISODIC_CATEGORIES);
  }

  private route(category: MemoryCategory): MemoryStore {
    if (this.episodic && this.episodicCategories.has(category)) {
      return this.episodic;
    }
    return this.primary;
  }

  async initialize(): Promise<void> {
    await this.primary.initialize();
    if (this.episodic) await this.episodic.initialize();
  }

  async save(item: MemoryItem): Promise<string> {
    return this.route(item.category).save(item);
  }

  async saveBatch(items: MemoryItem[]): Promise<string[]> {
    const ids: string[] = [];
    for (const item of items) {
      ids.push(await this.route(item.category).save(item));
    }
    return ids;
  }

  async get(id: string): Promise<MemoryItem | null> {
    const fromPrimary = await this.primary.get(id);
    if (fromPrimary) return fromPrimary;
    if (this.episodic) return this.episodic.get(id);
    return null;
  }

  async update(id: string, updates: Partial<MemoryItem>): Promise<void> {
    const fromPrimary = await this.primary.get(id);
    if (fromPrimary) {
      await this.primary.update(id, updates);
      return;
    }
    if (this.episodic) await this.episodic.update(id, updates);
  }

  async delete(id: string): Promise<void> {
    await this.primary.delete(id);
    if (this.episodic) await this.episodic.delete(id);
  }

  async deleteBatch(ids: string[]): Promise<void> {
    await this.primary.deleteBatch(ids);
    if (this.episodic) await this.episodic.deleteBatch(ids);
  }

  async query(options: MemoryQuery): Promise<MemoryItem[]> {
    const categories =
      options.category != null
        ? Array.isArray(options.category)
          ? options.category
          : [options.category]
        : Object.values(MemoryCategory);

    const primaryCats = categories.filter((c) => !this.episodicCategories.has(c));
    const episodicCats = categories.filter((c) => this.episodicCategories.has(c));

    const results: MemoryItem[] = [];

    if (primaryCats.length > 0) {
      const primaryResults = await this.primary.query({
        ...options,
        category: primaryCats.length === 1 ? primaryCats[0] : primaryCats,
      });
      results.push(...primaryResults);
    }

    if (this.episodic && episodicCats.length > 0) {
      const episodicResults = await this.episodic.query({
        ...options,
        category: episodicCats.length === 1 ? episodicCats[0] : episodicCats,
      });
      results.push(...episodicResults);
    }

    const orderBy = options.orderBy ?? 'updatedAt';
    const order = options.order ?? 'desc';
    results.sort((a, b) => {
      const ta = a[orderBy].getTime();
      const tb = b[orderBy].getTime();
      return order === 'asc' ? ta - tb : tb - ta;
    });

    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  async search(query: string | number[], options: MemorySearchOptions): Promise<MemoryItem[]> {
    if (this.episodic && typeof this.episodic.search === 'function') {
      return this.episodic.search(query, options);
    }
    if (typeof this.primary.search === 'function') {
      return this.primary.search(query, options);
    }
    return [];
  }

  async getStats(userId?: string): Promise<MemoryStats> {
    const primaryStats = await this.primary.getStats(userId);
    if (!this.episodic) return primaryStats;

    const episodicStats = await this.episodic.getStats(userId);
    const byCategory = { ...primaryStats.byCategory };
    for (const cat of this.episodicCategories) {
      byCategory[cat] = (byCategory[cat] ?? 0) + (episodicStats.byCategory[cat] ?? 0);
    }
    const total = Object.values(byCategory).reduce((a, b) => a + b, 0);
    const oldest =
      primaryStats.oldestMemory && episodicStats.oldestMemory
        ? new Date(
            Math.min(primaryStats.oldestMemory.getTime(), episodicStats.oldestMemory.getTime())
          )
        : (primaryStats.oldestMemory ?? episodicStats.oldestMemory);
    const newest =
      primaryStats.newestMemory && episodicStats.newestMemory
        ? new Date(
            Math.max(primaryStats.newestMemory.getTime(), episodicStats.newestMemory.getTime())
          )
        : (primaryStats.newestMemory ?? episodicStats.newestMemory);

    return {
      total,
      byCategory,
      oldestMemory: oldest,
      newestMemory: newest,
    };
  }

  async prune(options?: PruneOptions): Promise<number> {
    const primaryRemoved = await this.primary.prune(options);
    let episodicRemoved = 0;
    if (this.episodic) {
      const episodicOptions = options?.category
        ? this.episodicCategories.has(options.category)
          ? options
          : undefined
        : options;
      if (episodicOptions) episodicRemoved = await this.episodic.prune(episodicOptions);
    }
    return primaryRemoved + episodicRemoved;
  }
}
