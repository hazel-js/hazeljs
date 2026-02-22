/**
 * Wait/resume flow example (decorator-based)
 * Node returns WAIT, then we resume with payload
 * Run with: npx ts-node src/examples/wait_resume.ts
 * Requires DATABASE_URL
 */
import { FlowEngine, Flow, Entry, Node, Edge, buildFlowDefinition } from '../index.js';
import type { FlowContext, NodeResult } from '../index.js';

@Flow('wait-resume-flow', '1.0.0')
class WaitResumeFlow {
  @Entry()
  @Node('request')
  @Edge('complete')
  async request(ctx: FlowContext): Promise<NodeResult> {
    if ((ctx.state as { _resumePayload?: unknown })._resumePayload) {
      const payload = (ctx.state as { _resumePayload: { approved: boolean } })._resumePayload;
      return { status: 'ok', output: payload, patch: { approved: payload.approved } };
    }
    return { status: 'wait', reason: 'awaiting_approval', until: 'manual' };
  }

  @Node('complete')
  async complete(ctx: FlowContext): Promise<NodeResult> {
    return {
      status: 'ok',
      output: { final: ctx.outputs.request },
    };
  }
}

async function main() {
  const engine = new FlowEngine();
  const def = buildFlowDefinition(WaitResumeFlow);

  await engine.registerDefinition(def);

  const { runId } = await engine.startRun({
    flowId: 'wait-resume-flow',
    version: '1.0.0',
    input: {},
  });

  let run = await engine.getRun(runId);
  while (run?.status === 'RUNNING') {
    run = await engine.tick(runId);
  }

  console.log('After first tick (should be WAITING):', run?.status);

  run = await engine.resumeRun(runId, { approved: true });
  while (run?.status === 'RUNNING') {
    run = await engine.tick(runId);
  }

  console.log('After resume:', run?.status, run?.outputsJson);
}

main().catch(console.error);
