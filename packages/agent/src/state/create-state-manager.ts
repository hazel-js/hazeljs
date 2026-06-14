/**
 * Factory helpers for agent state persistence backends.
 */

import { AgentStateManager } from './agent.state';
import { IAgentStateManager } from './agent-state.interface';
import { RedisStateManager } from './redis-state.manager';
import { DatabaseStateManager } from './database-state.manager';
import type { PrismaClientLike, RedisClientLike } from './redis-client.types';

export type AgentStateBackend = 'memory' | 'redis' | 'database';

export interface CreateStateManagerOptions {
  /** Override AGENT_STATE_BACKEND env (memory | redis | database) */
  backend?: AgentStateBackend;
  /** Pre-connected Redis client (required for redis backend unless redisUrl is set) */
  redisClient?: RedisClientLike;
  /** Connect to Redis via URL (async factory only) */
  redisUrl?: string;
  /** Prisma client for database backend */
  prismaClient?: PrismaClientLike;
}

function resolveBackend(options?: CreateStateManagerOptions): AgentStateBackend {
  const fromEnv = process.env.AGENT_STATE_BACKEND?.toLowerCase();
  if (options?.backend) {
    return options.backend;
  }
  if (fromEnv === 'redis' || fromEnv === 'database' || fromEnv === 'memory') {
    return fromEnv;
  }
  if (options?.redisClient || options?.redisUrl || process.env.REDIS_URL) {
    return 'redis';
  }
  if (options?.prismaClient) {
    return 'database';
  }
  return 'memory';
}

/**
 * Create a state manager synchronously (memory, or redis/database when client is provided).
 */
export function createStateManager(options: CreateStateManagerOptions = {}): IAgentStateManager {
  const backend = resolveBackend(options);

  switch (backend) {
    case 'redis': {
      const client = options.redisClient;
      if (!client) {
        throw new Error(
          'Redis state backend requires redisClient. Use createStateManagerAsync() with redisUrl or pass redisClient explicitly.'
        );
      }
      return new RedisStateManager({ client });
    }
    case 'database': {
      const client = options.prismaClient;
      if (!client) {
        throw new Error('Database state backend requires prismaClient.');
      }
      return new DatabaseStateManager({ client });
    }
    case 'memory':
    default:
      return new AgentStateManager();
  }
}

/**
 * Create a state manager from environment (REDIS_URL, AGENT_STATE_BACKEND).
 * Falls back to in-memory when Redis is unavailable.
 */
export async function createStateManagerFromEnv(
  options: CreateStateManagerOptions = {}
): Promise<IAgentStateManager> {
  const backend = resolveBackend(options);

  if (backend === 'redis') {
    const client =
      options.redisClient ??
      (await createRedisClientFromUrl(options.redisUrl ?? process.env.REDIS_URL));
    return new RedisStateManager({ client });
  }

  if (backend === 'database') {
    if (!options.prismaClient) {
      throw new Error('Database state backend requires prismaClient in options.');
    }
    return new DatabaseStateManager({ client: options.prismaClient });
  }

  return new AgentStateManager();
}

/**
 * Resolve runtime state manager: explicit config wins, then env-based factory, then memory.
 */
export function resolveStateManager(
  explicit?: IAgentStateManager,
  options?: CreateStateManagerOptions
): IAgentStateManager {
  if (explicit) {
    return explicit;
  }
  try {
    return createStateManager(options ?? {});
  } catch {
    return new AgentStateManager();
  }
}

async function createRedisClientFromUrl(url: string | undefined): Promise<RedisClientLike> {
  if (!url) {
    throw new Error('REDIS_URL is required for Redis state backend.');
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redisModule = (await import('redis' as string)) as any;
    const client = redisModule.createClient({ url });
    await client.connect();
    return client as RedisClientLike;
  } catch (error) {
    throw new Error(
      `Failed to connect Redis for agent state: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
