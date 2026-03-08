/**
 * Factory for creating a MemoryStore from config (default: in-memory).
 */

import { MemoryStore } from './memory-store.interface';
import { createDefaultMemoryStore, InMemoryStoreOptions } from './in-memory.store';
import { CompositeMemoryStore, CompositeMemoryStoreOptions } from './composite.store';
import { PostgresStore, PostgresStoreOptions } from './adapters/postgres.store';
import { RedisStore, RedisStoreOptions } from './adapters/redis.store';

export type MemoryStoreConfig =
  | { type: 'in-memory'; options?: InMemoryStoreOptions }
  | { type: 'postgres'; options: PostgresStoreOptions }
  | { type: 'redis'; options: RedisStoreOptions }
  | { type: 'composite'; options: CompositeMemoryStoreOptions };

/**
 * Create a MemoryStore from config. Default type is 'in-memory'.
 */
export function createMemoryStore(config?: MemoryStoreConfig): MemoryStore {
  if (!config || config.type === 'in-memory') {
    return createDefaultMemoryStore(config?.type === 'in-memory' ? config.options : undefined);
  }
  if (config.type === 'postgres') {
    return new PostgresStore(config.options);
  }
  if (config.type === 'redis') {
    return new RedisStore(config.options);
  }
  if (config.type === 'composite') {
    return new CompositeMemoryStore(config.options);
  }
  return createDefaultMemoryStore();
}
