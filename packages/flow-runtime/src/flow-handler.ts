/**
 * Flow API handler for HazelApp proxy - handles /v1/* routes
 */
import type { IncomingMessage, ServerResponse } from 'http';
import type { RequestContext } from '@hazeljs/core';
import type { FlowEngine } from '@hazeljs/flow';

interface StartBody {
  flowId: string;
  version: string;
  tenantId?: string;
  input?: unknown;
  initialState?: Record<string, unknown>;
}

interface ResumeBody {
  payload?: unknown;
}

function writeJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function extractRunId(pathname: string): string | null {
  const match = pathname.match(/^\/v1\/runs\/([^/]+)(?:\/|$)/);
  return match ? match[1] : null;
}

export function createFlowHandler(engine: FlowEngine) {
  return async function flowHandler(
    req: IncomingMessage & { body?: unknown; params?: Record<string, string> },
    res: ServerResponse,
    _context: RequestContext
  ): Promise<boolean> {
    const pathname = (req.url || '/').split('?')[0];
    const method = req.method || 'GET';

    // POST /v1/runs/start
    if (method === 'POST' && pathname === '/v1/runs/start') {
      const body = req.body as StartBody | undefined;
      const { flowId, version, tenantId, input, initialState } = body ?? {};
      if (!flowId || !version) {
        writeJson(res, 400, { error: 'flowId and version are required' });
        return true;
      }
      try {
        const result = await engine.startRun({
          flowId,
          version,
          tenantId,
          input: input ?? {},
          initialState,
        });
        writeJson(res, 200, result);
      } catch (err) {
        console.error(err);
        writeJson(res, 500, { error: String(err) });
      }
      return true;
    }

    // POST /v1/runs/:runId/resume
    if (method === 'POST' && pathname.match(/^\/v1\/runs\/[^/]+\/resume$/)) {
      const runId = extractRunId(pathname);
      if (!runId) {
        writeJson(res, 400, { error: 'runId is required' });
        return true;
      }
      const body = req.body as ResumeBody | undefined;
      const { payload } = body ?? {};
      try {
        const run = await engine.resumeRun(runId, payload);
        writeJson(res, 200, {
          runId: run.runId,
          status: run.status,
          flowId: run.flowId,
          flowVersion: run.flowVersion,
          outputsJson: run.outputsJson,
        });
      } catch (err) {
        console.error(err);
        writeJson(res, 500, { error: String(err) });
      }
      return true;
    }

    // GET /v1/runs/:runId
    if (method === 'GET' && pathname.match(/^\/v1\/runs\/[^/]+$/)) {
      const runId = extractRunId(pathname);
      if (!runId) {
        writeJson(res, 400, { error: 'runId is required' });
        return true;
      }
      try {
        const run = await engine.getRun(runId);
        if (!run) {
          writeJson(res, 404, { error: 'Run not found' });
          return true;
        }
        writeJson(res, 200, run);
      } catch (err) {
        console.error(err);
        writeJson(res, 500, { error: String(err) });
      }
      return true;
    }

    // GET /v1/runs/:runId/timeline
    if (method === 'GET' && pathname.match(/^\/v1\/runs\/[^/]+\/timeline$/)) {
      const runId = extractRunId(pathname);
      if (!runId) {
        writeJson(res, 400, { error: 'runId is required' });
        return true;
      }
      try {
        const timeline = await engine.getTimeline(runId);
        writeJson(res, 200, timeline);
      } catch (err) {
        console.error(err);
        writeJson(res, 500, { error: String(err) });
      }
      return true;
    }

    // GET /v1/flows
    if (method === 'GET' && pathname === '/v1/flows') {
      try {
        const list = await engine.listFlows();
        writeJson(res, 200, list);
      } catch (err) {
        console.error(err);
        writeJson(res, 500, { error: String(err) });
      }
      return true;
    }

    return false;
  };
}
