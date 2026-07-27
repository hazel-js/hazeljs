import { trajectoryScore } from '@hazeljs/eval';
import type { AgentAssertOptions, AgentRunResult } from './types';

export class AgentAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentAssertionError';
  }
}

export function expectTools(result: AgentRunResult, expected: string[], minScore = 1): void {
  const score = trajectoryScore(expected, result.toolCalls ?? []);
  if (score < minScore) {
    throw new AgentAssertionError(
      `Tool trajectory score ${score} < ${minScore}. expected=${expected.join(',')} got=${(result.toolCalls ?? []).join(',')}`
    );
  }
}

export function expectMaxLatency(result: AgentRunResult, maxLatencyMs: number): void {
  if (result.durationMs > maxLatencyMs) {
    throw new AgentAssertionError(`Latency ${result.durationMs}ms exceeds max ${maxLatencyMs}ms`);
  }
}

export function expectMaxCost(result: AgentRunResult, maxCostUsd: number): void {
  const cost = result.costUsd ?? 0;
  if (cost > maxCostUsd) {
    throw new AgentAssertionError(`Cost $${cost} exceeds max $${maxCostUsd}`);
  }
}

/**
 * Apply common Agent OS CI assertions to a run result.
 */
export function assertAgentResult(result: AgentRunResult, options: AgentAssertOptions = {}): void {
  if (options.expectedTools?.length) {
    expectTools(result, options.expectedTools);
  }
  if (options.maxLatencyMs != null) {
    expectMaxLatency(result, options.maxLatencyMs);
  }
  if (options.maxCostUsd != null) {
    expectMaxCost(result, options.maxCostUsd);
  }
  if (options.outputIncludes) {
    if (!result.output.includes(options.outputIncludes)) {
      throw new AgentAssertionError(
        `Output does not include "${options.outputIncludes}": ${result.output.slice(0, 200)}`
      );
    }
  }
}
