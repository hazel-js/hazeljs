import type { PrismaClient } from './prisma.js';
import type { FlowEventType, FlowRunEventPayload } from '../types/Events.js';

export class FlowEventRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async append(
    runId: string,
    type: FlowEventType,
    payload: FlowRunEventPayload = {}
  ): Promise<void> {
    await this.prisma.flowRunEvent.create({
      data: {
        runId,
        type,
        nodeId: payload.nodeId ?? null,
        attempt: payload.attempt ?? null,
        payloadJson: payload as object,
      },
    });
  }

  async getTimeline(runId: string): Promise<Array<{ at: Date; type: string; nodeId: string | null; attempt: number | null; payloadJson: unknown }>> {
    const rows = await this.prisma.flowRunEvent.findMany({
      where: { runId },
      orderBy: { at: 'asc' },
    });
    return rows.map((r) => ({
      at: r.at,
      type: r.type,
      nodeId: r.nodeId,
      attempt: r.attempt,
      payloadJson: r.payloadJson,
    }));
  }
}
