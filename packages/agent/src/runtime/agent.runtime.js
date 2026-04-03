"use strict";
/**
 * Agent Runtime
 * Main runtime for managing agent lifecycle and execution
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRuntime = void 0;
const agent_registry_1 = require("../registry/agent.registry");
const tool_registry_1 = require("../registry/tool.registry");
const agent_state_1 = require("../state/agent.state");
const agent_context_1 = require("../context/agent.context");
const agent_executor_1 = require("../executor/agent.executor");
const tool_executor_1 = require("../executor/tool.executor");
const event_emitter_1 = require("../events/event.emitter");
const agent_types_1 = require("../types/agent.types");
const agent_error_1 = require("../errors/agent.error");
const rate_limiter_1 = require("../utils/rate-limiter");
const metrics_1 = require("../utils/metrics");
const logger_1 = require("../utils/logger");
const retry_1 = require("../utils/retry");
const circuit_breaker_1 = require("../utils/circuit-breaker");
const health_check_1 = require("../utils/health-check");
const agent_graph_1 = require("../graph/agent-graph");
const supervisor_1 = require("../supervisor/supervisor");
const delegate_decorator_1 = require("../decorators/delegate.decorator");
/**
 * Agent Runtime
 * Central runtime for agent execution and lifecycle management
 */
class AgentRuntime {
    constructor(config = {}) {
        /** AbortControllers for in-flight executions, keyed by executionId (for cancel()). */
        this.executionAbortControllers = new Map();
        this.config = {
            defaultMaxSteps: 10,
            defaultTimeout: 300000,
            enableObservability: true,
            enableMetrics: true,
            enableRetry: true,
            enableCircuitBreaker: true,
            logLevel: logger_1.LogLevel.INFO,
            ...config,
        };
        // Initialize logger
        this.logger = new logger_1.Logger({ level: this.config.logLevel });
        // Initialize rate limiter if configured
        if (this.config.rateLimitPerMinute) {
            this.rateLimiter = new rate_limiter_1.RateLimiter({
                tokensPerMinute: this.config.rateLimitPerMinute,
            });
            this.logger.info('Rate limiter initialized', {
                tokensPerMinute: this.config.rateLimitPerMinute,
            });
        }
        // Initialize metrics collector if enabled
        if (this.config.enableMetrics) {
            this.metrics = new metrics_1.MetricsCollector();
            this.logger.info('Metrics collector initialized');
        }
        // Initialize retry handler if enabled
        if (this.config.enableRetry) {
            this.retryHandler = new retry_1.RetryHandler({
                maxRetries: 3,
                initialDelayMs: 1000,
                onRetry: (attempt, error) => {
                    this.logger.warn('Retrying operation', {
                        attempt,
                        error: error.message,
                    });
                },
            });
        }
        // Initialize circuit breaker if enabled
        if (this.config.enableCircuitBreaker) {
            this.circuitBreaker = new circuit_breaker_1.CircuitBreaker({
                failureThreshold: 5,
                successThreshold: 2,
                resetTimeout: 30000,
                onStateChange: (_from, to) => {
                    this.logger.warn('Circuit breaker state changed', { state: to });
                },
            });
        }
        // Initialize health checker
        this.healthChecker = new health_check_1.HealthChecker();
        this.agentRegistry = new agent_registry_1.AgentRegistry();
        this.toolRegistry = new tool_registry_1.ToolRegistry();
        this.stateManager = config.stateManager || new agent_state_1.AgentStateManager();
        this.contextBuilder = new agent_context_1.AgentContextBuilder(config.memoryManager);
        this.eventEmitter = new event_emitter_1.AgentEventEmitter();
        this.toolExecutor = new tool_executor_1.ToolExecutor((type, data) => {
            this.eventEmitter.emit(type, '', '', data);
        }, config.guardrailsService);
        this.agentExecutor = new agent_executor_1.AgentExecutor(this.stateManager, this.contextBuilder, this.toolExecutor, this.toolRegistry, config.llmProvider, (type, executionId, data) => {
            this.eventEmitter.emit(type, '', executionId, data);
        });
        this.logger.info('Agent runtime initialized', {
            enableMetrics: this.config.enableMetrics,
            enableRetry: this.config.enableRetry,
            enableCircuitBreaker: this.config.enableCircuitBreaker,
        });
    }
    /**
     * Set or update the LLM provider at runtime.
     * Updates both the config and the AgentExecutor's live reference.
     */
    setLLMProvider(provider) {
        this.config.llmProvider = provider;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.agentExecutor.llmProvider = provider;
    }
    /**
     * Register an agent class
     */
    registerAgent(agentClass) {
        this.agentRegistry.register(agentClass);
    }
    /**
     * Register an agent instance.
     * Also patches any @Delegate-decorated methods so they call the target agent
     * via this runtime rather than executing the original (stub) method body.
     */
    registerAgentInstance(agentName, instance) {
        this.agentRegistry.registerInstance(agentName, instance);
        this.patchDelegateMethods(agentName, instance);
        this.toolRegistry.registerAgentTools(agentName, instance);
    }
    /**
     * Replace @Delegate stub methods on an agent instance with real runtime calls.
     * Called automatically by registerAgentInstance().
     */
    patchDelegateMethods(agentName, instance) {
        if (!instance || typeof instance !== 'object')
            return;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        const agentClass = instance.constructor;
        const delegatedMethods = (0, delegate_decorator_1.getDelegatedMethods)(agentClass);
        for (const methodName of delegatedMethods) {
            const delegateConfig = (0, delegate_decorator_1.getDelegateMetadata)(instance, methodName);
            if (!delegateConfig)
                continue;
            const targetAgentName = delegateConfig.agent;
            const inputField = delegateConfig.inputField ?? 'input';
            // Patch the instance method to delegate to the target agent
            instance[methodName] = async (args) => {
                const agentInput = typeof args === 'string' ? args : (args[inputField] ?? JSON.stringify(args));
                this.logger.debug(`Delegating from "${agentName}" to "${targetAgentName}"`, {
                    input: agentInput,
                });
                const result = await this.execute(targetAgentName, agentInput);
                return result.response ?? '';
            };
            this.logger.debug(`Patched @Delegate method "${methodName}" on agent "${agentName}"`, {
                targetAgent: targetAgentName,
            });
        }
    }
    /**
     * Execute an agent
     */
    async execute(agentName, input, options = {}) {
        // Check rate limit
        if (this.rateLimiter) {
            const allowed = await this.rateLimiter.waitForToken(5000);
            if (!allowed) {
                this.logger.error('Rate limit exceeded', undefined, { agentName });
                throw agent_error_1.AgentError.rateLimitExceeded();
            }
        }
        const startTime = Date.now();
        let success = false;
        try {
            this.logger.info('Starting agent execution', {
                agentName,
                sessionId: options.sessionId,
                userId: options.userId,
            });
            // Execute with retry and circuit breaker
            const result = await this.executeWithProtection(agentName, input, options);
            success = result.state === agent_types_1.AgentState.COMPLETED;
            const duration = Date.now() - startTime;
            // Record metrics
            if (this.metrics) {
                this.metrics.recordExecution(success, duration);
            }
            this.logger.info('Agent execution completed', {
                agentName,
                executionId: result.executionId,
                state: result.state,
                duration,
            });
            return result;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            if (this.metrics) {
                this.metrics.recordExecution(false, duration);
            }
            this.logger.error('Agent execution failed', error, {
                agentName,
                duration,
            });
            throw error;
        }
    }
    /**
     * Execute with retry and circuit breaker protection
     */
    async executeWithProtection(agentName, input, options) {
        const executeFn = async () => {
            const agent = this.agentRegistry.getAgent(agentName);
            if (!agent) {
                throw new Error(`Agent ${agentName} not found`);
            }
            const sessionId = options.sessionId || this.generateSessionId();
            const maxSteps = options.maxSteps || this.config.defaultMaxSteps || 10;
            const contextResult = this.stateManager.createContext(agentName, sessionId, input, options.userId, {
                ...options.metadata,
                systemPrompt: agent.systemPrompt,
                agentDescription: agent.description,
            });
            const context = contextResult instanceof Promise ? await contextResult : contextResult;
            if (options.enableMemory !== false && this.config.memoryManager) {
                await this.contextBuilder.buildWithMemory(context);
            }
            if (options.enableRAG !== false && this.config.ragService) {
                await this.contextBuilder.buildWithRAG(context, this.config.ragService, agent.ragTopK || 5);
            }
            if (options.initialContext) {
                Object.assign(context.memory.workingMemory, options.initialContext);
            }
            let controller;
            if (!options.signal) {
                controller = new AbortController();
                this.executionAbortControllers.set(context.executionId, controller);
            }
            const signal = options.signal ?? controller?.signal;
            const timeoutMs = options.timeout ?? this.config.defaultTimeout;
            try {
                const result = await this.agentExecutor.execute(context, maxSteps, {
                    timeoutMs,
                    signal,
                    streaming: options.streaming,
                });
                if (this.config.memoryManager) {
                    await this.contextBuilder.persistToMemory(context);
                }
                return result;
            }
            finally {
                if (controller) {
                    this.executionAbortControllers.delete(context.executionId);
                }
            }
        };
        // Apply circuit breaker if enabled
        if (this.circuitBreaker) {
            const circuitBreakerFn = () => this.circuitBreaker.execute(executeFn);
            // Apply retry if enabled
            if (this.retryHandler) {
                return this.retryHandler.execute(circuitBreakerFn);
            }
            return circuitBreakerFn();
        }
        // Apply retry only if circuit breaker is disabled
        if (this.retryHandler) {
            return this.retryHandler.execute(executeFn);
        }
        return executeFn();
    }
    /**
     * Execute an agent and stream step/token chunks. Use when options.streaming is true and LLM supports streamChat.
     */
    async *executeStream(agentName, input, options = {}) {
        const agent = this.agentRegistry.getAgent(agentName);
        if (!agent) {
            throw new Error(`Agent ${agentName} not found`);
        }
        const sessionId = options.sessionId || this.generateSessionId();
        const maxSteps = options.maxSteps || this.config.defaultMaxSteps || 10;
        const contextResult = this.stateManager.createContext(agentName, sessionId, input, options.userId, {
            ...options.metadata,
            systemPrompt: agent.systemPrompt,
            agentDescription: agent.description,
        });
        const context = contextResult instanceof Promise ? await contextResult : contextResult;
        if (options.enableMemory !== false && this.config.memoryManager) {
            await this.contextBuilder.buildWithMemory(context);
        }
        if (options.enableRAG !== false && this.config.ragService) {
            await this.contextBuilder.buildWithRAG(context, this.config.ragService, agent.ragTopK || 5);
        }
        if (options.initialContext) {
            Object.assign(context.memory.workingMemory, options.initialContext);
        }
        let controller;
        if (!options.signal) {
            controller = new AbortController();
            this.executionAbortControllers.set(context.executionId, controller);
        }
        const signal = options.signal ?? controller?.signal;
        const timeoutMs = options.timeout ?? this.config.defaultTimeout;
        try {
            yield* this.agentExecutor.executeStream(context, maxSteps, {
                timeoutMs,
                signal,
                streaming: options.streaming,
            });
        }
        finally {
            if (controller) {
                this.executionAbortControllers.delete(context.executionId);
            }
            if (this.config.memoryManager) {
                await this.contextBuilder.persistToMemory(context);
            }
        }
    }
    /**
     * Resume a paused execution
     */
    async resume(executionId, input) {
        return this.agentExecutor.resume(executionId, input);
    }
    /**
     * Get execution context
     */
    async getContext(executionId) {
        const result = this.stateManager.getContext(executionId);
        return result instanceof Promise ? await result : result;
    }
    /**
     * Cancel an in-flight execution by executionId.
     * The running execute() will throw AgentError (CANCELLED) when it next checks the signal.
     */
    cancel(executionId) {
        const controller = this.executionAbortControllers.get(executionId);
        if (controller) {
            controller.abort();
            this.executionAbortControllers.delete(executionId);
            this.logger.info('Execution cancelled', { executionId });
        }
    }
    /**
     * Subscribe to agent events
     */
    on(type, handler) {
        this.eventEmitter.on(type, handler);
    }
    /**
     * Subscribe to all agent events
     */
    onAny(handler) {
        this.eventEmitter.onAny(handler);
    }
    /**
     * Unsubscribe from events
     */
    off(type, handler) {
        this.eventEmitter.off(type, handler);
    }
    /**
     * Get all registered agents
     */
    getAgents() {
        return this.agentRegistry.getAllAgents().map((a) => a.name);
    }
    /**
     * Get agent metadata
     */
    getAgentMetadata(agentName) {
        return this.agentRegistry.getAgent(agentName);
    }
    /**
     * Get health check status
     */
    async healthCheck() {
        const metricsData = this.metrics
            ? {
                totalExecutions: this.metrics.getMetrics().executions.total,
                successRate: this.metrics.getMetrics().executions.successRate,
                averageLatency: this.metrics.getMetrics().performance.averageDuration,
            }
            : undefined;
        return this.healthChecker.check(this.config.llmProvider, this.config.ragService, metricsData);
    }
    /**
     * Get metrics
     */
    getMetrics() {
        return this.metrics?.getMetrics();
    }
    /**
     * Get metrics summary
     */
    getMetricsSummary() {
        return this.metrics?.getSummary() || 'Metrics not enabled';
    }
    /**
     * Reset metrics
     */
    resetMetrics() {
        this.metrics?.reset();
    }
    /**
     * Get rate limiter status
     */
    getRateLimiterStatus() {
        return {
            enabled: !!this.rateLimiter,
            availableTokens: this.rateLimiter?.getAvailableTokens(),
        };
    }
    /**
     * Get circuit breaker status
     */
    getCircuitBreakerStatus() {
        return {
            enabled: !!this.circuitBreaker,
            state: this.circuitBreaker?.getState(),
            failureCount: this.circuitBreaker?.getFailureCount(),
            successCount: this.circuitBreaker?.getSuccessCount(),
        };
    }
    /**
     * Reset circuit breaker
     */
    resetCircuitBreaker() {
        this.circuitBreaker?.reset();
    }
    /**
     * Get agent tools
     */
    getAgentTools(agentName) {
        return this.toolRegistry.getAgentTools(agentName);
    }
    /**
     * Approve a tool execution
     */
    approveToolExecution(requestId, approvedBy) {
        this.toolExecutor.approveExecution(requestId, approvedBy);
    }
    /**
     * Reject a tool execution
     */
    rejectToolExecution(requestId) {
        this.toolExecutor.rejectExecution(requestId);
    }
    /**
     * Get pending tool approvals
     */
    getPendingApprovals() {
        return this.toolExecutor.getPendingApprovals();
    }
    // ---------------------------------------------------------------------------
    // Multi-agent orchestration
    // ---------------------------------------------------------------------------
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
    createGraph(graphId) {
        return new agent_graph_1.AgentGraph(graphId, this);
    }
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
    createSupervisor(config) {
        if (!this.config.llmProvider) {
            throw new Error('createSupervisor() requires an LLM provider. ' +
                'Pass `llmProvider` in AgentRuntimeConfig.');
        }
        return new supervisor_1.SupervisorAgent(config, this.config.llmProvider, this);
    }
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
    async spawn(agentName, input, options = {}) {
        return this.execute(agentName, input, options);
    }
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
    pipeline(pipelineId, agentNames) {
        if (agentNames.length === 0) {
            throw new Error('pipeline() requires at least one agent name');
        }
        let graph = this.createGraph(pipelineId);
        for (const name of agentNames) {
            graph = graph.addNode(name, { type: 'agent', agentName: name });
        }
        for (let i = 0; i < agentNames.length - 1; i++) {
            graph = graph.addEdge(agentNames[i], agentNames[i + 1]);
        }
        graph = graph.addEdge(agentNames[agentNames.length - 1], '__end__');
        graph = graph.setEntryPoint(agentNames[0]);
        return graph.compile();
    }
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
    static async quick(agentClass, input, config = {}, options = {}) {
        const runtime = new AgentRuntime(config);
        runtime.registerAgent(agentClass);
        // Derive agent name from decorator metadata
        const agents = runtime.getAgents();
        if (agents.length === 0) {
            throw new Error('AgentRuntime.quick(): No agent found. Ensure the class is decorated with @Agent().');
        }
        return runtime.execute(agents[0], input, options);
    }
    /**
     * Shutdown the runtime
     */
    async shutdown() {
        const clearResult = this.stateManager.clear();
        if (clearResult instanceof Promise) {
            await clearResult;
        }
        this.eventEmitter.clear();
    }
    /**
     * Generate a session ID
     */
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.AgentRuntime = AgentRuntime;
