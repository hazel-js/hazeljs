import {
  runGoldenDataset,
  reportEvalForCi,
  type CaseRunner,
  type GoldenDataset,
  type EvalRunOptions,
  type CiReporterOptions,
  type EvalRunResult,
} from '@hazeljs/eval';
import type { AgentTestContext } from './types';
import { assertAgentResult } from './assertions';

/**
 * Run a golden dataset through an AgentTestContext runner, with optional
 * latency/cost gates per case via case metadata.
 */
export async function runAgentGolden(
  dataset: GoldenDataset,
  ctx: AgentTestContext,
  options?: EvalRunOptions & { maxLatencyMs?: number; maxCostUsd?: number }
): Promise<EvalRunResult> {
  const runner: CaseRunner = async ({ input }) => {
    const result = await ctx.run(input);
    if (options?.maxLatencyMs != null || options?.maxCostUsd != null) {
      assertAgentResult(result, {
        maxLatencyMs: options.maxLatencyMs,
        maxCostUsd: options.maxCostUsd,
      });
    }
    return {
      output: result.output,
      toolCalls: result.toolCalls,
    };
  };
  return runGoldenDataset(dataset, runner, options);
}

/** Re-export CI reporter for agent eval suites. */
export function reportAgentCi(
  result: EvalRunResult,
  options?: CiReporterOptions
): ReturnType<typeof reportEvalForCi> {
  return reportEvalForCi(result, options);
}
