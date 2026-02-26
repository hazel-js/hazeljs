import { describe, it, expect, vi } from 'vitest';
import type { FlowEngine } from '@hazeljs/flow';
import { createFlowHandler } from '../src/flow-handler.js';

function createMockReq(method: string, url: string, body?: unknown): IncomingMessage & { body?: unknown } {
  const req = {
    method,
    url,
    body,
    on: vi.fn(),
    once: vi.fn(),
  };
  return req as unknown as IncomingMessage & { body?: unknown };
}

function createMockRes(): { statusCode: number; headers: Record<string, string>; body: string; writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> } {
  const chunks: string[] = [];
  const res = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    get body() {
      return chunks.join('');
    },
    writeHead: vi.fn((code: number, h?: Record<string, string>) => {
      res.statusCode = code;
      if (h) Object.assign(res.headers, h);
    }),
    end: vi.fn((chunk?: string) => {
      if (chunk) chunks.push(chunk);
    }),
  };
  return res;
}

type IncomingMessage = import('http').IncomingMessage;

describe('createFlowHandler', () => {
  const mockContext = { method: 'GET', url: '/', headers: {}, params: {}, query: {}, body: {} };

  it('GET /v1/flows returns flow list', async () => {
    const mockEngine = {
      listFlows: async () => [{ flowId: 'demo-fraud', version: '1.0.0' }],
    } as unknown as FlowEngine;
    const handler = createFlowHandler(mockEngine);
    const req = createMockReq('GET', '/v1/flows');
    const res = createMockRes();

    const handled = await handler(req, res as unknown as import('http').ServerResponse, mockContext);

    expect(handled).toBe(true);
    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalled();
    expect(JSON.parse(res.body)).toEqual([{ flowId: 'demo-fraud', version: '1.0.0' }]);
  });

  it('POST /v1/runs/start returns 400 when flowId missing', async () => {
    const mockEngine = {} as FlowEngine;
    const handler = createFlowHandler(mockEngine);
    const req = createMockReq('POST', '/v1/runs/start', { version: '1.0.0' });
    const res = createMockRes();

    const handled = await handler(req, res as unknown as import('http').ServerResponse, mockContext);

    expect(handled).toBe(true);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ error: 'flowId and version are required' });
  });

  it('POST /v1/runs/start returns 400 when version missing', async () => {
    const mockEngine = {} as FlowEngine;
    const handler = createFlowHandler(mockEngine);
    const req = createMockReq('POST', '/v1/runs/start', { flowId: 'demo-fraud' });
    const res = createMockRes();

    const handled = await handler(req, res as unknown as import('http').ServerResponse, mockContext);

    expect(handled).toBe(true);
    expect(res.statusCode).toBe(400);
  });

  it('POST /v1/runs/start succeeds with flowId and version', async () => {
    const mockEngine = {
      startRun: async () => ({ runId: 'run-1', status: 'RUNNING' }),
    } as unknown as FlowEngine;
    const handler = createFlowHandler(mockEngine);
    const req = createMockReq('POST', '/v1/runs/start', { flowId: 'demo-fraud', version: '1.0.0' });
    const res = createMockRes();

    const handled = await handler(req, res as unknown as import('http').ServerResponse, mockContext);

    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).runId).toBe('run-1');
  });

  it('GET /v1/runs/:runId returns run', async () => {
    const mockEngine = {
      getRun: async () => ({ runId: 'run-1', status: 'COMPLETED', flowId: 'f', flowVersion: '1', outputsJson: {} }),
    } as unknown as FlowEngine;
    const handler = createFlowHandler(mockEngine);
    const req = createMockReq('GET', '/v1/runs/run-1');
    const res = createMockRes();

    const handled = await handler(req, res as unknown as import('http').ServerResponse, mockContext);

    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).runId).toBe('run-1');
  });

  it('GET /v1/runs/:runId returns 404 when run not found', async () => {
    const mockEngine = { getRun: async () => null } as unknown as FlowEngine;
    const handler = createFlowHandler(mockEngine);
    const req = createMockReq('GET', '/v1/runs/nonexistent');
    const res = createMockRes();

    const handled = await handler(req, res as unknown as import('http').ServerResponse, mockContext);

    expect(handled).toBe(true);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body)).toEqual({ error: 'Run not found' });
  });

  it('POST /v1/runs/:runId/resume succeeds', async () => {
    const mockEngine = {
      resumeRun: async () => ({ runId: 'run-1', status: 'RUNNING', flowId: 'f', flowVersion: '1', outputsJson: {} }),
    } as unknown as FlowEngine;
    const handler = createFlowHandler(mockEngine);
    const req = createMockReq('POST', '/v1/runs/run-1/resume', { payload: { approved: true } });
    const res = createMockRes();

    const handled = await handler(req, res as unknown as import('http').ServerResponse, mockContext);

    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
  });

  it('GET /v1/runs/:runId/timeline returns timeline', async () => {
    const mockEngine = { getTimeline: async () => [] } as unknown as FlowEngine;
    const handler = createFlowHandler(mockEngine);
    const req = createMockReq('GET', '/v1/runs/run-1/timeline');
    const res = createMockRes();

    const handled = await handler(req, res as unknown as import('http').ServerResponse, mockContext);

    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
  });

  it('returns false for non-handled paths', async () => {
    const mockEngine = {} as FlowEngine;
    const handler = createFlowHandler(mockEngine);
    const req = createMockReq('GET', '/other');
    const res = createMockRes();

    const handled = await handler(req, res as unknown as import('http').ServerResponse, mockContext);

    expect(handled).toBe(false);
  });
});
