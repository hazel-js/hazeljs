/**
 * AgentGraph Types
 * Type definitions for the multi-agent orchestration graph system
 */

import { AgentExecutionResult } from '../types/agent.types';

/** Sentinel value marking the end of a graph execution */
export const END = '__end__' as const;
export type GraphEndSymbol = typeof END;

// ---------------------------------------------------------------------------
// Graph State
// ---------------------------------------------------------------------------

/** Message that flows through the graph between nodes */
export interface GraphMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** The node that produced this message */
  nodeId?: string;
  timestamp?: Date;
}

/**
 * The shared state object that flows through every node in the graph.
 * Nodes read from it, transform it, and return a partial update.
 */
export interface GraphState {
  /** The original user input that kicked off the graph */
  input: string;
  /** The most recent output produced by any node */
  output?: string;
  /** Full message history for the graph run */
  messages: GraphMessage[];
  /** Arbitrary key-value store for inter-node data sharing */
  data: Record<string, unknown>;
  /** Full AgentExecutionResult keyed by node ID */
  nodeResults: Record<string, AgentExecutionResult>;
  /** ID of the node currently being executed */
  currentNode?: string;
  /** Set if the graph encountered an unrecoverable error */
  error?: Error;
  /** Graph-level metadata (execution ID, options, etc.) */
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Node Configs
// ---------------------------------------------------------------------------

/** A node that runs a registered agent by name */
export interface AgentNodeConfig {
  type: 'agent';
  /** The name of the agent as registered with AgentRuntime */
  agentName: string;
  /**
   * Optional: transform graph state → agent input string.
   * Defaults to `state.input` when not provided.
   */
  inputMapper?: (state: GraphState) => string;
  /**
   * Optional: transform agent result + previous state → new state.
   * Defaults to setting `state.output = result.response`.
   */
  outputMapper?: (result: AgentExecutionResult, state: GraphState) => Partial<GraphState>;
}

/** A node that runs an arbitrary async function */
export interface FunctionNodeConfig {
  type: 'function';
  /** Must return a (possibly partial) GraphState update */
  fn: (state: GraphState) => Promise<Partial<GraphState>> | Partial<GraphState>;
}

/**
 * A node that fans-out to multiple child nodes in parallel,
 * waits for all of them, then merges their results.
 */
export interface ParallelNodeConfig {
  type: 'parallel';
  /** IDs of nodes to execute concurrently */
  branches: string[];
  /**
   * Optional: merge all branch outputs into the final state.
   * Defaults to concatenating each branch's `output` with a separator.
   */
  mergeStrategy?: (results: ParallelBranchResult[], base: GraphState) => Partial<GraphState>;
}

export type GraphNodeConfig = AgentNodeConfig | FunctionNodeConfig | ParallelNodeConfig;

/** Internal node representation */
export interface GraphNode {
  id: string;
  config: GraphNodeConfig;
}

// ---------------------------------------------------------------------------
// Edges & Routing
// ---------------------------------------------------------------------------

/**
 * Router function: inspects the current state and returns the ID of the next
 * node (or `END` to stop the graph).
 */
export type RouterFunction = (state: GraphState) => string | GraphEndSymbol;

export interface GraphEdge {
  from: string;
  /** Fixed target node ID (or END). Mutually exclusive with `condition`. */
  to?: string | GraphEndSymbol;
  /** Conditional routing function. Mutually exclusive with `to`. */
  condition?: RouterFunction;
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export interface GraphExecutionOptions {
  sessionId?: string;
  userId?: string;
  /** Maximum number of node executions before aborting (default: 50) */
  maxSteps?: number;
  /** Timeout in ms for the entire graph run (default: 600_000) */
  timeout?: number;
  /** Seed data merged into `state.data` before the run starts */
  initialData?: Record<string, unknown>;
}

/** Per-node step record within a graph execution */
export interface GraphStep {
  id: string;
  nodeId: string;
  nodeType: GraphNodeConfig['type'];
  /** Input string seen by this node */
  input: string;
  /** Output produced by this node */
  output?: string;
  duration: number;
  timestamp: Date;
  /** For parallel nodes: IDs of branches executed */
  parallelBranches?: string[];
  error?: string;
}

export interface GraphExecutionResult {
  graphId: string;
  executionId: string;
  /** Final state after all nodes have run */
  state: GraphState;
  /** Convenience alias for `state.output` */
  response?: string;
  steps: GraphStep[];
  /** Full agent results keyed by node ID */
  nodeExecutions: Record<string, AgentExecutionResult>;
  duration: number;
  completedAt: Date;
  success: boolean;
  error?: Error;
}

/** Emitted for each node during a streaming graph execution */
export interface GraphStreamChunk {
  executionId: string;
  nodeId: string;
  nodeType: GraphNodeConfig['type'];
  /** Incremental content delta (may be empty for non-streaming nodes) */
  chunk: string;
  /** Full output of this node once it completes */
  nodeOutput?: string;
  done: boolean;
}

// ---------------------------------------------------------------------------
// Parallel helpers
// ---------------------------------------------------------------------------

export interface ParallelBranchResult {
  nodeId: string;
  state: GraphState;
  agentResult?: AgentExecutionResult;
  error?: Error;
}

// ---------------------------------------------------------------------------
// Supervisor
// ---------------------------------------------------------------------------

export interface SupervisorConfig {
  /** Display name for this supervisor instance */
  name: string;
  /** Names of worker agents available for delegation */
  workers: string[];
  /**
   * Optional override for the supervisor system prompt.
   * The workers list is always appended automatically.
   */
  systemPrompt?: string;
  /** Maximum routing rounds before the supervisor gives up (default: 10) */
  maxRounds?: number;
  /** Model to use for supervisor routing decisions */
  model?: string;
  temperature?: number;
}

export interface SupervisorWorkerInfo {
  name: string;
  description?: string;
}

/** Routing decision returned by the LLM */
export interface SupervisorDecision {
  /** 'delegate' to route to a worker, 'finish' to return a final answer */
  action: 'delegate' | 'finish';
  /** When action === 'delegate': target worker agent name */
  worker?: string;
  /** When action === 'delegate': the subtask for the worker */
  subtask?: string;
  /** When action === 'finish': the final response to the user */
  response?: string;
  /** Supervisor's internal reasoning */
  thought?: string;
}

export interface SupervisorResult {
  response: string;
  rounds: SupervisorRound[];
  totalDuration: number;
  completedAt: Date;
  success: boolean;
  error?: Error;
}

export interface SupervisorRound {
  round: number;
  decision: SupervisorDecision;
  workerResult?: AgentExecutionResult;
  duration: number;
}

// ---------------------------------------------------------------------------
// @Delegate decorator metadata
// ---------------------------------------------------------------------------

export interface DelegateConfig {
  /** The agent name (as registered with AgentRuntime) to delegate to */
  agent: string;
  /** Human-readable description used as the tool description for the LLM */
  description: string;
  /**
   * Which key in the tool call's arguments object contains the text
   * passed as `input` to the target agent.  Defaults to 'input'.
   */
  inputField?: string;
}

export const DELEGATE_METADATA_KEY = Symbol('hazel:delegate');
export const DELEGATES_LIST_KEY = Symbol('hazel:delegates');
