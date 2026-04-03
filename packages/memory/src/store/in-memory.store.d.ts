/**
 * In-memory memory store — default implementation, no external dependencies.
 */
import { MemoryItem } from '../types/memory-item.types';
import { MemoryQuery, MemorySearchOptions, MemoryStats, PruneOptions } from '../types/store.types';
import { MemoryStore } from './memory-store.interface';
export interface InMemoryStoreOptions {
    /** Max total items across all users (evict oldest by updatedAt when exceeded). */
    maxTotalItems?: number;
    /** Max items per user per category (evict oldest when exceeded). */
    maxItemsPerUserPerCategory?: number;
    /** Default TTL in ms for items with expiresAt (emotional). Applied on read for lazy expiry. */
    defaultEmotionalTtlMs?: number;
}
/**
 * In-memory store with Map by id and in-memory indexes for fast query.
 */
export declare class InMemoryStore implements MemoryStore {
    private items;
    private byUser;
    private byUserCategory;
    private byUserCategoryKey;
    private options;
    constructor(options?: InMemoryStoreOptions);
    initialize(): Promise<void>;
    private indexItem;
    private unindexItem;
    private evictIfNeeded;
    private evictGlobalIfNeeded;
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
/**
 * Create the default in-memory store (no external dependencies).
 */
export declare function createDefaultMemoryStore(options?: InMemoryStoreOptions): MemoryStore;
//# sourceMappingURL=in-memory.store.d.ts.map