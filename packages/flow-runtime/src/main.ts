/**
 * Flow runtime - standalone deployable service
 */
import { FlowEngine, createFlowPrismaClient } from '@hazeljs/flow';
import { getConfig } from './config.js';
import { createServiceRegistry } from './services/ServiceRegistry.js';
import { demoFraudFlow, demoSupportFlow } from './flows/index.js';
import { recovery } from './recovery.js';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const config = getConfig();
  const services = createServiceRegistry();

  const prisma = createFlowPrismaClient(config.databaseUrl);
  const engine = new FlowEngine({
    prisma,
    services: { logger: services.logger },
  });

  await engine.registerDefinition(demoFraudFlow);
  await engine.registerDefinition(demoSupportFlow);

  await recovery(engine);

  await createServer(engine, config.port);
  services.logger.info(`Flow runtime listening on port ${config.port}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console -- top-level error handler
  console.error(err);
  process.exit(1);
});
