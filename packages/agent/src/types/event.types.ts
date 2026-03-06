/**
 * Agent Runtime Event Types
 */

/**
 * Event types emitted by the agent runtime
 */
export enum AgentEventType {
  EXECUTION_STARTED = 'agent.execution.started',
  EXECUTION_COMPLETED = 'agent.execution.completed',
  EXECUTION_FAILED = 'agent.execution.failed',
  STEP_STARTED = 'agent.step.started',
  STEP_COMPLETED = 'agent.step.completed',
  STEP_FAILED = 'agent.step.failed',
  STATE_CHANGED = 'agent.state.changed',
  TOOL_EXECUTION_STARTED = 'tool.execution.started',
  TOOL_EXECUTION_COMPLETED = 'tool.execution.completed',
  TOOL_EXECUTION_FAILED = 'tool.execution.failed',
  TOOL_APPROVAL_REQUESTED = 'tool.approval.requested',
  TOOL_APPROVAL_GRANTED = 'tool.approval.granted',
  TOOL_APPROVAL_DENIED = 'tool.approval.denied',
  USER_INPUT_REQUESTED = 'agent.input.requested',
  USER_INPUT_RECEIVED = 'agent.input.received',
  MEMORY_UPDATED = 'agent.memory.updated',
  RAG_QUERY_EXECUTED = 'agent.rag.executed',

  // Graph orchestration events
  GRAPH_STARTED = 'graph.started',
  GRAPH_COMPLETED = 'graph.completed',
  GRAPH_FAILED = 'graph.failed',
  GRAPH_NODE_STARTED = 'graph.node.started',
  GRAPH_NODE_COMPLETED = 'graph.node.completed',
  GRAPH_NODE_FAILED = 'graph.node.failed',
  GRAPH_PARALLEL_STARTED = 'graph.parallel.started',
  GRAPH_PARALLEL_COMPLETED = 'graph.parallel.completed',

  // Supervisor events
  SUPERVISOR_ROUND_STARTED = 'supervisor.round.started',
  SUPERVISOR_DELEGATED = 'supervisor.delegated',
  SUPERVISOR_FINISHED = 'supervisor.finished',

  // Agent delegation events (agent-as-tool)
  DELEGATE_STARTED = 'agent.delegate.started',
  DELEGATE_COMPLETED = 'agent.delegate.completed',
}

/**
 * Base event interface
 */
export interface AgentEvent<T = unknown> {
  type: AgentEventType;
  agentId: string;
  executionId: string;
  timestamp: Date;
  data: T;
  metadata?: Record<string, unknown>;
}

/**
 * Execution started event
 */
export interface ExecutionStartedEvent {
  input: string;
  sessionId: string;
  userId?: string;
  options: Record<string, unknown>;
}

/**
 * Execution completed event
 */
export interface ExecutionCompletedEvent {
  response: string;
  steps: number;
  duration: number;
}

/**
 * Execution failed event
 */
export interface ExecutionFailedEvent {
  error: Error;
  step?: number;
  duration: number;
}

/**
 * Step event data
 */
export interface StepEventData {
  stepNumber: number;
  state: string;
  action?: Record<string, unknown>;
  result?: Record<string, unknown>;
}

/**
 * State changed event
 */
export interface StateChangedEvent {
  previousState: string;
  newState: string;
  reason?: string;
}

/**
 * Tool execution event
 */
export interface ToolExecutionEventData {
  toolName: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  duration?: number;
}

/**
 * Tool approval event
 */
export interface ToolApprovalEventData {
  requestId: string;
  toolName: string;
  input: Record<string, unknown>;
  approvedBy?: string;
  reason?: string;
}

/**
 * User input event
 */
export interface UserInputEventData {
  question: string;
  response?: string;
}

/**
 * Memory update event
 */
export interface MemoryUpdateEventData {
  type: 'conversation' | 'fact' | 'entity' | 'working';
  content: string;
  sessionId: string;
}

/**
 * RAG query event
 */
export interface RAGQueryEventData {
  query: string;
  results: string[];
  topK: number;
  duration: number;
}

// ---------------------------------------------------------------------------
// Graph event data
// ---------------------------------------------------------------------------

export interface GraphStartedEventData {
  graphId: string;
  executionId: string;
  input: string;
}

export interface GraphCompletedEventData {
  graphId: string;
  executionId: string;
  response?: string;
  stepCount: number;
  duration: number;
}

export interface GraphFailedEventData {
  graphId: string;
  executionId: string;
  error: Error;
  stepCount: number;
  duration: number;
}

export interface GraphNodeEventData {
  graphId: string;
  executionId: string;
  nodeId: string;
  nodeType: string;
  input?: string;
  output?: string;
  duration?: number;
  error?: string;
}

export interface GraphParallelEventData {
  graphId: string;
  executionId: string;
  nodeId: string;
  branches: string[];
  duration?: number;
}

// ---------------------------------------------------------------------------
// Supervisor event data
// ---------------------------------------------------------------------------

export interface SupervisorRoundEventData {
  supervisorName: string;
  round: number;
  worker?: string;
  subtask?: string;
}

export interface SupervisorDelegatedEventData {
  supervisorName: string;
  round: number;
  worker: string;
  subtask: string;
  result?: string;
}

export interface SupervisorFinishedEventData {
  supervisorName: string;
  rounds: number;
  response: string;
  duration: number;
}

// ---------------------------------------------------------------------------
// Delegation event data
// ---------------------------------------------------------------------------

export interface DelegateEventData {
  fromAgent: string;
  toAgent: string;
  input: string;
  response?: string;
  duration?: number;
}
