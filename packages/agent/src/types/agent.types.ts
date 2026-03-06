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
  THINKING = 'thinking',
  USING_TOOL = 'using_tool',
  WAITING_FOR_INPUT = 'waiting_for_input',
  WAITING_FOR_APPROVAL = 'waiting_for_approval',
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
}

type NewableFunction = new (...args: unknown[]) => unknown;

/**
 * Agent metadata stored via decorator
 */
export interface AgentMetadata extends AgentConfig {
  target: NewableFunction;
  instance?: unknown;
}

/**
 * Agent execution options
 */
export interface AgentExecutionOptions {
  sessionId?: string;
  userId?: string;
  maxSteps?: number;
  timeout?: number;
  enableMemory?: boolean;
  enableRAG?: boolean;
  initialContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
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
}
