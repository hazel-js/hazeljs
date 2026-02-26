import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import type { FlowEngine } from '@hazeljs/flow';
import { createServer } from '../src/server.js';

describe('createServer', () => {
  let app: Awaited<ReturnType<typeof createServer>>;
  const mockEngine = {
    listFlows: async () => [],
    startRun: async () => ({ runId: 'r1', status: 'RUNNING' }),
    resumeRun: async () => ({}),
    getRun: async () => null,
    getTimeline: async () => [],
  } as unknown as FlowEngine;

  beforeAll(async () => {
    app = await createServer(mockEngine, 0);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual({ status: 'ok' });
  });
});
