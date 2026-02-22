import type { PrismaClient } from './prisma.js';
import { FlowRunStatus } from './prisma.js';

export interface FlowRunRow {
  runId: string;
  flowId: string;
  flowVersion: string;
  tenantId: string | null;
  status: FlowRunStatus;
  currentNodeId: string | null;
  inputJson: unknown;
  stateJson: unknown;
  outputsJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRunInput {
  runId: string;
  flowId: string;
  flowVersion: string;
  tenantId?: string | null;
  input: unknown;
  initialState?: Record<string, unknown>;
}

export class FlowRunRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateRunInput): Promise<FlowRunRow> {
    const row = await this.prisma.flowRun.create({
      data: {
        runId: input.runId,
        flowId: input.flowId,
        flowVersion: input.flowVersion,
        tenantId: input.tenantId ?? null,
        status: FlowRunStatus.RUNNING,
        currentNodeId: null,
        inputJson: input.input as object,
        stateJson: (input.initialState ?? {}) as object,
        outputsJson: {} as object,
      },
    });
    return row as FlowRunRow;
  }

  async get(runId: string): Promise<FlowRunRow | null> {
    const row = await this.prisma.flowRun.findUnique({
      where: { runId },
    });
    return row as FlowRunRow | null;
  }

  async update(runId: string, data: Partial<FlowRunRow>): Promise<FlowRunRow> {
    const row = await this.prisma.flowRun.update({
      where: { runId },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.currentNodeId !== undefined && { currentNodeId: data.currentNodeId }),
        ...(data.stateJson !== undefined && { stateJson: data.stateJson as object }),
        ...(data.outputsJson !== undefined && { outputsJson: data.outputsJson as object }),
      },
    });
    return row as FlowRunRow;
  }

  async findRunning(): Promise<FlowRunRow[]> {
    const rows = await this.prisma.flowRun.findMany({
      where: { status: FlowRunStatus.RUNNING },
    });
    return rows as FlowRunRow[];
  }
}
