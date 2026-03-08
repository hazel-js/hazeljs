/**
 * @hazeljs/memory — Pluggable user memory with multi-store support
 */

// Types
export * from './types/memory-item.types';
export * from './types/category.types';
export * from './types/store.types';

// Store interface
export type { MemoryStore } from './store/memory-store.interface';

// Default in-memory store
export {
  InMemoryStore,
  createDefaultMemoryStore,
  type InMemoryStoreOptions,
} from './store/in-memory.store';

// Store factory
export {
  createMemoryStore,
  type MemoryStoreConfig,
} from './store/create-memory-store';

// Composite store
export {
  CompositeMemoryStore,
  type CompositeMemoryStoreOptions,
} from './store/composite.store';

// Adapters
export { PostgresStore, type PostgresStoreOptions } from './store/adapters/postgres.store';
export { RedisStore, type RedisStoreOptions } from './store/adapters/redis.store';
export {
  VectorEpisodicStore,
  type VectorEpisodicStoreOptions,
  type VectorStoreAdapter,
} from './store/adapters/vector-episodic.store';

// Service
export { MemoryService } from './service/memory.service';

// Config
export {
  DEFAULT_CATEGORY_CONFIG,
  DEFAULT_MEMORY_SERVICE_CONFIG,
  getDefaultTtlForCategory,
  type MemoryServiceConfig,
} from './config/memory.config';
