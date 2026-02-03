/**
 * Agent State Manager Interface
 * Defines the contract for state persistence backends
 */

import { AgentContext, AgentState, AgentStep } from '../types/agent.types';

/**
 * Interface for agent state management backends
 */
export interface IAgentStateManager {
  /**
   * Create a new agent execution context
   */
  createContext(
    agentId: string,
    sessionId: string,
    input: string,
    userId?: string,
    metadata?: Record<string, unknown>
  ): Promise<AgentContext> | AgentContext;

  /**
   * Get execution context
   */
  getContext(executionId: string): Promise<AgentContext | undefined> | AgentContext | undefined;

  /**
   * Update agent state
   */
  updateState(executionId: string, newState: AgentState): Promise<void> | void;

  /**
   * Add a step to the execution
   */
  addStep(executionId: string, step: AgentStep): Promise<void> | void;

  /**
   * Update the last step
   */
  updateLastStep(executionId: string, updates: Partial<AgentStep>): Promise<void> | void;

  /**
   * Add message to conversation history
   */
  addMessage(
    executionId: string,
    role: 'user' | 'assistant' | 'system' | 'tool',
    content: string
  ): Promise<void> | void;

  /**
   * Set working memory value
   */
  setWorkingMemory(executionId: string, key: string, value: unknown): Promise<void> | void;

  /**
   * Get working memory value
   */
  getWorkingMemory(executionId: string, key: string): Promise<unknown> | unknown;

  /**
   * Add RAG context
   */
  addRAGContext(executionId: string, contexts: string[]): Promise<void> | void;

  /**
   * Check if execution can continue
   */
  canContinue(executionId: string, maxSteps: number): Promise<boolean> | boolean;

  /**
   * Delete execution context
   */
  deleteContext(executionId: string): Promise<void> | void;

  /**
   * Clear all contexts
   */
  clear(): Promise<void> | void;

  /**
   * Get all contexts for a session
   */
  getSessionContexts(sessionId: string): Promise<AgentContext[]> | AgentContext[];
}
