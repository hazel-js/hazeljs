import { FlowEngine, createMemoryStorage } from '@hazeljs/flow';

export interface CreateFlowEngineOptions {
  databaseUrl?: string;
  services?: Record<string, unknown>;
}

/** Create a FlowEngine with Prisma storage when databaseUrl is set, otherwise in-memory. */
export async function createFlowEngine(options: CreateFlowEngineOptions = {}): Promise<FlowEngine> {
  const services = options.services ?? {};

  if (options.databaseUrl) {
    try {
      const { createPrismaStorage, createFlowPrismaClient } = await import('@hazeljs/flow/prisma');
      const prisma = createFlowPrismaClient(options.databaseUrl);
      await prisma.$connect();
      return new FlowEngine({ storage: createPrismaStorage(prisma), services });
    } catch (err) {
      // eslint-disable-next-line no-console -- startup fallback
      console.warn(
        `Flow engine: database unavailable, using memory (${(err as Error).message})`
      );
    }
  }

  return new FlowEngine({ storage: createMemoryStorage(), services });
}
