import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
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

export async function registerRunRoutes(app: FastifyInstance, engine: FlowEngine): Promise<void> {
  app.post<{ Body: StartBody }>('/v1/runs/start', async (req: FastifyRequest<{ Body: StartBody }>, reply: FastifyReply) => {
    const { flowId, version, tenantId, input, initialState } = req.body;
    if (!flowId || !version) {
      return reply.status(400).send({ error: 'flowId and version are required' });
    }
    try {
      const result = await engine.startRun({
        flowId,
        version,
        tenantId,
        input: input ?? {},
        initialState,
      });
      return reply.send(result);
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ error: String(err) });
    }
  });

  app.post<{ Params: { runId: string }; Body: ResumeBody }>(
    '/v1/runs/:runId/resume',
    async (req: FastifyRequest<{ Params: { runId: string }; Body: ResumeBody }>, reply: FastifyReply) => {
      const { runId } = req.params;
      const { payload } = req.body ?? {};
      try {
        const run = await engine.resumeRun(runId, payload);
        return reply.send({
          runId: run.runId,
          status: run.status,
          flowId: run.flowId,
          flowVersion: run.flowVersion,
          outputsJson: run.outputsJson,
        });
      } catch (err) {
        req.log.error(err);
        return reply.status(500).send({ error: String(err) });
      }
    }
  );

  app.get<{ Params: { runId: string } }>('/v1/runs/:runId', async (req: FastifyRequest<{ Params: { runId: string } }>, reply: FastifyReply) => {
    const { runId } = req.params;
    try {
      const run = await engine.getRun(runId);
      if (!run) {
        return reply.status(404).send({ error: 'Run not found' });
      }
      return reply.send(run);
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ error: String(err) });
    }
  });

  app.get<{ Params: { runId: string } }>('/v1/runs/:runId/timeline', async (req: FastifyRequest<{ Params: { runId: string } }>, reply: FastifyReply) => {
    const { runId } = req.params;
    try {
      const timeline = await engine.getTimeline(runId);
      return reply.send(timeline);
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ error: String(err) });
    }
  });
}
