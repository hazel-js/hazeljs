/**
 * Prisma client factory and singleton for @hazeljs/flow
 * Uses its own schema - independent of Hazel core
 */

import { PrismaClient } from './prisma.js';

let flowPrismaInstance: PrismaClient | null = null;

/**
 * Create a Prisma client for the flow schema.
 * Use this when you need a fresh client or want to pass a custom database URL.
 */
export function createFlowPrismaClient(databaseUrl?: string): PrismaClient {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is required. Set it in environment or pass to createFlowPrismaClient().'
    );
  }
  return new PrismaClient({
    datasources: {
      db: { url },
    },
  });
}

/**
 * Get the singleton Prisma client for flow.
 * Uses DATABASE_URL from environment.
 * Call createFlowPrismaClient(url) first if you need to set a custom URL.
 */
export function getFlowPrismaClient(databaseUrl?: string): PrismaClient {
  if (flowPrismaInstance) {
    return flowPrismaInstance;
  }
  flowPrismaInstance = createFlowPrismaClient(databaseUrl);
  return flowPrismaInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetFlowPrismaClient(): void {
  if (flowPrismaInstance) {
    flowPrismaInstance.$disconnect();
    flowPrismaInstance = null;
  }
}
