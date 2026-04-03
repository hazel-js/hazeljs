/**
 * Redis memory store adapter.
 * Pass a Redis client (e.g. from "ioredis") so this package has no direct redis dependency.
 */
import { MemoryItem } from '../../types/memory-item.types';
import { MemoryQuery, MemorySearchOptions, MemoryStats, PruneOptions } from '../../types/store.types';
import { MemoryStore } from '../memory-store.interface';
export interface RedisStoreOptions {
    /** Redis client with get, set, del, sadd, smembers, srem, keys (or scan), mget. */
    client: {
        get(key: string): Promise<string | null>;
        set(key: string, value: string, ...args: string[]): Promise<unknown>;
        del(...keys: string[]): Promise<number>;
        sadd(key: string, ...members: string[]): Promise<number>;
        smembers(key: string): Promise<string[]>;
        srem(key: string, ...members: string[]): Promise<number>;
        mget(...keys: string[]): Promise<(string | null)[]>;
        keys(pattern: string): Promise<string[]>;
    };
    /** Key prefix. Default: memory */
    keyPrefix?: string;
    /** Default TTL in seconds for keys with expiresAt (emotional). */
    defaultTtlSeconds?: number;
}
export declare class RedisStore implements MemoryStore {
    private readonly client;
    private readonly prefix;
    private readonly defaultTtlSeconds;
    constructor(options: RedisStoreOptions);
    initialize(): Promise<void>;
    private serialize;
    private static deserialize;
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
//# sourceMappingURL=redis.store.d.ts.map