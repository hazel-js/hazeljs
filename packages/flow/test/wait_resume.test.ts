import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { FlowEngine, Flow, Entry, Node, Edge, buildFlowDefinition, createFlowPrismaClient, resetFlowPrismaClient } from '../src/index.js';
import type { FlowContext, NodeResult } from '../src/index.js';

@Flow('wait-flow', '1.0.0')
class WaitFlow {
  @Entry()
  @Node('waitNode')
  @Edge('done')
  async waitNode(ctx: FlowContext): Promise<NodeResult> {
    const payload = (ctx.state as { _resumePayload?: { value: number } })._resumePayload;
    if (payload) {
      return { status: 'ok', output: payload.value, patch: { resumed: true } };
    }
    return { status: 'wait', reason: 'awaiting_input' };
  }

  @Node('done')
  async done(ctx: FlowContext): Promise<NodeResult> {
    return { status: 'ok', output: ctx.outputs };
  }
}

describe('FlowEngine - wait/resume', () => {
  let engine: FlowEngine;

  beforeAll(async () => {
    const prisma = createFlowPrismaClient();
    await prisma.$executeRawUnsafe('TRUNCATE "FlowRunEvent", "FlowIdempotency", "FlowRun", "FlowDefinition" CASCADE');
    await prisma.$disconnect();
  });

  afterEach(() => {
    resetFlowPrismaClient();
  });

  it('stops at WAIT and resumes with payload', async () => {
    engine = new FlowEngine();
    const def = buildFlowDefinition(WaitFlow);

    await engine.registerDefinition(def);

    const { runId } = await engine.startRun({
      flowId: 'wait-flow',
      version: '1.0.0',
      input: {},
    });

    let run = await engine.getRun(runId);
    while (run?.status === 'RUNNING') {
      run = await engine.tick(runId);
    }

    expect(run?.status).toBe('WAITING');

    run = await engine.resumeRun(runId, { value: 42 });
    while (run?.status === 'RUNNING') {
      run = await engine.tick(runId);
    }

    expect(run?.status).toBe('COMPLETED');
    expect(run?.outputsJson).toMatchObject({ waitNode: 42 });
  });
});
