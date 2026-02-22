import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { FlowEngine, Flow, Entry, Node, Edge, buildFlowDefinition, createFlowPrismaClient, resetFlowPrismaClient } from '../src/index.js';
import type { FlowContext, NodeResult } from '../src/index.js';

@Flow('branch-flow', '1.0.0')
class BranchFlow {
  @Entry()
  @Node('check')
  @Edge('pass', (ctx: FlowContext) => (ctx.state.score as number) >= 60, 1)
  @Edge('fail', (ctx: FlowContext) => (ctx.state.score as number) < 60, 1)
  async check(ctx: FlowContext): Promise<NodeResult> {
    return { status: 'ok', output: null, patch: { score: (ctx.input as { score: number }).score } };
  }

  @Node('pass')
  async pass(): Promise<NodeResult> {
    return { status: 'ok', output: 'pass' };
  }

  @Node('fail')
  async fail(): Promise<NodeResult> {
    return { status: 'ok', output: 'fail' };
  }
}

@Flow('ambiguous-flow', '1.0.0')
class AmbiguousFlow {
  @Entry()
  @Node('a')
  @Edge('b', () => true, 1)
  @Edge('c', () => true, 1)
  async a(): Promise<NodeResult> {
    return { status: 'ok', output: 1 };
  }

  @Node('b')
  async b(): Promise<NodeResult> {
    return { status: 'ok', output: 'b' };
  }

  @Node('c')
  async c(): Promise<NodeResult> {
    return { status: 'ok', output: 'c' };
  }
}

describe('FlowEngine - branching', () => {
  let engine: FlowEngine;

  beforeAll(async () => {
    const prisma = createFlowPrismaClient();
    await prisma.$executeRawUnsafe('TRUNCATE "FlowRunEvent", "FlowIdempotency", "FlowRun", "FlowDefinition" CASCADE');
    await prisma.$disconnect();
  });

  afterEach(() => {
    resetFlowPrismaClient();
  });

  it('chooses correct edge based on when()', async () => {
    engine = new FlowEngine();
    const def = buildFlowDefinition(BranchFlow);

    await engine.registerDefinition(def);

    const { runId: runIdPass } = await engine.startRun({
      flowId: 'branch-flow',
      version: '1.0.0',
      input: { score: 70 },
    });
    let run = await engine.getRun(runIdPass);
    while (run?.status === 'RUNNING') {
      run = await engine.tick(runIdPass);
    }
    expect(run?.status).toBe('COMPLETED');
    expect(run?.outputsJson).toMatchObject({ pass: 'pass' });

    const { runId: runIdFail } = await engine.startRun({
      flowId: 'branch-flow',
      version: '1.0.0',
      input: { score: 50 },
    });
    run = await engine.getRun(runIdFail);
    while (run?.status === 'RUNNING') {
      run = await engine.tick(runIdFail);
    }
    expect(run?.status).toBe('COMPLETED');
    expect(run?.outputsJson).toMatchObject({ fail: 'fail' });
  });

  it('fails with AMBIGUOUS_EDGE when multiple edges match at same priority', async () => {
    engine = new FlowEngine();
    const def = buildFlowDefinition(AmbiguousFlow);

    await engine.registerDefinition(def);

    const { runId } = await engine.startRun({
      flowId: 'ambiguous-flow',
      version: '1.0.0',
      input: {},
    });

    let run = await engine.getRun(runId);
    while (run?.status === 'RUNNING') {
      run = await engine.tick(runId);
    }

    expect(run?.status).toBe('FAILED');
    const timeline = await engine.getTimeline(runId);
    const abortEvent = timeline.find((e) => e.type === 'RUN_ABORTED');
    expect(abortEvent?.payloadJson).toMatchObject({ error: { code: 'AMBIGUOUS_EDGE' } });
  });
});
