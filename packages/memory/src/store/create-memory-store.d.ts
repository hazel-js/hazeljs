/**
 * Factory for creating a MemoryStore from config (default: in-memory).
 */
import { MemoryStore } from './memory-store.interface';
import { InMemoryStoreOptions } from './in-memory.store';
import { CompositeMemoryStoreOptions } from './composite.store';
import { PostgresStoreOptions } from './adapters/postgres.store';
import { RedisStoreOptions } from './adapters/redis.store';
export type MemoryStoreConfig =
  | {
      type: 'in-memory';
      options?: InMemoryStoreOptions;
    }
  | {
      type: 'postgres';
      options: PostgresStoreOptions;
    }
  | {
      type: 'redis';
      options: RedisStoreOptions;
    }
  | {
      type: 'composite';
      options: CompositeMemoryStoreOptions;
    };
/**
 * Create a MemoryStore from config. Default type is 'in-memory'.
 */
export declare function createMemoryStore(config?: MemoryStoreConfig): MemoryStore;
//# sourceMappingURL=create-memory-store.d.ts.map
