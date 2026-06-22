import type { FlowEngine, FlowRunRow } from '@hazeljs/flow';

/** Tick until the run reaches a terminal or waiting state (same loop as hazeljs-flow-example). */
export async function runUntilSettled(
  engine: FlowEngine,
  runId: string
): Promise<FlowRunRow | null> {
  let run = await engine.getRun(runId);
  while (run?.status === 'RUNNING') {
    run = await engine.tick(runId);
  }
  return run;
}
