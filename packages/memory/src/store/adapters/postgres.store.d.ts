/**
 * PostgreSQL memory store adapter.
 * Pass a pool (e.g. from "pg") so this package has no direct pg dependency.
 */
import { MemoryItem } from '../../types/memory-item.types';
import { MemoryQuery, MemoryStats, PruneOptions } from '../../types/store.types';
import { MemoryStore } from '../memory-store.interface';
export interface PostgresStoreOptions {
  /** A pool-like client with query(sql, params?) returning rows and optional rowCount. */
  pool: {
    query: (
      sql: string,
      params?: unknown[]
    ) => Promise<{
      rows: unknown[];
      rowCount?: number;
    }>;
  };
  /** Table name. Default: memory_items. */
  tableName?: string;
}
/**
 * PostgreSQL-backed memory store. Create table with:
 * CREATE TABLE memory_items (
 *   id TEXT PRIMARY KEY,
 *   user_id TEXT NOT NULL,
 *   category TEXT NOT NULL,
 *   key TEXT NOT NULL,
 *   value TEXT NOT NULL,
 *   confidence REAL NOT NULL,
 *   source TEXT NOT NULL,
 *   evidence TEXT NOT NULL,
 *   created_at TIMESTAMPTZ NOT NULL,
 *   updated_at TIMESTAMPTZ NOT NULL,
 *   expires_at TIMESTAMPTZ,
 *   access_count INTEGER NOT NULL DEFAULT 0,
 *   session_id TEXT
 * );
 * CREATE INDEX idx_memory_items_user_category ON memory_items(user_id, category);
 * CREATE INDEX idx_memory_items_expires ON memory_items(expires_at) WHERE expires_at IS NOT NULL;
 */
export declare class PostgresStore implements MemoryStore {
  private readonly pool;
  private readonly table;
  private initialized;
  constructor(options: PostgresStoreOptions);
  initialize(): Promise<void>;
  save(item: MemoryItem): Promise<string>;
  saveBatch(items: MemoryItem[]): Promise<string[]>;
  get(id: string): Promise<MemoryItem | null>;
  update(id: string, updates: Partial<MemoryItem>): Promise<void>;
  delete(id: string): Promise<void>;
  deleteBatch(ids: string[]): Promise<void>;
  query(options: MemoryQuery): Promise<MemoryItem[]>;
  getStats(userId?: string): Promise<MemoryStats>;
  prune(options?: PruneOptions): Promise<number>;
}
//# sourceMappingURL=postgres.store.d.ts.map
