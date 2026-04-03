/**
 * Structural types aligned with @hazeljs/agent graph + supervisor APIs.
 * Defined locally so @hazeljs/ai can compile when agent is an optional peer.
 */

export interface GraphExecutionOptions {
  maxSteps?: number;
  timeout?: number;
  initialData?: Record<string, unknown>;
}

export interface GraphExecutionResult {
  graphId: string;
  executionId: string;
  state: {
    input: string;
    output?: string;
    messages: unknown[];
    data: Record<string, unknown>;
    nodeResults: Record<string, unknown>;
  };
  response?: string;
  steps: unknown[];
  nodeExecutions: Record<string, unknown>;
  duration: number;
  completedAt: Date;
  success: boolean;
  error?: Error;
}

/** Runnable product of AgentGraph.compile() */
export interface CompiledGraph {
  execute(input: string, options?: GraphExecutionOptions): Promise<GraphExecutionResult>;
}

/**
 * Builder from AgentRuntime.createGraph — chain `.addNode` / `.addEdge` / `.setEntryPoint` / `.compile()`.
 * Full shape lives in @hazeljs/agent; this is the minimal surface HazelAI exposes.
 */
export interface AgentGraph {
  addNode(id: string, config: Record<string, unknown>): AgentGraph;
  addEdge(from: string, to: string): AgentGraph;
  setEntryPoint(id: string): AgentGraph;
  compile(): CompiledGraph;
}

export interface SupervisorConfig {
  name: string;
  workers: string[];
  systemPrompt?: string;
  maxRounds?: number;
  model?: string;
  temperature?: number;
}

export interface SupervisorResult {
  response: string;
  rounds: unknown[];
  totalDuration: number;
  completedAt: Date;
  success: boolean;
  error?: Error;
}
