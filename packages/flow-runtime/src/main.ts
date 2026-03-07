/**
 * Flow runtime - standalone deployable service (default demo flows)
 */
/// <reference types="node" />
import 'reflect-metadata';
import { getConfig } from './config.js';
import { createServiceRegistry } from './services/ServiceRegistry.js';
import { demoFraudFlow, demoSupportFlow } from './flows/index.js';
import { runFlowRuntime } from './run.js';

async function main(): Promise<void> {
  const config = getConfig();
  const services = createServiceRegistry();

  await runFlowRuntime({
    port: config.port,
    databaseUrl: config.databaseUrl,
    flows: [demoFraudFlow, demoSupportFlow],
    services: { logger: services.logger },
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console -- top-level error handler
  console.error(err);
  process.exit(1);
});
