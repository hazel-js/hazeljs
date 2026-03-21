/**
 * Enhanced Streaming Types for Agent Runtime
 * Provides rich streaming events for real-time UX
 */

import { AgentStep, AgentExecutionResult } from './agent.types';

/**
 * Detailed streaming chunk types for better UX
 */
export type AgentStreamChunk =
  | AgentThinkingChunk
  | AgentToolCallChunk
  | AgentToolResultChunk
  | AgentTokenChunk
  | AgentStepChunk
  | AgentErrorChunk
  | AgentDoneChunk;

/**
 * Agent is thinking/reasoning
 */
export interface AgentThinkingChunk {
  type: 'thinking';
  thought?: string;
  timestamp: Date;
}

/**
 * Agent is calling a tool
 */
export interface AgentToolCallChunk {
  type: 'tool_call';
  toolName: string;
  toolInput: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Tool execution result
 */
export interface AgentToolResultChunk {
  type: 'tool_result';
  toolName: string;
  result: unknown;
  duration: number;
  success: boolean;
  error?: string;
  timestamp: Date;
}

/**
 * Streaming token from LLM response
 */
export interface AgentTokenChunk {
  type: 'token';
  content: string;
  timestamp: Date;
}

/**
 * Complete step information
 */
export interface AgentStepChunk {
  type: 'step';
  step: AgentStep;
  timestamp: Date;
}

/**
 * Error during execution
 */
export interface AgentErrorChunk {
  type: 'error';
  error: Error;
  step?: number;
  timestamp: Date;
}

/**
 * Execution completed
 */
export interface AgentDoneChunk {
  type: 'done';
  result: AgentExecutionResult;
  timestamp: Date;
}

/**
 * Streaming progress information
 */
export interface StreamingProgress {
  currentStep: number;
  maxSteps: number;
  elapsedTime: number;
  estimatedTimeRemaining?: number;
  tokensGenerated: number;
  toolsCalled: number;
}

/**
 * Streaming event handler
 */
export type StreamingEventHandler = (
  chunk: AgentStreamChunk,
  progress: StreamingProgress
) => void | Promise<void>;

/**
 * Streaming options
 */
export interface StreamingOptions {
  /**
   * Enable token-by-token streaming for LLM responses
   */
  enableTokenStreaming?: boolean;

  /**
   * Enable step-by-step streaming
   */
  enableStepStreaming?: boolean;

  /**
   * Enable tool call/result streaming
   */
  enableToolStreaming?: boolean;

  /**
   * Callback for each streaming chunk
   */
  onChunk?: StreamingEventHandler;

  /**
   * Callback for progress updates
   */
  onProgress?: (progress: StreamingProgress) => void;

  /**
   * Buffer size for token streaming (default: 1)
   * Set higher to reduce network overhead
   */
  tokenBufferSize?: number;
}
