/**
 * Programmatic API to run the flow runtime with custom flows.
 * Use this from apps (e.g. hazeljs-flow-example) instead of reimplementing the server.
 */
import type { FlowDefinition } from '@hazeljs/flow';
import type { FlowEngine } from '@hazeljs/flow';
import { createFlowEngine } from './engine.js';
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

  const engine: FlowEngine = await createFlowEngine({
    databaseUrl: options.databaseUrl,
    services,
  });

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
