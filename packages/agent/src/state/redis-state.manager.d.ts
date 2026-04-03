/**
 * Redis State Manager
 * Redis-backed persistence for agent execution state
 * Provides fast, distributed state management with TTL support
 */
import { AgentContext, AgentState, AgentStep } from '../types/agent.types';
import { IAgentStateManager } from './agent-state.interface';
type RedisClient = any;
export interface RedisStateManagerConfig {
    /**
     * Redis client instance
     */
    client: RedisClient;
    /**
     * Key prefix for all agent state keys
     * @default "agent:state:"
     */
    keyPrefix?: string;
    /**
     * Default TTL for execution contexts in seconds
     * @default 3600 (1 hour)
     */
    defaultTTL?: number;
    /**
     * TTL for completed contexts in seconds
     * @default 86400 (24 hours)
     */
    completedTTL?: number;
    /**
     * TTL for failed contexts in seconds
     * @default 604800 (7 days)
     */
    failedTTL?: number;
}
/**
 * Redis-backed state manager for agent execution state
 * Provides fast, distributed state management with automatic expiration
 */
export declare class RedisStateManager implements IAgentStateManager {
    private client;
    private keyPrefix;
    private defaultTTL;
    private completedTTL;
    private failedTTL;
    constructor(config: RedisStateManagerConfig);
    /**
     * Get the Redis key for an execution context
     */
    private getKey;
    /**
     * Get the Redis key for session contexts
     */
    private getSessionKey;
    /**
     * Serialize context to JSON
     */
    private serialize;
    /**
     * Deserialize context from JSON
     */
    private deserialize;
    /**
     * Get TTL based on state
     */
    private getTTL;
    createContext(agentId: string, sessionId: string, input: string, userId?: string, metadata?: Record<string, unknown>): Promise<AgentContext>;
    getContext(executionId: string): Promise<AgentContext | undefined>;
    updateState(executionId: string, newState: AgentState): Promise<void>;
    addStep(executionId: string, step: AgentStep): Promise<void>;
    updateLastStep(executionId: string, updates: Partial<AgentStep>): Promise<void>;
    addMessage(executionId: string, role: 'user' | 'assistant' | 'system' | 'tool', content: string): Promise<void>;
    setWorkingMemory(executionId: string, key: string, value: unknown): Promise<void>;
    getWorkingMemory(executionId: string, key: string): Promise<unknown>;
    addRAGContext(executionId: string, contexts: string[]): Promise<void>;
    canContinue(executionId: string, maxSteps: number): Promise<boolean>;
    deleteContext(executionId: string): Promise<void>;
    clear(): Promise<void>;
    getSessionContexts(sessionId: string): Promise<AgentContext[]>;
}
export {};
//# sourceMappingURL=redis-state.manager.d.ts.map