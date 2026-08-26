/**
 * Core Agent Runtime Types
 */

/** Guardrails service interface (from @hazeljs/guardrails when available) */
export interface IGuardrailsService {
  checkInput(
    input: string | object,
    options?: unknown
  ): {
    allowed: boolean;
    modified?: string | object;
    violations?: string[];
    blockedReason?: string;
  };
  checkOutput(
    output: string | object,
    options?: unknown
  ): {
    allowed: boolean;
    modified?: string | object;
    violations?: string[];
    blockedReason?: string;
  };
}

/**
 * Agent execution state
 */
export enum AgentState {
  IDLE = 'idle',
  PLANNING = 'planning',
  THINKING = 'thinking',
  SEARCHING_KNOWLEDGE = 'searching_knowledge',
  SEARCHING_MEMORY = 'searching_memory',
  USING_TOOL = 'using_tool',
  WAITING_FOR_INPUT = 'waiting_for_input',
  WAITING_FOR_APPROVAL = 'waiting_for_approval',
  RETRYING = 'retrying',
  BLOCKED = 'blocked',
  VALIDATING = 'validating',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Agent execution step
 */
export interface AgentStep {
  id: string;
  agentId: string;
  executionId: string;
  stepNumber: number;
  state: AgentState;
  action?: AgentAction;
  result?: AgentStepResult;
  error?: Error;
  timestamp: Date;
  duration?: number;
}

/**
 * Agent action types
 */
export enum AgentActionType {
  THINK = 'think',
  USE_TOOL = 'use_tool',
  USE_TOOLS = 'use_tools',
  ASK_USER = 'ask_user',
  RESPOND = 'respond',
  WAIT = 'wait',
  COMPLETE = 'complete',
}

/**
 * Agent action
 */
export interface AgentAction {
  type: AgentActionType;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  /** Multiple tool calls for parallel execution */
  toolCalls?: Array<{ toolName: string; toolInput: Record<string, unknown> }>;
  thought?: string;
  question?: string;
  response?: string;
  waitReason?: string;
}

/**
 * Agent step result
 */
export interface AgentStepResult {
  success: boolean;
  output?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Agent execution context
 */
export interface AgentContext {
  executionId: string;
  agentId: string;
  sessionId: string;
  userId?: string;
  input: string;
  state: AgentState;
  steps: AgentStep[];
  memory: AgentMemoryContext;
  ragContext?: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Agent memory context
 */
export interface AgentMemoryContext {
  conversationHistory: Array<{
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: Date;
  }>;
  workingMemory: Record<string, unknown>;
  facts: string[];
  entities: Array<{
    name: string;
    type: string;
    attributes: Record<string, unknown>;
  }>;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  name: string;
  description?: string;
  systemPrompt?: string;
  model?: string;
  maxSteps?: number;
  maxThinkingTime?: number;
  temperature?: number;
  enableMemory?: boolean;
  enableRAG?: boolean;
  ragTopK?: number;
  tools?: string[];
  policies?: string[];
  metadata?: Record<string, unknown>;
  /** Agent OS identity version (ADR-007). */
  version?: string;
  /** Tenant scope for the agent process (not the end-user JWT). */
  tenantId?: string;
  /** Capability grants for tool/memory/model policy (AOS-008). Empty = unrestricted. */
  capabilities?: string[];
}

type NewableFunction = new (...args: unknown[]) => unknown;

/**
 * Agent metadata stored via decorator
 */
export interface AgentMetadata extends AgentConfig {
  target: NewableFunction;
  instance?: unknown;
}

/** Stages for the outer confidence loop (Agent OS Loop Engine). */
export type AgentLoopStage = 'observe' | 'plan' | 'execute' | 'critique' | 'validate';

/**
 * Outer confidence-loop options. When set, execute() runs plan→execute→critique→validate
 * until successScore or maxIterations.
 */
export interface AgentLoopOptions {
  /** Max outer-loop iterations (default 5). */
  maxIterations?: number;
  /** Stop when critique/validate score >= this (0–100, default 95). */
  successScore?: number;
  /** Stages to run per iteration (default all). */
  stages?: AgentLoopStage[];
}

/**
 * Agent execution options
 */
export interface AgentExecutionOptions {
  sessionId?: string;
  userId?: string;
  maxSteps?: number;
  /** Execution timeout in ms. Enforced in single-agent run when set. */
  timeout?: number;
  /** Optional abort signal to cancel execution. */
  signal?: AbortSignal;
  enableMemory?: boolean;
  enableRAG?: boolean;
  initialContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  /** When true and LLM supports streamChat, tokens are streamed for final response. */
  streaming?: boolean;
  /** Outer confidence loop (Agent OS). */
  loop?: AgentLoopOptions;
  /** Phase 2 — validate result against contract (and optional fallback). */
  contract?: import('../contracts/agent-contract').AgentContract;
  /** Phase 2 — recovery ladder options for this execute. */
  recovery?: import('../recovery/recovery-ladder').RecoveryLadderOptions;
  /** Phase 3 — auto-select model id via CostOptimizer (stored in metadata). */
  costRoute?: import('../cost/cost-optimizer').CostRouteRequest;
  /** Phase 4 — governance check before execute. */
  governance?: import('../governance/governance').GovernanceContext;
  /** Agent OS Beta — hard budget for this run (AOS-012). */
  budget?: import('../budget/run-budget').RunBudget;
  /** Override agent identity for this execute (defaults from @Agent config). */
  identity?: import('../identity/agent-identity').AgentIdentity;
  /** Parent AgentRun id when this execute is a child (AOS-009). */
  parentRunId?: string;
  /** Root AgentRun id for a call tree. */
  rootRunId?: string;
}

/**
 * Agent execution result
 */
export interface AgentExecutionResult {
  executionId: string;
  agentId: string;
  state: AgentState;
  response?: string;
  steps: AgentStep[];
  error?: Error;
  metadata: Record<string, unknown>;
  duration: number;
  completedAt: Date;
  /** Present when loop options were used. */
  loop?: {
    iterations: number;
    finalScore: number;
    success: boolean;
  };
}

/**
 * Chunk yielded by executeStream()
 */
export type AgentStreamChunk =
  | { type: 'step'; step: AgentStep }
  | { type: 'token'; content: string }
  | { type: 'done'; result: AgentExecutionResult };
