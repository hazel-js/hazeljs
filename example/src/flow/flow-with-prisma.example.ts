/**
 * Flow engine example - with Prisma persistence (optional).
 * Requires DATABASE_URL and flow schema applied (run migrations from @hazeljs/flow).
 * Run: npm run flow:with-prisma
 */
import { FlowEngine, Flow, Entry, Node, Edge, buildFlowDefinition } from '@hazeljs/flow';
import type { FlowContext, NodeResult } from '@hazeljs/flow';
import { createPrismaStorage, createFlowPrismaClient } from '@hazeljs/flow/prisma';

@Flow('example-persisted-flow', '1.0.0')
class ExamplePersistedFlow {
  @Entry()
  @Node('step1')
  @Edge('step2')
  async step1(ctx: FlowContext): Promise<NodeResult> {
    return { status: 'ok', output: { at: 'step1' }, patch: { progress: 1 } };
  }

  @Node('step2')
  async step2(ctx: FlowContext): Promise<NodeResult> {
    return { status: 'ok', output: { at: 'step2', progress: ctx.state.progress } };
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required for flow:with-prisma. Use flow:in-memory for no DB.');
    process.exit(1);
  }

  console.log('Flow example (Prisma persistence)\n');

  const prisma = createFlowPrismaClient();
  const engine = new FlowEngine({
    storage: createPrismaStorage(prisma),
  });

  const def = buildFlowDefinition(ExamplePersistedFlow);
  await engine.registerDefinition(def);

  const { runId } = await engine.startRun({
    flowId: 'example-persisted-flow',
    version: '1.0.0',
    input: {},
  });

  let run = await engine.getRun(runId);
  while (run?.status === 'RUNNING') {
    run = await engine.tick(runId);
  }

  console.log('Run result:', run?.status, run?.outputsJson);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
