import { IApprovalStore } from './approval-store.interface';
import { InMemoryApprovalStore } from './in-memory-approval.store';
import { RedisApprovalStore } from './redis-approval.store';
import type { RedisClientLike } from '../state/redis-client.types';

export interface CreateApprovalStoreOptions {
  redisClient?: RedisClientLike;
  useRedis?: boolean;
}

export function createApprovalStore(options: CreateApprovalStoreOptions = {}): IApprovalStore {
  if (options.useRedis || options.redisClient) {
    if (!options.redisClient) {
      throw new Error('redisClient is required when useRedis is enabled for approval store.');
    }
    return new RedisApprovalStore({ client: options.redisClient });
  }
  return new InMemoryApprovalStore();
}
