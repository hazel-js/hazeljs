/**
 * Agent State Management
 * Manages agent execution state and persistence
 */
import { AgentContext, AgentState, AgentStep } from '../types/agent.types';
import { IAgentStateManager } from './agent-state.interface';
/**
 * Agent State Manager
 * In-memory implementation - default state manager
 * Handles state transitions and persistence
 */
export declare class AgentStateManager implements IAgentStateManager {
    private contexts;
    /**
     * Create a new agent execution context
     */
    createContext(agentId: string, sessionId: string, input: string, userId?: string, metadata?: Record<string, unknown>): AgentContext;
    /**
     * Get execution context
     */
    getContext(executionId: string): AgentContext | undefined;
    /**
     * Update agent state
     */
    updateState(executionId: string, newState: AgentState): void;
    /**
     * Add a step to the execution
     */
    addStep(executionId: string, step: AgentStep): void;
    /**
     * Update the last step
     */
    updateLastStep(executionId: string, updates: Partial<AgentStep>): void;
    /**
     * Add message to conversation history
     */
    addMessage(executionId: string, role: 'user' | 'assistant' | 'system' | 'tool', content: string): void;
    /**
     * Set working memory value
     */
    setWorkingMemory(executionId: string, key: string, value: unknown): void;
    /**
     * Get working memory value
     */
    getWorkingMemory(executionId: string, key: string): unknown;
    /**
     * Add RAG context
     */
    addRAGContext(executionId: string, contexts: string[]): void;
    /**
     * Check if execution can continue
     */
    canContinue(executionId: string, maxSteps: number): boolean;
    /**
     * Delete execution context
     */
    deleteContext(executionId: string): void;
    /**
     * Clear all contexts
     */
    clear(): void;
    /**
     * Get all contexts for a session
     */
    getSessionContexts(sessionId: string): AgentContext[];
}
//# sourceMappingURL=agent.state.d.ts.map