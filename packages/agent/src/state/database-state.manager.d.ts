/**
 * Database State Manager
 * Prisma-backed persistence for agent execution state
 * Provides durable, queryable state management with full audit trail
 */
import { AgentContext, AgentState, AgentStep } from '../types/agent.types';
import { IAgentStateManager } from './agent-state.interface';
type PrismaClient = any;
export interface DatabaseStateManagerConfig {
    /**
     * Prisma client instance
     */
    client: PrismaClient;
    /**
     * Whether to enable soft deletes (keep deleted contexts for audit)
     * @default true
     */
    softDelete?: boolean;
    /**
     * Whether to automatically archive completed contexts
     * @default false
     */
    autoArchive?: boolean;
    /**
     * Archive threshold in days (contexts older than this are archived)
     * @default 30
     */
    archiveThresholdDays?: number;
}
/**
 * Database-backed state manager for agent execution state
 * Provides durable persistence with full query capabilities and audit trail
 */
export declare class DatabaseStateManager implements IAgentStateManager {
    private client;
    private softDelete;
    private autoArchive;
    private archiveThresholdDays;
    constructor(config: DatabaseStateManagerConfig);
    /**
     * Convert database record to AgentContext
     */
    private toContext;
    /**
     * Convert AgentContext to database record
     */
    private toRecord;
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
//# sourceMappingURL=database-state.manager.d.ts.map