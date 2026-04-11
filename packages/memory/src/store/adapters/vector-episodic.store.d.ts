/**
 * Vector-backed episodic (and optional semantic_summary) memory store.
 * Stores MemoryItems in memory and optionally in a vector index for similarity search.
 */
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
    options: {
      topK?: number;
      filter?: {
        userId?: string;
        category?: string;
      };
    }
  ): Promise<
    Array<{
      id: string;
      score: number;
    }>
  >;
  delete(id: string): Promise<void>;
}
export interface VectorEpisodicStoreOptions {
  /** Categories this store handles. Default: [EPISODIC, SEMANTIC_SUMMARY]. */
  categories?: MemoryCategory[];
  /** Optional vector store for similarity search. If omitted, search() returns []. */
  vectorStore?: VectorStoreAdapter;
}
/**
 * Store for episodic/semantic_summary only. Items are kept in memory; optional vector store for search.
 */
export declare class VectorEpisodicStore implements MemoryStore {
  private readonly items;
  private readonly byUser;
  private readonly byUserCategory;
  private readonly categories;
  private readonly vectorStore?;
  constructor(options?: VectorEpisodicStoreOptions);
  private assertCategory;
  private index;
  private unindex;
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
//# sourceMappingURL=vector-episodic.store.d.ts.map
