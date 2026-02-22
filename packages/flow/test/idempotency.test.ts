import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { FlowEngine, Flow, Entry, Node, Edge, buildFlowDefinition, createFlowPrismaClient, resetFlowPrismaClient } from '../src/index.js';
import type { FlowContext, NodeResult } from '../src/index.js';

let sideEffectCount = 0;

@Flow('idempotent-flow', '1.0.0')
class IdempotentFlow {
  @Entry()
  @Node('sideEffect', { idempotencyKey: (ctx: FlowContext) => `run:${ctx.runId}:node:sideEffect` })
  @Edge('b')
  async sideEffect(): Promise<NodeResult> {
    sideEffectCount++;
    return { status: 'ok', output: { count: sideEffectCount } };
  }

  @Node('b')
  async b(ctx: FlowContext): Promise<NodeResult> {
    return { status: 'ok', output: ctx.outputs.sideEffect };
  }
}

describe('FlowEngine - idempotency', () => {
  let engine: FlowEngine;

  beforeAll(async () => {
    const prisma = createFlowPrismaClient();
    await prisma.$executeRawUnsafe('TRUNCATE "FlowRunEvent", "FlowIdempotency", "FlowRun", "FlowDefinition" CASCADE');
    await prisma.$disconnect();
  });

  afterEach(() => {
    resetFlowPrismaClient();
    sideEffectCount = 0;
  });

  it('caches node output when idempotencyKey matches', async () => {
    engine = new FlowEngine();
    const def = buildFlowDefinition(IdempotentFlow);

    await engine.registerDefinition(def);

    const { runId } = await engine.startRun({
      flowId: 'idempotent-flow',
      version: '1.0.0',
      input: {},
    });

    // First tick - runs sideEffect
    let run = await engine.tick(runId);
    expect(sideEffectCount).toBe(1);

    // Second tick - should use cached, not re-run
    run = await engine.tick(runId);
    expect(sideEffectCount).toBe(1);

    // Complete the flow
    while (run?.status === 'RUNNING') {
      run = await engine.tick(runId);
    }

    expect(run?.status).toBe('COMPLETED');
    expect(sideEffectCount).toBe(1);
  });
});
