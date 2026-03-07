import type { PrismaClient } from './prisma.js';

export interface IdempotencyRecord {
  key: string;
  runId: string;
  nodeId: string;
  outputJson: unknown;
  patchJson: unknown;
}

export class IdempotencyRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async get(key: string): Promise<IdempotencyRecord | null> {
    const row = await this.prisma.flowIdempotency.findUnique({
      where: { key },
    });
    if (!row) return null;
    return {
      key: row.key,
      runId: row.runId,
      nodeId: row.nodeId,
      outputJson: row.outputJson,
      patchJson: row.patchJson,
    };
  }

  async set(
    key: string,
    runId: string,
    nodeId: string,
    outputJson?: unknown,
    patchJson?: unknown
  ): Promise<void> {
    await this.prisma.flowIdempotency.upsert({
      where: { key },
      create: {
        key,
        runId,
        nodeId,
        outputJson: outputJson != null ? (outputJson as object) : undefined,
        patchJson: patchJson != null ? (patchJson as object) : undefined,
      },
      update: {
        outputJson: outputJson != null ? (outputJson as object) : undefined,
        patchJson: patchJson != null ? (patchJson as object) : undefined,
      },
    });
  }
}
