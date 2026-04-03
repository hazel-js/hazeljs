/**
 * Agent Runtime
 * Main runtime for managing agent lifecycle and execution
 */
import { IAgentStateManager } from '../state/agent-state.interface';
import { AgentExecutionOptions, AgentExecutionResult, AgentContext, IGuardrailsService, AgentStreamChunk } from '../types/agent.types';
import { AgentEventType } from '../types/event.types';
import { LLMProvider } from '../types/llm.types';
import { RAGService } from '../types/rag.types';
import { MemoryManager } from '@hazeljs/rag';
import { LogLevel } from '../utils/logger';
import { HealthCheckResult } from '../utils/health-check';
import { AgentGraph } from '../graph/agent-graph';
import { SupervisorAgent } from '../supervisor/supervisor';
import { SupervisorConfig } from '../graph/agent-graph.types';
/**
 * Agent Runtime Configuration
 */
export interface AgentRuntimeConfig {
    stateManager?: IAgentStateManager;
    memoryManager?: MemoryManager;
    ragService?: RAGService;
    llmProvider?: LLMProvider;
    guardrailsService?: IGuardrailsService;
    defaultMaxSteps?: number;
    defaultTimeout?: number;
    enableObservability?: boolean;
    rateLimitPerMinute?: number;
    enableMetrics?: boolean;
    logLevel?: LogLevel;
    enableRetry?: boolean;
    enableCircuitBreaker?: boolean;
}
/**
 * Agent Runtime
 * Central runtime for agent execution and lifecycle management
 */
export declare class AgentRuntime {
    private agentRegistry;
    private toolRegistry;
    private stateManager;
    private contextBuilder;
    private toolExecutor;
    private agentExecutor;
    private eventEmitter;
    private config;
    private rateLimiter?;
    private metrics?;
    private logger;
    private retryHandler?;
    private circuitBreaker?;
    private healthChecker;
    /** AbortControllers for in-flight executions, keyed by executionId (for cancel()). */
    private executionAbortControllers;
    constructor(config?: AgentRuntimeConfig);
    /**
     * Set or update the LLM provider at runtime.
     * Updates both the config and the AgentExecutor's live reference.
     */
    setLLMProvider(provider: LLMProvider): void;
    /**
     * Register an agent class
     */
    registerAgent(agentClass: new (...args: unknown[]) => unknown): void;
    /**
     * Register an agent instance.
     * Also patches any @Delegate-decorated methods so they call the target agent
     * via this runtime rather than executing the original (stub) method body.
     */
    registerAgentInstance(agentName: string, instance: unknown): void;
    /**
     * Replace @Delegate stub methods on an agent instance with real runtime calls.
     * Called automatically by registerAgentInstance().
     */
    private patchDelegateMethods;
    /**
     * Execute an agent
     */
    execute(agentName: string, input: string, options?: AgentExecutionOptions): Promise<AgentExecutionResult>;
    /**
     * Execute with retry and circuit breaker protection
     */
    private executeWithProtection;
    /**
     * Execute an agent and stream step/token chunks. Use when options.streaming is true and LLM supports streamChat.
     */
    executeStream(agentName: string, input: string, options?: AgentExecutionOptions): AsyncGenerator<AgentStreamChunk>;
    /**
     * Resume a paused execution
     */
    resume(executionId: string, input?: string): Promise<AgentExecutionResult>;
    /**
     * Get execution context
     */
    getContext(executionId: string): Promise<AgentContext | undefined>;
    /**
     * Cancel an in-flight execution by executionId.
     * The running execute() will throw AgentError (CANCELLED) when it next checks the signal.
     */
    cancel(executionId: string): void;
    /**
     * Subscribe to agent events
     */
    on(type: AgentEventType, handler: (event: unknown) => void): void;
    /**
     * Subscribe to all agent events
     */
    onAny(handler: (event: unknown) => void): void;
    /**
     * Unsubscribe from events
     */
    off(type: AgentEventType, handler: (event: unknown) => void): void;
    /**
     * Get all registered agents
     */
    getAgents(): string[];
    /**
     * Get agent metadata
     */
    getAgentMetadata(agentName: string): import('../types/agent.types').AgentMetadata | undefined;
    /**
     * Get health check status
     */
    healthCheck(): Promise<HealthCheckResult>;
    /**
     * Get metrics
     */
    getMetrics(): import('../utils/metrics').AgentMetrics | undefined;
    /**
     * Get metrics summary
     */
    getMetricsSummary(): string;
    /**
     * Reset metrics
     */
    resetMetrics(): void;
    /**
     * Get rate limiter status
     */
    getRateLimiterStatus(): {
        enabled: boolean;
        availableTokens?: number;
    };
    /**
     * Get circuit breaker status
     */
    getCircuitBreakerStatus(): {
        enabled: boolean;
        state?: string;
        failureCount?: number;
        successCount?: number;
    };
    /**
     * Reset circuit breaker
     */
    resetCircuitBreaker(): void;
    /**
     * Get agent tools
     */
    getAgentTools(agentName: string): import('../types/tool.types').ToolMetadata[];
    /**
     * Approve a tool execution
     */
    approveToolExecution(requestId: string, approvedBy: string): void;
    /**
     * Reject a tool execution
     */
    rejectToolExecution(requestId: string): void;
    /**
     * Get pending tool approvals
     */
    getPendingApprovals(): import('../types/tool.types').ToolApprovalRequest[];
    /**
     * Create a new `AgentGraph` builder for this runtime.
     *
     * @param graphId A unique identifier for the graph (used in logs/events).
     *
     * @example
     * ```ts
     * const graph = runtime.createGraph('research-pipeline')
     *   .addNode('researcher', { type: 'agent', agentName: 'ResearchAgent' })
     *   .addNode('writer',     { type: 'agent', agentName: 'WriterAgent' })
     *   .addEdge('researcher', 'writer')
     *   .addEdge('writer', '__end__')
     *   .setEntryPoint('researcher')
     *   .compile();
     *
     * const result = await graph.execute('Write an article about LLMs');
     * ```
     */
    createGraph(graphId: string): AgentGraph;
    /**
     * Create a `SupervisorAgent` that orchestrates a team of worker agents.
     *
     * Requires an LLM provider to be configured on the runtime.
     *
     * @example
     * ```ts
     * const supervisor = runtime.createSupervisor({
     *   name: 'project-manager',
     *   workers: ['ResearchAgent', 'CoderAgent', 'WriterAgent'],
     *   maxRounds: 6,
     * });
     *
     * const result = await supervisor.run('Build a REST API for a todo app');
     * console.log(result.response);
     * ```
     */
    createSupervisor(config: SupervisorConfig): SupervisorAgent;
    /**
     * Dynamically spawn a new agent execution and return its result.
     * Useful inside @Tool methods when one agent needs to call another.
     *
     * @example
     * ```ts
     * @Tool({ description: 'Research and summarize a topic' })
     * async researchAndSummarize(topic: string) {
     *   const research = await this.runtime.spawn('ResearchAgent', topic);
     *   const summary  = await this.runtime.spawn('SummaryAgent', research.response ?? '');
     *   return summary.response;
     * }
     * ```
     */
    spawn(agentName: string, input: string, options?: AgentExecutionOptions): Promise<AgentExecutionResult>;
    /**
     * Create a sequential pipeline of agents — a shorthand for `createGraph()`.
     *
     * @param pipelineId  Unique ID for the graph.
     * @param agentNames  Ordered list of agent names to execute in sequence.
     * @returns A compiled graph ready to `.execute()`.
     *
     * @example
     * ```ts
     * const result = await runtime
     *   .pipeline('summarize', ['ResearchAgent', 'WriterAgent'])
     *   .execute('Write about LLMs');
     * ```
     */
    pipeline(pipelineId: string, agentNames: string[]): ReturnType<AgentGraph['compile']>;
    /**
     * One-liner to register an agent class and execute it immediately.
     * Creates a temporary runtime, registers the agent, runs it, and returns the result.
     *
     * @example
     * ```ts
     * const result = await AgentRuntime.quick(MyAgent, 'Hello!', {
     *   llmProvider: myLLM,
     * });
     * console.log(result.response);
     * ```
     */
    static quick(agentClass: new (...args: unknown[]) => unknown, input: string, config?: AgentRuntimeConfig, options?: AgentExecutionOptions): Promise<AgentExecutionResult>;
    /**
     * Shutdown the runtime
     */
    shutdown(): Promise<void>;
    /**
     * Generate a session ID
     */
    private generateSessionId;
}
//# sourceMappingURL=agent.runtime.d.ts.map