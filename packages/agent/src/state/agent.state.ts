/**
 * Agent State Management
 * Manages agent execution state and persistence
 */

import { AgentContext, AgentState, AgentStep } from '../types/agent.types';
import { IAgentStateManager } from './agent-state.interface';
import { randomUUID } from 'crypto';

/**
 * Agent State Manager
 * In-memory implementation - default state manager
 * Handles state transitions and persistence
 */
export class AgentStateManager implements IAgentStateManager {
  private contexts: Map<string, AgentContext> = new Map();

  /**
   * Create a new agent execution context
   */
  createContext(
    agentId: string,
    sessionId: string,
    input: string,
    userId?: string,
    metadata?: Record<string, unknown>
  ): AgentContext {
    const executionId = randomUUID();
    const now = new Date();

    const context: AgentContext = {
      executionId,
      agentId,
      sessionId,
      userId,
      input,
      state: AgentState.IDLE,
      steps: [],
      memory: {
        conversationHistory: [],
        workingMemory: {},
        facts: [],
        entities: [],
      },
      metadata: metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    this.contexts.set(executionId, context);
    return context;
  }

  /**
   * Get execution context
   */
  getContext(executionId: string): AgentContext | undefined {
    return this.contexts.get(executionId);
  }

  /**
   * Update agent state
   */
  updateState(executionId: string, newState: AgentState): void {
    const context = this.contexts.get(executionId);
    if (!context) {
      throw new Error(`Execution context ${executionId} not found`);
    }

    context.state = newState;
    context.updatedAt = new Date();
  }

  /**
   * Add a step to the execution
   */
  addStep(executionId: string, step: AgentStep): void {
    const context = this.contexts.get(executionId);
    if (!context) {
      throw new Error(`Execution context ${executionId} not found`);
    }

    context.steps.push(step);
    context.updatedAt = new Date();
  }

  /**
   * Update the last step
   */
  updateLastStep(executionId: string, updates: Partial<AgentStep>): void {
    const context = this.contexts.get(executionId);
    if (!context) {
      throw new Error(`Execution context ${executionId} not found`);
    }

    if (context.steps.length === 0) {
      throw new Error('No steps to update');
    }

    const lastStep = context.steps[context.steps.length - 1];
    Object.assign(lastStep, updates);
    context.updatedAt = new Date();
  }

  /**
   * Add message to conversation history
   */
  addMessage(
    executionId: string,
    role: 'user' | 'assistant' | 'system' | 'tool',
    content: string
  ): void {
    const context = this.contexts.get(executionId);
    if (!context) {
      throw new Error(`Execution context ${executionId} not found`);
    }

    context.memory.conversationHistory.push({
      role,
      content,
      timestamp: new Date(),
    });
    context.updatedAt = new Date();
  }

  /**
   * Set working memory value
   */
  setWorkingMemory(executionId: string, key: string, value: unknown): void {
    const context = this.contexts.get(executionId);
    if (!context) {
      throw new Error(`Execution context ${executionId} not found`);
    }

    context.memory.workingMemory[key] = value;
    context.updatedAt = new Date();
  }

  /**
   * Get working memory value
   */
  getWorkingMemory(executionId: string, key: string): unknown {
    const context = this.contexts.get(executionId);
    if (!context) {
      throw new Error(`Execution context ${executionId} not found`);
    }

    return context.memory.workingMemory[key];
  }

  /**
   * Add RAG context
   */
  addRAGContext(executionId: string, contexts: string[]): void {
    const context = this.contexts.get(executionId);
    if (!context) {
      throw new Error(`Execution context ${executionId} not found`);
    }

    context.ragContext = contexts;
    context.updatedAt = new Date();
  }

  /**
   * Check if execution can continue
   */
  canContinue(executionId: string, maxSteps: number): boolean {
    const context = this.contexts.get(executionId);
    if (!context) {
      return false;
    }

    if (context.state === AgentState.COMPLETED || context.state === AgentState.FAILED) {
      return false;
    }

    if (context.steps.length >= maxSteps) {
      return false;
    }

    return true;
  }

  /**
   * Delete execution context
   */
  deleteContext(executionId: string): void {
    this.contexts.delete(executionId);
  }

  /**
   * Clear all contexts
   */
  clear(): void {
    this.contexts.clear();
  }

  /**
   * Get all contexts for a session
   */
  getSessionContexts(sessionId: string): AgentContext[] {
    return Array.from(this.contexts.values()).filter((ctx) => ctx.sessionId === sessionId);
  }
}
