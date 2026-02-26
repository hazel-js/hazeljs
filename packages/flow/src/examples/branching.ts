/**
 * Branching flow example - conditional edges (decorator-based)
 * Run with: npx ts-node src/examples/branching.ts
 * Requires DATABASE_URL
 */
import { FlowEngine, Flow, Entry, Node, Edge, buildFlowDefinition } from '../index.js';
import type { FlowContext, NodeResult } from '../index.js';

@Flow('branching-flow', '1.0.0')
class BranchingFlow {
  @Entry()
  @Node('check')
  @Edge('approve', (ctx: FlowContext) => (ctx.state.score as number) >= 70, 1)
  @Edge('reject', (ctx: FlowContext) => (ctx.state.score as number) < 70, 1)
  async check(ctx: FlowContext): Promise<NodeResult> {
    const score = (ctx.input as { score: number }).score;
    return { status: 'ok', output: { score }, patch: { score } };
  }

  @Node('approve')
  async approve(): Promise<NodeResult> {
    return { status: 'ok', output: { decision: 'approved' } };
  }

  @Node('reject')
  async reject(): Promise<NodeResult> {
    return { status: 'ok', output: { decision: 'rejected' } };
  }
}

async function main(): Promise<void> {
  const engine = new FlowEngine();
  const def = buildFlowDefinition(BranchingFlow);

  await engine.registerDefinition(def);

  const { runId } = await engine.startRun({
    flowId: 'branching-flow',
    version: '1.0.0',
    input: { score: 85 },
  });

  let run = await engine.getRun(runId);
  while (run?.status === 'RUNNING') {
    run = await engine.tick(runId);
  }

  // eslint-disable-next-line no-console
  console.log('Run result:', run?.outputsJson);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
});
