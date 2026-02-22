import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { FlowEngine } from '@hazeljs/flow';

export async function registerFlowRoutes(app: FastifyInstance, engine: FlowEngine): Promise<void> {
  app.get('/v1/flows', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const list = await engine.listFlows();
      return reply.send(list);
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ error: String(err) });
    }
  });
}
