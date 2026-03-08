/**
 * Prisma-backed memory store for @hazeljs/memory.
 * Import from '@hazeljs/memory/prisma' when you want PostgreSQL persistence with Prisma.
 * Requires @prisma/client and the memory schema applied (migrations).
 */

import type { MemoryStore } from './store/memory-store.interface';
import { PrismaMemoryStore, type PrismaMemoryStoreOptions } from './store/adapters/prisma.store';

export function createPrismaMemoryStore(prisma: PrismaMemoryStoreOptions['prisma']): MemoryStore {
  return new PrismaMemoryStore(prisma);
}

export type { PrismaMemoryStoreOptions } from './store/adapters/prisma.store';
export {
  createMemoryPrismaClient,
  getMemoryPrismaClient,
  resetMemoryPrismaClient,
} from './prisma-client';
export { PrismaClient } from './generated/prisma';
