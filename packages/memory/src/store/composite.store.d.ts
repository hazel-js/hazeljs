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
/**
 * Routes saves/queries by category to primary or episodic store.
 */
export declare class CompositeMemoryStore implements MemoryStore {
  private readonly primary;
  private readonly episodic;
  private readonly episodicCategories;
  constructor(options: CompositeMemoryStoreOptions);
  private route;
  initialize(): Promise<void>;
  save(item: MemoryItem): Promise<string>;
  saveBatch(items: MemoryItem[]): Promise<string[]>;
  get(id: string): Promise<MemoryItem | null>;
  update(id: string, updates: Partial<MemoryItem>): Promise<void>;
  delete(id: string): Promise<void>;
  deleteBatch(ids: string[]): Promise<void>;
  query(options: MemoryQuery): Promise<MemoryItem[]>;
  search(query: string | number[], options: MemorySearchOptions): Promise<MemoryItem[]>;
  getStats(userId?: string): Promise<MemoryStats>;
  prune(options?: PruneOptions): Promise<number>;
}
//# sourceMappingURL=composite.store.d.ts.map
