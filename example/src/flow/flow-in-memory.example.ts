/**
 * Flow engine example - in-memory (no database).
 * Run: npm run flow:in-memory
 */
import { FlowEngine, Flow, Entry, Node, Edge, buildFlowDefinition } from '@hazeljs/flow';
import type { FlowContext, NodeResult } from '@hazeljs/flow';

@Flow('example-flow', '1.0.0')
class ExampleFlow {
  @Entry()
  @Node('start')
  @Edge('process')
  async start(ctx: FlowContext): Promise<NodeResult> {
    const input = ctx.input as { name: string };
    return { status: 'ok', output: { received: input?.name ?? 'world' }, patch: { step: 'start' } };
  }

  @Node('process')
  async process(ctx: FlowContext): Promise<NodeResult> {
    return {
      status: 'ok',
      output: { message: `Hello, ${(ctx.state.step as string) === 'start' ? ctx.outputs.start?.received : 'unknown'}!` },
    };
  }
}

async function main(): Promise<void> {
  console.log('Flow example (in-memory, no DB)\n');

  const engine = new FlowEngine();
  const def = buildFlowDefinition(ExampleFlow);
  await engine.registerDefinition(def);

  const { runId } = await engine.startRun({
    flowId: 'example-flow',
    version: '1.0.0',
    input: { name: 'HazelJS' },
  });

  let run = await engine.getRun(runId);
  while (run?.status === 'RUNNING') {
    run = await engine.tick(runId);
  }

  console.log('Run result:', run?.status, run?.outputsJson);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
