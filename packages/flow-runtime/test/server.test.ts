import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

  it('creates HazelApp and listens', async () => {
    expect(app).toBeDefined();
    expect(typeof app.close).toBe('function');
  });
});
