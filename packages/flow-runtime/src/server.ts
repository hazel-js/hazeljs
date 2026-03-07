/**
 * Flow runtime HTTP server using HazelApp
 */
import 'reflect-metadata';
import { HazelApp, HazelModule } from '@hazeljs/core';
import type { FlowEngine } from '@hazeljs/flow';
import { createFlowHandler } from './flow-handler.js';

@HazelModule({ controllers: [], providers: [] })
class FlowRuntimeModule {}

export async function createServer(engine: FlowEngine, port: number): Promise<HazelApp> {
  const app = new HazelApp(FlowRuntimeModule);
  const flowHandler = createFlowHandler(engine);
  app.addProxyHandler('/v1', flowHandler);
  await app.listen(port);
  return app;
}
