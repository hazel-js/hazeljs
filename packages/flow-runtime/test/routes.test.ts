import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { registerFlowRoutes } from '../src/routes/flows.js';
import type { FlowEngine } from '@hazeljs/flow';

// Import runs routes - they're in a separate file
import * as runsModule from '../src/routes/runs.js';

describe('registerFlowRoutes', () => {
  let app: Awaited<ReturnType<typeof Fastify>>;
  let mockEngine: FlowEngine;

  beforeAll(async () => {
    app = Fastify();
    mockEngine = {
      listFlows: async () => [{ flowId: 'demo-fraud', version: '1.0.0' }],
    } as unknown as FlowEngine;
    await registerFlowRoutes(app, mockEngine);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/flows returns flow list', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/flows' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual([{ flowId: 'demo-fraud', version: '1.0.0' }]);
  });
});

describe('registerRunRoutes', () => {
  let app: Awaited<ReturnType<typeof Fastify>>;
  let mockEngine: FlowEngine;

  beforeAll(async () => {
    app = Fastify();
    mockEngine = {
      startRun: async () => ({ runId: 'run-1', status: 'RUNNING' }),
      resumeRun: async () => ({ runId: 'run-1', status: 'RUNNING', flowId: 'f', flowVersion: '1', outputsJson: {} }),
      getRun: async () => ({ runId: 'run-1', status: 'COMPLETED', flowId: 'f', flowVersion: '1', outputsJson: {} }),
      getTimeline: async () => [],
    } as unknown as FlowEngine;
    await runsModule.registerRunRoutes(app, mockEngine);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /v1/runs/start returns 400 when flowId missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/runs/start',
      payload: { version: '1.0.0' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /v1/runs/start returns 400 when version missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/runs/start',
      payload: { flowId: 'demo-fraud' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /v1/runs/start succeeds with flowId and version', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/runs/start',
      payload: { flowId: 'demo-fraud', version: '1.0.0' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.runId).toBe('run-1');
  });

  it('GET /v1/runs/:runId returns run', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/runs/run-1' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /v1/runs/:runId returns 404 when run not found', async () => {
    const app2 = Fastify();
    const engine404 = { getRun: async () => null } as unknown as FlowEngine;
    await runsModule.registerRunRoutes(app2, engine404);
    const res = await app2.inject({ method: 'GET', url: '/v1/runs/nonexistent' });
    expect(res.statusCode).toBe(404);
    await app2.close();
  });

  it('POST /v1/runs/:runId/resume succeeds', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/runs/run-1/resume',
      payload: { payload: { approved: true } },
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /v1/runs/:runId/timeline returns timeline', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/runs/run-1/timeline' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual([]);
  });
});
