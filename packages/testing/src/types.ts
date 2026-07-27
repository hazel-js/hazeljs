export interface AgentRunResult {
  output: string;
  toolCalls?: string[];
  durationMs: number;
  costUsd?: number;
  tokens?: number;
  executionId?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentTestContext {
  /** Display name of the agent under test */
  agentName: string;
  /**
   * Execute the agent. Implementations typically wrap AgentRuntime.execute
   * and map steps → toolCalls / cost.
   */
  run: (input: string) => Promise<AgentRunResult>;
}

export type AgentTestFn = (ctx: AgentTestContext) => void | Promise<void>;

export interface DescribeAgentOptions {
  /** Max allowed latency per case (ms). */
  maxLatencyMs?: number;
  /** Max allowed estimated cost per case (USD). */
  maxCostUsd?: number;
  /** Fail suite if any case fails (default true). */
  failFast?: boolean;
}

export interface AgentAssertOptions {
  expectedTools?: string[];
  maxLatencyMs?: number;
  maxCostUsd?: number;
  /** Substring that must appear in output. */
  outputIncludes?: string;
}

export interface RegisteredSuite {
  name: string;
  options: DescribeAgentOptions;
  tests: Array<{ name: string; fn: AgentTestFn }>;
}
