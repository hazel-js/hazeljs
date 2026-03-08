/**
 * Prisma client for @hazeljs/memory (generated to src/generated/prisma).
 * Use getMemoryPrismaClient() or pass your own PrismaClient to createPrismaMemoryStore().
 */

import { PrismaClient } from './generated/prisma';

let memoryPrismaInstance: PrismaClient | null = null;

export function createMemoryPrismaClient(databaseUrl?: string): PrismaClient {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is required. Set it in environment or pass to createMemoryPrismaClient().'
    );
  }
  return new PrismaClient({
    datasources: { db: { url } },
  });
}

/**
 * Get or create the default memory Prisma client.
 * Call createMemoryPrismaClient(url) first if you need a custom URL.
 */
export function getMemoryPrismaClient(databaseUrl?: string): PrismaClient {
  if (!memoryPrismaInstance) {
    memoryPrismaInstance = createMemoryPrismaClient(databaseUrl);
  }
  return memoryPrismaInstance;
}

export function resetMemoryPrismaClient(): void {
  if (memoryPrismaInstance) {
    memoryPrismaInstance.$disconnect();
    memoryPrismaInstance = null;
  }
}
