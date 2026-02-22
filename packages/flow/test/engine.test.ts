import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { FlowEngine, Flow, Entry, Node, Edge, buildFlowDefinition, createFlowPrismaClient, resetFlowPrismaClient } from '../src/index.js';
import type { FlowContext, NodeResult } from '../src/index.js';

@Flow('linear-flow', '1.0.0')
class LinearFlow {
  @Entry()
  @Node('a')
  @Edge('b')
  async a(): Promise<NodeResult> {
    return { status: 'ok', output: 1, patch: { x: 1 } };
  }

  @Node('b')
  @Edge('c')
  async b(ctx: FlowContext): Promise<NodeResult> {
    return { status: 'ok', output: 2, patch: { y: (ctx.state.x as number) + 1 } };
  }

  @Node('c')
  async c(ctx: FlowContext): Promise<NodeResult> {
    return { status: 'ok', output: ctx.state };
  }
}

describe('FlowEngine - linear flow', () => {
  let engine: FlowEngine;

  beforeAll(async () => {
    const prisma = createFlowPrismaClient();
    await prisma.$executeRawUnsafe('TRUNCATE "FlowRunEvent", "FlowIdempotency", "FlowRun", "FlowDefinition" CASCADE');
    await prisma.$disconnect();
  });

  afterEach(() => {
    resetFlowPrismaClient();
  });

  it('completes a simple linear flow', async () => {
    engine = new FlowEngine();
    const def = buildFlowDefinition(LinearFlow);

    await engine.registerDefinition(def);

    const { runId } = await engine.startRun({
      flowId: 'linear-flow',
      version: '1.0.0',
      input: {},
    });

    let run = await engine.getRun(runId);
    while (run?.status === 'RUNNING') {
      run = await engine.tick(runId);
    }

    expect(run?.status).toBe('COMPLETED');
    expect(run?.outputsJson).toEqual({ a: 1, b: 2, c: { x: 1, y: 2 } });
  });
});
