/**
 * Agent Runtime
 * Main runtime for managing agent lifecycle and execution
 */

import { AgentRegistry } from '../registry/agent.registry';
import { ToolRegistry } from '../registry/tool.registry';
import { AgentStateManager } from '../state/agent.state';
import { IAgentStateManager } from '../state/agent-state.interface';
import { AgentContextBuilder } from '../context/agent.context';
import { AgentExecutor } from '../executor/agent.executor';
import { ToolExecutor } from '../executor/tool.executor';
import { AgentEventEmitter } from '../events/event.emitter';
import {
  AgentExecutionOptions,
  AgentExecutionResult,
  AgentContext,
  AgentState,
} from '../types/agent.types';
import { AgentEventType } from '../types/event.types';
import { LLMProvider } from '../types/llm.types';
import { RAGService } from '../types/rag.types';
import { MemoryManager } from '@hazeljs/rag';
import { RateLimiter } from '../utils/rate-limiter';
import { MetricsCollector } from '../utils/metrics';
import { Logger, LogLevel } from '../utils/logger';
import { RetryHandler } from '../utils/retry';
import { CircuitBreaker } from '../utils/circuit-breaker';
import { HealthChecker, HealthCheckResult } from '../utils/health-check';

/**
 * Agent Runtime Configuration
 */
export interface AgentRuntimeConfig {
  stateManager?: IAgentStateManager;
  memoryManager?: MemoryManager;
  ragService?: RAGService;
  llmProvider?: LLMProvider;
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
export class AgentRuntime {
  private agentRegistry: AgentRegistry;
  private toolRegistry: ToolRegistry;
  private stateManager: IAgentStateManager;
  private contextBuilder: AgentContextBuilder;
  private toolExecutor: ToolExecutor;
  private agentExecutor: AgentExecutor;
  private eventEmitter: AgentEventEmitter;
  private config: AgentRuntimeConfig;
  private rateLimiter?: RateLimiter;
  private metrics?: MetricsCollector;
  private logger: Logger;
  private retryHandler?: RetryHandler;
  private circuitBreaker?: CircuitBreaker;
  private healthChecker: HealthChecker;

  constructor(config: AgentRuntimeConfig = {}) {
    this.config = {
      defaultMaxSteps: 10,
      defaultTimeout: 300000,
      enableObservability: true,
      enableMetrics: true,
      enableRetry: true,
      enableCircuitBreaker: true,
      logLevel: LogLevel.INFO,
      ...config,
    };

    // Initialize logger
    this.logger = new Logger({ level: this.config.logLevel });

    // Initialize rate limiter if configured
    if (this.config.rateLimitPerMinute) {
      this.rateLimiter = new RateLimiter({
        tokensPerMinute: this.config.rateLimitPerMinute,
      });
      this.logger.info('Rate limiter initialized', {
        tokensPerMinute: this.config.rateLimitPerMinute,
      });
    }

    // Initialize metrics collector if enabled
    if (this.config.enableMetrics) {
      this.metrics = new MetricsCollector();
      this.logger.info('Metrics collector initialized');
    }

    // Initialize retry handler if enabled
    if (this.config.enableRetry) {
      this.retryHandler = new RetryHandler({
        maxRetries: 3,
        initialDelayMs: 1000,
        onRetry: (attempt: number, error: Error): void => {
          this.logger.warn('Retrying operation', {
            attempt,
            error: error.message,
          });
        },
      });
    }

    // Initialize circuit breaker if enabled
    if (this.config.enableCircuitBreaker) {
      this.circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        successThreshold: 2,
        resetTimeout: 30000,
        onStateChange: (state: string): void => {
          this.logger.warn('Circuit breaker state changed', { state });
        },
      });
    }

    // Initialize health checker
    this.healthChecker = new HealthChecker();

    this.agentRegistry = new AgentRegistry();
    this.toolRegistry = new ToolRegistry();
    this.stateManager = config.stateManager || new AgentStateManager();
    this.contextBuilder = new AgentContextBuilder(config.memoryManager);
    this.eventEmitter = new AgentEventEmitter();

    this.toolExecutor = new ToolExecutor((type, data) => {
      this.eventEmitter.emit(type, '', '', data);
    });

    this.agentExecutor = new AgentExecutor(
      this.stateManager,
      this.contextBuilder,
      this.toolExecutor,
      this.toolRegistry,
      config.llmProvider,
      (type, executionId, data) => {
        this.eventEmitter.emit(type, '', executionId, data);
      }
    );

    this.logger.info('Agent runtime initialized', {
      enableMetrics: this.config.enableMetrics,
      enableRetry: this.config.enableRetry,
      enableCircuitBreaker: this.config.enableCircuitBreaker,
    });
  }

  /**
   * Register an agent class
   */
  registerAgent(agentClass: new (...args: unknown[]) => unknown): void {
    this.agentRegistry.register(agentClass);
  }

  /**
   * Register an agent instance
   */
  registerAgentInstance(agentName: string, instance: unknown): void {
    this.agentRegistry.registerInstance(agentName, instance);
    this.toolRegistry.registerAgentTools(agentName, instance);
  }

  /**
   * Execute an agent
   */
  async execute(
    agentName: string,
    input: string,
    options: AgentExecutionOptions = {}
  ): Promise<AgentExecutionResult> {
    // Check rate limit
    if (this.rateLimiter) {
      const allowed = await this.rateLimiter.waitForToken(5000);
      if (!allowed) {
        this.logger.error('Rate limit exceeded', undefined, { agentName });
        throw new Error('Rate limit exceeded - too many requests');
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

      success = result.state === AgentState.COMPLETED;
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
    } catch (error) {
      const duration = Date.now() - startTime;

      if (this.metrics) {
        this.metrics.recordExecution(false, duration);
      }

      this.logger.error('Agent execution failed', error as Error, {
        agentName,
        duration,
      });

      throw error;
    }
  }

  /**
   * Execute with retry and circuit breaker protection
   */
  private async executeWithProtection(
    agentName: string,
    input: string,
    options: AgentExecutionOptions
  ): Promise<AgentExecutionResult> {
    const executeFn = async (): Promise<AgentExecutionResult> => {
      const agent = this.agentRegistry.getAgent(agentName);
      if (!agent) {
        throw new Error(`Agent ${agentName} not found`);
      }

      const sessionId = options.sessionId || this.generateSessionId();
      const maxSteps = options.maxSteps || this.config.defaultMaxSteps || 10;

      const contextResult = this.stateManager.createContext(
        agentName,
        sessionId,
        input,
        options.userId,
        options.metadata
      );
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

      const result = await this.agentExecutor.execute(context, maxSteps);

      if (this.config.memoryManager) {
        await this.contextBuilder.persistToMemory(context);
      }

      return result;
    };

    // Apply circuit breaker if enabled
    if (this.circuitBreaker) {
      const circuitBreakerFn = (): Promise<AgentExecutionResult> =>
        this.circuitBreaker!.execute(executeFn);

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
   * Resume a paused execution
   */
  async resume(executionId: string, input?: string): Promise<AgentExecutionResult> {
    return this.agentExecutor.resume(executionId, input);
  }

  /**
   * Get execution context
   */
  async getContext(executionId: string): Promise<AgentContext | undefined> {
    const result = this.stateManager.getContext(executionId);
    return result instanceof Promise ? await result : result;
  }

  /**
   * Subscribe to agent events
   */
  on(type: AgentEventType, handler: (event: unknown) => void): void {
    this.eventEmitter.on(type, handler);
  }

  /**
   * Subscribe to all agent events
   */
  onAny(handler: (event: unknown) => void): void {
    this.eventEmitter.onAny(handler);
  }

  /**
   * Unsubscribe from events
   */
  off(type: AgentEventType, handler: (event: unknown) => void): void {
    this.eventEmitter.off(type, handler);
  }

  /**
   * Get all registered agents
   */
  getAgents(): string[] {
    return this.agentRegistry.getAllAgents().map((a) => a.name);
  }

  /**
   * Get agent metadata
   */
  getAgentMetadata(agentName: string): import('../types/agent.types').AgentMetadata | undefined {
    return this.agentRegistry.getAgent(agentName);
  }

  /**
   * Get health check status
   */
  async healthCheck(): Promise<HealthCheckResult> {
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
  getMetrics(): import('../utils/metrics').AgentMetrics | undefined {
    return this.metrics?.getMetrics();
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): string {
    return this.metrics?.getSummary() || 'Metrics not enabled';
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics?.reset();
  }

  /**
   * Get rate limiter status
   */
  getRateLimiterStatus(): { enabled: boolean; availableTokens?: number } {
    return {
      enabled: !!this.rateLimiter,
      availableTokens: this.rateLimiter?.getAvailableTokens(),
    };
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): {
    enabled: boolean;
    state?: string;
    failureCount?: number;
    successCount?: number;
  } {
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
  resetCircuitBreaker(): void {
    this.circuitBreaker?.reset();
  }

  /**
   * Get agent tools
   */
  getAgentTools(agentName: string): import('../types/tool.types').ToolMetadata[] {
    return this.toolRegistry.getAgentTools(agentName);
  }

  /**
   * Approve a tool execution
   */
  approveToolExecution(requestId: string, approvedBy: string): void {
    this.toolExecutor.approveExecution(requestId, approvedBy);
  }

  /**
   * Reject a tool execution
   */
  rejectToolExecution(requestId: string): void {
    this.toolExecutor.rejectExecution(requestId);
  }

  /**
   * Get pending tool approvals
   */
  getPendingApprovals(): import('../types/tool.types').ToolApprovalRequest[] {
    return this.toolExecutor.getPendingApprovals();
  }

  /**
   * Shutdown the runtime
   */
  async shutdown(): Promise<void> {
    const clearResult = this.stateManager.clear();
    if (clearResult instanceof Promise) {
      await clearResult;
    }
    this.eventEmitter.clear();
  }

  /**
   * Generate a session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
