import Fastify from 'fastify';
import type { FlowEngine } from '@hazeljs/flow';
import { registerRunRoutes } from './routes/runs.js';
import { registerFlowRoutes } from './routes/flows.js';

export async function createServer(engine: FlowEngine, port: number) {
  const app = Fastify({ logger: true });

  await registerRunRoutes(app, engine);
  await registerFlowRoutes(app, engine);

  app.get('/health', async () => ({ status: 'ok' }));

  await app.listen({ port, host: '0.0.0.0' });
  return app;
}
