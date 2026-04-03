/**
 * @hazeljs/memory — Pluggable user memory with multi-store support
 */
export * from './types/memory-item.types';
export * from './types/category.types';
export * from './types/store.types';
export type { MemoryStore } from './store/memory-store.interface';
export { InMemoryStore, createDefaultMemoryStore, type InMemoryStoreOptions, } from './store/in-memory.store';
export { createMemoryStore, type MemoryStoreConfig } from './store/create-memory-store';
export { CompositeMemoryStore, type CompositeMemoryStoreOptions } from './store/composite.store';
export { PostgresStore, type PostgresStoreOptions } from './store/adapters/postgres.store';
export { RedisStore, type RedisStoreOptions } from './store/adapters/redis.store';
export { VectorEpisodicStore, type VectorEpisodicStoreOptions, type VectorStoreAdapter, } from './store/adapters/vector-episodic.store';
export { MemoryService } from './service/memory.service';
export { DEFAULT_CATEGORY_CONFIG, DEFAULT_MEMORY_SERVICE_CONFIG, getDefaultTtlForCategory, type MemoryServiceConfig, } from './config/memory.config';
//# sourceMappingURL=index.d.ts.map