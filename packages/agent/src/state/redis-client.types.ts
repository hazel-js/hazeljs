/**
 * Minimal Redis client surface used by agent state and approval stores.
 */
export interface RedisClientLike {
  setEx(key: string, seconds: number, value: string): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  expire(key: string, seconds: number): Promise<number>;
  sAdd(key: string, member: string): Promise<number>;
  sMembers(key: string): Promise<string[]>;
  sRem(key: string, member: string): Promise<number>;
}

/** Minimal Prisma delegate for agent context persistence. */
export interface PrismaAgentContextDelegate {
  create: (args: unknown) => Promise<unknown>;
  findUnique: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
  delete: (args: unknown) => Promise<unknown>;
  updateMany: (args: unknown) => Promise<unknown>;
  deleteMany: (args: unknown) => Promise<unknown>;
  findMany: (args: unknown) => Promise<unknown[]>;
}

/**
 * Minimal Prisma client surface for DatabaseStateManager factory helpers.
 */
export interface PrismaClientLike {
  agentContext: PrismaAgentContextDelegate;
  agentExecution?: {
    create: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
  };
}
