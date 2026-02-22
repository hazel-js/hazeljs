/**
 * Simple linear flow example (decorator-based)
 * Run with: npx ts-node src/examples/simple.ts (or tsx)
 * Requires DATABASE_URL
 */
import { FlowEngine, Flow, Entry, Node, Edge, buildFlowDefinition } from '../index.js';
import type { FlowContext, NodeResult } from '../index.js';

@Flow('simple-flow', '1.0.0')
class SimpleFlow {
  @Entry()
  @Node('a')
  @Edge('b')
  async a(ctx: FlowContext): Promise<NodeResult> {
    const input = ctx.input as number;
    return { status: 'ok', output: { value: input + 1 }, patch: { step: 'a' } };
  }

  @Node('b')
  async b(ctx: FlowContext): Promise<NodeResult> {
    return { status: 'ok', output: { value: (ctx.state.step as string) + '-done' } };
  }
}

async function main() {
  const engine = new FlowEngine();
  const def = buildFlowDefinition(SimpleFlow);

  await engine.registerDefinition(def);

  const { runId } = await engine.startRun({
    flowId: 'simple-flow',
    version: '1.0.0',
    input: 42,
  });

  let run = await engine.getRun(runId);
  while (run?.status === 'RUNNING') {
    run = await engine.tick(runId);
  }

  const timeline = await engine.getTimeline(runId);
  console.log('Run:', run);
  console.log('Timeline:', JSON.stringify(timeline, null, 2));
}

main().catch(console.error);
