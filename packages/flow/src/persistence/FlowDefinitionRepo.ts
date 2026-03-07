import type { PrismaClient } from './prisma.js';
import type { FlowDefinition } from '../types/FlowTypes.js';
import { toSerializable } from './serialize.js';

export class FlowDefinitionRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async save(def: FlowDefinition): Promise<void> {
    const serializable = toSerializable(def);
    await this.prisma.flowDefinition.upsert({
      where: {
        flowId_version: { flowId: def.flowId, version: def.version },
      },
      create: {
        flowId: def.flowId,
        version: def.version,
        definitionJson: serializable as object,
      },
      update: {
        definitionJson: serializable as object,
      },
    });
  }

  async get(flowId: string, version: string): Promise<FlowDefinition | null> {
    const row = await this.prisma.flowDefinition.findUnique({
      where: { flowId_version: { flowId, version } },
    });
    if (!row) return null;
    return row.definitionJson as unknown as FlowDefinition;
  }

  async list(): Promise<Array<{ flowId: string; version: string; definitionJson: unknown }>> {
    const rows = await this.prisma.flowDefinition.findMany({
      orderBy: [{ flowId: 'asc' }, { version: 'asc' }],
    });
    return rows.map((r) => ({
      flowId: r.flowId,
      version: r.version,
      definitionJson: r.definitionJson,
    }));
  }
}
