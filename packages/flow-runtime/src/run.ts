/**
 * Programmatic API to run the flow runtime with custom flows.
 * Use this from apps (e.g. hazeljs-flow-example) instead of reimplementing the server.
 */
import 'reflect-metadata';
import type { FlowDefinition } from '@hazeljs/flow';
import { FlowEngine, createMemoryStorage } from '@hazeljs/flow';
import { createServiceRegistry } from './services/ServiceRegistry.js';
import { recovery } from './recovery.js';
import { createServer } from './server.js';

export interface RunFlowRuntimeOptions {
  /** Port to listen on (default 3000) */
  port?: number;
  /** Postgres URL. If missing or connection fails, uses in-memory storage */
  databaseUrl?: string;
  /** Flow definitions to register */
  flows: FlowDefinition[];
  /** Optional services to inject into flow context (e.g. logger, slack) */
  services?: Record<string, unknown>;
}

/**
 * Start the flow runtime HTTP server (HazelApp) with the given flows.
 * Resolves when the server is listening.
 */
export async function runFlowRuntime(options: RunFlowRuntimeOptions): Promise<void> {
  const port = options.port ?? parseInt(process.env.PORT ?? '3000', 10);
  const services: Record<string, unknown> = (options.services ?? createServiceRegistry()) as Record<
    string,
    unknown
  >;

  let engine: FlowEngine;
  if (options.databaseUrl) {
    try {
      const { createPrismaStorage, createFlowPrismaClient } = await import('@hazeljs/flow/prisma');
      const prisma = createFlowPrismaClient(options.databaseUrl);
      await prisma.$connect();
      engine = new FlowEngine({ storage: createPrismaStorage(prisma), services });
    } catch (err) {
      (services as { logger?: { info: (m: string) => void } }).logger?.info(
        `Database connection failed, using in-memory storage: ${(err as Error).message}`
      );
      engine = new FlowEngine({ storage: createMemoryStorage(), services });
    }
  } else {
    engine = new FlowEngine({ storage: createMemoryStorage(), services });
  }

  for (const def of options.flows) {
    await engine.registerDefinition(def);
  }

  await recovery(engine);

  await createServer(engine, port);
  const logger =
    (services as { logger?: { info: (m: string) => void } }).logger ??
    createServiceRegistry().logger;
  logger.info(`Flow runtime listening on port ${port}`);
}
