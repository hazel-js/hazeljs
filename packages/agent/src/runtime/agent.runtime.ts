/**
 * Agent Runtime
 * Main runtime for managing agent lifecycle and execution
 */

import { AgentRegistry } from '../registry/agent.registry';
import { ToolRegistry } from '../registry/tool.registry';
import { resolveStateManager, CreateStateManagerOptions } from '../state/create-state-manager';
import { IAgentStateManager } from '../state/agent-state.interface';
import { EmittingStateManager } from '../state/emitting-state.manager';
import { createApprovalStore } from '../approval/create-approval-store';
import { IApprovalStore } from '../approval/approval-store.interface';
import { AgentContextBuilder } from '../context/agent.context';
import { AgentExecutor } from '../executor/agent.executor';
import { ToolExecutor } from '../executor/tool.executor';
import { AgentEventEmitter } from '../events/event.emitter';
import {
  AgentExecutionOptions,
  AgentExecutionResult,
  AgentContext,
  AgentState,
  IGuardrailsService,
  AgentStreamChunk,
} from '../types/agent.types';
import { AgentError } from '../errors/agent.error';
import { AgentEvent, AgentEventType, StateChangedEvent } from '../types/event.types';
import { LLMProvider } from '../types/llm.types';
import { RAGService } from '../types/rag.types';
import { MemoryManager } from '@hazeljs/rag';
import { RateLimiter } from '../utils/rate-limiter';
import { MetricsCollector } from '../utils/metrics';
import { Logger, LogLevel } from '../utils/logger';
import { RetryHandler } from '../utils/retry';
import { CircuitBreaker } from '@hazeljs/resilience';
import { HealthChecker, HealthCheckResult } from '../utils/health-check';
import { AgentGraph } from '../graph/agent-graph';
import { SupervisorAgent } from '../supervisor/supervisor';
import { SupervisorConfig } from '../graph/agent-graph.types';
import { getDelegatedMethods, getDelegateMetadata } from '../decorators/delegate.decorator';
import type { ObservabilityProvider } from '../types/observability.types';
import { runConfidenceLoop } from '../loop/confidence-loop';
import { AgentTimelineRecorder } from '../timeline/timeline.recorder';
import { TimeTravelDebugger } from '../timetravel/time-travel';
import { PolicyEngine } from '../policies/policy.engine';
import { CostOptimizer } from '../cost/cost-optimizer';
import { GovernanceGate } from '../governance/governance';
import { executeWithContract } from '../contracts/agent-contract';
import { runRecoveryLadder } from '../recovery/recovery-ladder';
import { attachTimelineStore } from '../timeline/timeline.store';
import { hotReloadAgentDna, type HotReloadResult } from '../dna/hot-reload';
import { installAgentPackage } from '../dna/marketplace';
import type { AgentDna, MarketplaceAgentPackage } from '../dna/agent-dna';
import { CircuitBreakerError } from '@hazeljs/resilience';
import { InMemoryAgentRunRepository, type AgentRunRepository } from '../run/agent-run.repository';
import { AgentRunStatus } from '../run/agent-run.types';
import { InMemoryHumanTaskService, type HumanTaskService } from '../run/human-task.service';
import { isDurableHitlCheckpoint, type DurableHitlCheckpoint } from '../run/durable-hitl.types';
import { startFlowHitlWait, resumeFlowHitlWait } from '../run/flow-hitl-bridge';
import { identityFromAgentConfig, type AgentIdentity } from '../identity/agent-identity';
import { PolicyService } from '../policies/policy.service';
import { BudgetExceededError, type RunBudget } from '../budget/run-budget';
import { InMemoryAgentScheduler, type AgentScheduler } from '../scheduler/agent-scheduler';
import { withAgentSpan, setAgentSpanAttributes } from '../utils/agent-tracing';
import { InMemoryCheckpointService, type CheckpointService } from '../run/checkpoint.service';
import type { AgentRun } from '../run/agent-run.types';
import {
  RepositoryAgentRunLeaseService,
  type AgentRunLease,
  type AgentRunLeaseService,
} from '../run/agent-run-lease';
/**
 * Agent Runtime Configuration
 */
export interface AgentRuntimeConfig {
  stateManager?: IAgentStateManager;
  /** Factory options when stateManager is not provided explicitly */
  stateManagerOptions?: CreateStateManagerOptions;
  approvalStore?: IApprovalStore;
  memoryManager?: MemoryManager;
  ragService?: RAGService;
  llmProvider?: LLMProvider;
  guardrailsService?: IGuardrailsService;
  observabilityProvider?: ObservabilityProvider;
  defaultMaxSteps?: number;
  defaultTimeout?: number;
  enableObservability?: boolean;
  rateLimitPerMinute?: number;
  enableMetrics?: boolean;
  logLevel?: LogLevel;
  enableRetry?: boolean;
  enableCircuitBreaker?: boolean;
  /** When true, event handler errors propagate instead of being logged only */
  strictEventHandlers?: boolean;
  /** Use Redis-backed approval store when redisClient is in stateManagerOptions (default: true when client present) */
  useRedisApprovals?: boolean;
  /** Agent OS Phase 2 — declarative tool policies */
  policyEngine?: import('../policies/policy.engine').PolicyEngine;
  /** Agent OS Phase 4 — governance gate */
  governanceGate?: import('../governance/governance').GovernanceGate;
  /** Agent OS Phase 3 — cost optimizer for model routing hints */
  costOptimizer?: import('../cost/cost-optimizer').CostOptimizer;
  /** Persist timeline steps (file JSONL or custom store) */
  timelineStore?: import('../timeline/timeline.store').TimelineStore;
  /** Knowledge freshness defaults for RAG */
  knowledgeFreshness?: { maxAgeMs?: number; minConfidence?: number };
  /** Agent OS — durable run repository (defaults to in-memory) */
  runRepository?: import('../run/agent-run.repository').AgentRunRepository;
  /** When false, skip AgentRun tracking (default true) */
  enableAgentRuns?: boolean;
  /** Agent OS — checkpoint service (defaults to in-memory) */
  checkpointService?: import('../run/checkpoint.service').CheckpointService;
  /** Agent OS — human tasks for HITL / approval (defaults to in-memory) */
  humanTaskService?: import('../run/human-task.service').HumanTaskService;
  /**
   * When true, approval-required tools suspend the AgentRun and return from execute()
   * instead of holding an in-process approval promise (AOS-006).
   */
  durableSuspend?: boolean;
  /**
   * Optional FlowEngine peer (ADR-003). When set with durableSuspend, mirrors HITL as flow WAITING.
   */
  flowEngine?: import('../run/flow-hitl-bridge').FlowEngineLike;
  /** Default run budget (AOS-012); overridable per execute. */
  defaultBudget?: import('../budget/run-budget').RunBudget;
  /** Agent scheduler for QUEUED / delayed runs (AOS-010). */
  scheduler?: import('../scheduler/agent-scheduler').AgentScheduler;
  /** Policy service for capability gates (AOS-008); auto-created when policyEngine set. */
  policyService?: import('../policies/policy.service').PolicyService;
  /**
   * Worker id for AgentRun leases (Gamma). When set, execute acquires a lease on the run.
   */
  workerId?: string;
  /** Override lease service (defaults to RepositoryAgentRunLeaseService when workerId set). */
  runLeaseService?: import('../run/agent-run-lease').AgentRunLeaseService;
  /** Lease TTL in ms (default 30_000). */
  runLeaseTtlMs?: number;
  /**
   * Optional tool authorization gate (e.g. @hazeljs/agent-gatekeeper via createToolExecutorGate).
   * When set, ToolExecutor delegates authorization to this gate instead of PolicyEngine.
   */
  authorizationGate?: import('../authorization/tool-authorization-gate.interface').ToolAuthorizationGate;
  /**
   * Optional tool effect gate (e.g. @hazeljs/agent-vm EffectGate).
   * Enforces effect lattice rules and journals reversible tool outputs.
   */
  effectGate?: import('../effects/tool-effect-gate.interface').IToolEffectGate;
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
  /** AbortControllers for in-flight executions, keyed by executionId (for cancel()). */
  private executionAbortControllers: Map<string, AbortController> = new Map();
  private timelineRecorder: AgentTimelineRecorder;
  private timeTravel: TimeTravelDebugger;
  private policyEngine?: PolicyEngine;
  private costOptimizer?: CostOptimizer;
  private governanceGate?: GovernanceGate;
  private runRepository: AgentRunRepository;
  private checkpointService: CheckpointService;
  private humanTaskService: HumanTaskService;
  private enableAgentRuns: boolean;
  private durableSuspend: boolean;
  private flowEngine?: import('../run/flow-hitl-bridge').FlowEngineLike;
  private defaultBudget?: RunBudget;
  private scheduler?: AgentScheduler;
  private policyService?: PolicyService;
  private runLeaseService?: AgentRunLeaseService;
  private workerId?: string;
  private runLeaseTtlMs: number;
  private activeLeases = new Map<string, AgentRunLease>();
  private stateHandlers: Map<
    (event: AgentEvent<StateChangedEvent>) => void,
    (event: AgentEvent) => void
  > = new Map();

  constructor(config: AgentRuntimeConfig = {}) {
    this.config = {
      defaultMaxSteps: 10,
      defaultTimeout: 300000,
      enableObservability: true,
      enableMetrics: true,
      enableRetry: true,
      enableCircuitBreaker: true,
      logLevel: LogLevel.INFO,
      enableAgentRuns: true,
      ...config,
    };

    this.enableAgentRuns = this.config.enableAgentRuns !== false;
    this.runRepository = this.config.runRepository ?? new InMemoryAgentRunRepository();
    this.checkpointService = this.config.checkpointService ?? new InMemoryCheckpointService();
    this.humanTaskService = this.config.humanTaskService ?? new InMemoryHumanTaskService();
    this.durableSuspend = this.config.durableSuspend === true;
    this.flowEngine = this.config.flowEngine;
    this.defaultBudget = this.config.defaultBudget;
    this.scheduler = this.config.scheduler;
    this.workerId = this.config.workerId;
    this.runLeaseTtlMs = this.config.runLeaseTtlMs ?? 30_000;
    this.runLeaseService =
      this.config.runLeaseService ??
      (this.workerId
        ? new RepositoryAgentRunLeaseService(this.runRepository, {
            defaultTtlMs: this.runLeaseTtlMs,
          })
        : undefined);

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
        onStateChange: (_from: unknown, to: unknown): void => {
          this.logger.warn('Circuit breaker state changed', { state: to });
        },
      });
    }

    // Initialize health checker
    this.healthChecker = new HealthChecker();

    this.agentRegistry = new AgentRegistry();
    this.toolRegistry = new ToolRegistry();
    this.eventEmitter = new AgentEventEmitter({
      strictEventHandlers: this.config.strictEventHandlers,
    });
    this.timelineRecorder = new AgentTimelineRecorder();
    this.timeTravel = new TimeTravelDebugger(this.timelineRecorder);
    this.policyEngine = config.policyEngine;
    this.policyService =
      this.config.policyService ??
      new PolicyService({ policyEngine: this.policyEngine ?? new PolicyEngine() });
    this.costOptimizer = config.costOptimizer ?? new CostOptimizer();
    this.governanceGate = config.governanceGate;
    if (this.scheduler) {
      this.scheduler.setHandler((job) => {
        void this.execute(job.agentName, job.input, {
          ...(job.options as AgentExecutionOptions | undefined),
          metadata: {
            ...((job.options as AgentExecutionOptions | undefined)?.metadata ?? {}),
            scheduledJobId: job.id,
            precreatedRunId: job.runId,
          },
        });
      });
    }
    this.eventEmitter.onAny((event) => {
      this.timelineRecorder.record(event);
    });
    if (config.timelineStore) {
      attachTimelineStore(this.timelineRecorder, config.timelineStore);
    }

    const rawStateManager = resolveStateManager(config.stateManager, config.stateManagerOptions);
    this.stateManager = new EmittingStateManager(
      rawStateManager,
      (type, agentId, executionId, data) => {
        void this.eventEmitter.emit(type, agentId, executionId, data);
      }
    );
    this.contextBuilder = new AgentContextBuilder(config.memoryManager);

    const useRedisApprovals =
      config.useRedisApprovals !== false && !!config.stateManagerOptions?.redisClient;

    const approvalStore =
      config.approvalStore ??
      createApprovalStore({
        redisClient: config.stateManagerOptions?.redisClient,
        useRedis: config.useRedisApprovals === true || useRedisApprovals,
      });

    this.toolExecutor = new ToolExecutor({
      eventEmitter: (type, data): void => {
        void this.eventEmitter.emit(type, '', '', data);
      },
      guardrailsService: config.guardrailsService,
      approvalStore,
      observabilityProvider: config.observabilityProvider,
      policyEngine: this.policyEngine,
      policyService: this.policyService,
      durableSuspend: this.durableSuspend,
      onApprovalRequested: (info): Promise<void> => this.handleApprovalRequested(info),
      onApprovalResolved: (info): Promise<void> => this.handleApprovalResolved(info),
      authorizationGate: config.authorizationGate,
      effectGate: config.effectGate,
    });

    this.agentExecutor = new AgentExecutor(
      this.stateManager,
      this.contextBuilder,
      this.toolExecutor,
      this.toolRegistry,
      config.llmProvider,
      (type, agentId, executionId, data) => {
        this.eventEmitter.emit(type, agentId, executionId, data);
      },
      config.observabilityProvider
    );

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
  setLLMProvider(provider: LLMProvider): void {
    this.config.llmProvider = provider;
    this.agentExecutor.setLlmProvider(provider);
  }

  /**
   * Register an agent class
   */
  registerAgent(agentClass: new (...args: unknown[]) => unknown): void {
    this.agentRegistry.register(agentClass);
  }

  /**
   * Register an agent instance.
   * Also patches any @Delegate-decorated methods so they call the target agent
   * via this runtime rather than executing the original (stub) method body.
   */
  registerAgentInstance(agentName: string, instance: unknown): void {
    this.agentRegistry.registerInstance(agentName, instance);
    this.patchDelegateMethods(agentName, instance);
    this.toolRegistry.registerAgentTools(agentName, instance);
  }

  /**
   * Replace @Delegate stub methods on an agent instance with real runtime calls.
   * Called automatically by registerAgentInstance().
   */
  private patchDelegateMethods(agentName: string, instance: unknown): void {
    if (!instance || typeof instance !== 'object') return;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const agentClass = (instance as any).constructor;
    const delegatedMethods = getDelegatedMethods(agentClass);

    for (const methodName of delegatedMethods) {
      const delegateConfig = getDelegateMetadata(instance as object, methodName);
      if (!delegateConfig) continue;

      const targetAgentName = delegateConfig.agent;
      const inputField = delegateConfig.inputField ?? 'input';

      // Patch the instance method to delegate to the target agent
      (instance as Record<string, unknown>)[methodName] = async (
        args: Record<string, unknown> | string
      ): Promise<string> => {
        const agentInput =
          typeof args === 'string' ? args : ((args[inputField] as string) ?? JSON.stringify(args));

        this.logger.debug(`Delegating from "${agentName}" to "${targetAgentName}"`, {
          input: agentInput,
        });

        const result = await this.execute(targetAgentName, agentInput, {
          parentRunId: undefined, // set below if we can find parent — callers use callAgent
          metadata: { delegatedFrom: agentName },
        });
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
  async execute(
    agentName: string,
    input: string,
    options: AgentExecutionOptions = {}
  ): Promise<AgentExecutionResult> {
    if (options.governance && this.governanceGate) {
      const decision = this.governanceGate.evaluate({
        ...options.governance,
        action: options.governance.action || 'agent.execute',
      });
      if (!decision.allowed) {
        throw new Error(`Governance denied: ${decision.reason}`);
      }
    }

    if (options.costRoute && this.costOptimizer) {
      const model = this.costOptimizer.selectModel(options.costRoute);
      options = {
        ...options,
        metadata: { ...options.metadata, costRoutedModel: model.id, costRoutedTier: model.tier },
      };
    }

    const runOnce = async (
      name: string,
      goal: string,
      opts: AgentExecutionOptions
    ): Promise<AgentExecutionResult> => {
      if (opts.recovery) {
        const ladder = await runRecoveryLadder({
          execute: (): Promise<AgentExecutionResult> => this.executeCore(name, goal, opts),
          executeFallback: opts.recovery.fallbackAgent
            ? (): Promise<AgentExecutionResult> =>
                this.executeCore(opts.recovery!.fallbackAgent!, goal, {
                  ...opts,
                  recovery: undefined,
                })
            : undefined,
          ladder: opts.recovery,
        });
        if (!ladder.success || !ladder.result) {
          throw ladder.error ?? new Error('Recovery ladder failed');
        }
        return ladder.result;
      }
      return this.executeCore(name, goal, opts);
    };

    if (options.contract) {
      const { result, validation, usedFallback } = await executeWithContract({
        contract: options.contract,
        input,
        primaryAgent: agentName,
        execute: (name, goal) => runOnce(name, goal, { ...options, contract: undefined }),
      });
      result.metadata = {
        ...result.metadata,
        contract: validation,
        usedFallback,
      };
      return result;
    }

    return runOnce(agentName, input, options);
  }

  /**
   * Core execute path (rate limit + loop + protection). Prefer `execute()`.
   */
  private async executeCore(
    agentName: string,
    input: string,
    options: AgentExecutionOptions = {}
  ): Promise<AgentExecutionResult> {
    return withAgentSpan(
      'agent.run',
      {
        'agent.name': agentName,
        'agent.session_id': options.sessionId ?? '',
        'agent.user_id': options.userId ?? '',
      },
      async () => {
        // Check rate limit
        if (this.rateLimiter) {
          const allowed = await this.rateLimiter.waitForToken(5000);
          if (!allowed) {
            this.logger.error('Rate limit exceeded', undefined, { agentName });
            throw AgentError.rateLimitExceeded();
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

          const result = options.loop
            ? await runConfidenceLoop({
                agentName,
                input,
                options,
                executeOnce: (name, goal, opts) => this.executeWithProtection(name, goal, opts),
                llmProvider: this.config.llmProvider,
                stateManager: this.stateManager,
                emit: (type, agentId, executionId, data) => {
                  void this.eventEmitter.emit(type, agentId, executionId, data);
                },
              })
            : await this.executeWithProtection(agentName, input, options);

          success = result.state === AgentState.COMPLETED;
          const duration = Date.now() - startTime;

          setAgentSpanAttributes({
            'agent.run_id': result.executionId,
            'agent.execution_id': result.executionId,
            'agent.state': String(result.state),
            'agent.duration_ms': duration,
          });

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
      },
      this.config.observabilityProvider
    );
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

      const identity: AgentIdentity =
        options.identity ??
        identityFromAgentConfig({
          name: agent.name,
          version: agent.version,
          tenantId: agent.tenantId,
          capabilities: agent.capabilities,
        });
      this.policyService?.setIdentity(identity);
      this.toolExecutor.setAgentIdentity(identity);

      const sessionId = options.sessionId || this.generateSessionId();
      const maxSteps = options.maxSteps || this.config.defaultMaxSteps || 10;

      const contextResult = this.stateManager.createContext(
        agentName,
        sessionId,
        input,
        options.userId,
        {
          ...options.metadata,
          systemPrompt: agent.systemPrompt,
          agentDescription: agent.description,
        }
      );
      const context = contextResult instanceof Promise ? await contextResult : contextResult;

      if (options.enableMemory !== false && this.config.memoryManager) {
        await this.stateManager.updateState(context.executionId, AgentState.SEARCHING_MEMORY);
        await this.contextBuilder.buildWithMemory(context);
      }

      if (options.enableRAG !== false && this.config.ragService) {
        await this.stateManager.updateState(context.executionId, AgentState.SEARCHING_KNOWLEDGE);
        await this.contextBuilder.buildWithRAG(
          context,
          this.config.ragService,
          agent.ragTopK || 5,
          (error) => this.handleRagError(context, error),
          this.config.knowledgeFreshness
        );
      }

      if (options.initialContext) {
        Object.assign(context.memory.workingMemory, options.initialContext);
      }

      await this.trackRunCreated(agentName, context.executionId, input, options);

      let controller: AbortController | undefined;
      if (!options.signal) {
        controller = new AbortController();
        this.executionAbortControllers.set(context.executionId, controller);
      }
      const signal = options.signal ?? controller?.signal;
      const timeoutMs = options.timeout ?? this.config.defaultTimeout;

      try {
        await this.trackRunStatus(context.executionId, AgentRunStatus.RUNNING);
        await this.acquireRunLease(context.executionId);
        await this.stateManager.updateState(context.executionId, AgentState.THINKING);
        const result = await this.agentExecutor.execute(context, maxSteps, {
          timeoutMs,
          signal,
          streaming: options.streaming,
          budget: options.budget ?? this.defaultBudget,
          modelId: agent.model,
        });
        if (result.state === AgentState.WAITING_FOR_APPROVAL) {
          await this.persistDurableHitlSuspend(context, result, agentName, maxSteps);
          await this.releaseRunLease(context.executionId);
          return result;
        }
        if (result.state === AgentState.WAITING_FOR_INPUT) {
          await this.releaseRunLease(context.executionId);
          return result;
        }
        if (result.state === AgentState.FAILED) {
          const isBudget =
            result.error instanceof BudgetExceededError ||
            result.error?.name === 'BudgetExceededError';
          await this.trackRunStatus(
            context.executionId,
            isBudget ? AgentRunStatus.CANCELLED : AgentRunStatus.FAILED,
            {
              error: {
                message: result.error?.message ?? 'Agent execution failed',
                code: isBudget ? 'BUDGET_EXCEEDED' : undefined,
              },
            }
          );
          await this.releaseRunLease(context.executionId);
          throw result.error ?? new Error('Agent execution failed');
        }
        if (this.config.memoryManager) {
          await this.contextBuilder.persistToMemory(context);
        }
        await this.trackRunStatus(context.executionId, AgentRunStatus.COMPLETED, {
          output: result.response,
        });
        await this.releaseRunLease(context.executionId);
        return result;
      } catch (err) {
        const existing = await this.runRepository.get(context.executionId);
        if (
          existing &&
          existing.status !== AgentRunStatus.CANCELLED &&
          existing.status !== AgentRunStatus.FAILED &&
          existing.status !== AgentRunStatus.COMPLETED
        ) {
          const message = err instanceof Error ? err.message : String(err);
          const isCancel =
            message.toLowerCase().includes('cancel') ||
            (err instanceof AgentError &&
              String((err as { code?: string }).code).includes('CANCEL'));
          await this.trackRunStatus(
            context.executionId,
            isCancel ? AgentRunStatus.CANCELLED : AgentRunStatus.FAILED,
            {
              error: { message },
            }
          );
        }
        await this.releaseRunLease(context.executionId);
        throw err;
      } finally {
        if (controller) {
          this.executionAbortControllers.delete(context.executionId);
        }
      }
    };

    // Apply circuit breaker if enabled
    if (this.circuitBreaker) {
      const circuitBreakerFn = async (): Promise<AgentExecutionResult> => {
        try {
          return await this.circuitBreaker!.execute(executeFn);
        } catch (e) {
          if (e instanceof CircuitBreakerError) {
            throw Object.assign(e, { agentStateHint: AgentState.BLOCKED });
          }
          throw e;
        }
      };

      if (this.retryHandler) {
        return this.executeWithRetryStates(circuitBreakerFn);
      }

      return circuitBreakerFn();
    }

    if (this.retryHandler) {
      return this.executeWithRetryStates(executeFn);
    }

    return executeFn();
  }

  /** Errors that should fail fast (no backoff retries). */
  private isNonRetryableExecutionError(error: unknown): boolean {
    if (error instanceof CircuitBreakerError) return true;
    const msg = error instanceof Error ? error.message : String(error);
    return /not found|not registered|is not decorated|already registered|invalid dna/i.test(msg);
  }

  /** Retry with RETRYING / BLOCKED state transitions when an executionId is known. */
  private async executeWithRetryStates(
    fn: () => Promise<AgentExecutionResult>
  ): Promise<AgentExecutionResult> {
    let lastExecutionId: string | undefined;
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        if (attempt > 1 && lastExecutionId) {
          await this.stateManager.updateState(lastExecutionId, AgentState.RETRYING);
        }
        const result = await fn();
        lastExecutionId = result.executionId;
        return result;
      } catch (e) {
        if (e instanceof CircuitBreakerError) {
          if (lastExecutionId) {
            await this.stateManager.updateState(lastExecutionId, AgentState.BLOCKED);
          }
          throw e;
        }
        if (this.isNonRetryableExecutionError(e) || attempt >= maxAttempts) throw e;
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 5000)));
      }
    }
    throw new Error('Retry exhausted');
  }

  /**
   * Execute an agent and stream step/token chunks.
   * When `options.loop` is set, runs the confidence loop via `execute()` and yields a final `done` chunk.
   */
  async *executeStream(
    agentName: string,
    input: string,
    options: AgentExecutionOptions = {}
  ): AsyncGenerator<AgentStreamChunk> {
    if (options.loop) {
      const result = await this.execute(agentName, input, options);
      yield { type: 'done', result };
      return;
    }

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
      {
        ...options.metadata,
        systemPrompt: agent.systemPrompt,
        agentDescription: agent.description,
      }
    );
    const context = contextResult instanceof Promise ? await contextResult : contextResult;

    if (options.enableMemory !== false && this.config.memoryManager) {
      await this.stateManager.updateState(context.executionId, AgentState.SEARCHING_MEMORY);
      await this.contextBuilder.buildWithMemory(context);
    }
    if (options.enableRAG !== false && this.config.ragService) {
      await this.stateManager.updateState(context.executionId, AgentState.SEARCHING_KNOWLEDGE);
      await this.contextBuilder.buildWithRAG(
        context,
        this.config.ragService,
        agent.ragTopK || 5,
        (error) => this.handleRagError(context, error),
        this.config.knowledgeFreshness
      );
    }
    if (options.initialContext) {
      Object.assign(context.memory.workingMemory, options.initialContext);
    }

    let controller: AbortController | undefined;
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
    } finally {
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
   * Cancel an in-flight execution by executionId.
   * The running execute() will throw AgentError (CANCELLED) when it next checks the signal.
   */
  cancel(executionId: string): void {
    const controller = this.executionAbortControllers.get(executionId);
    if (controller) {
      controller.abort();
      this.executionAbortControllers.delete(executionId);
      this.logger.info('Execution cancelled', { executionId });
    }
    void this.trackRunStatus(executionId, AgentRunStatus.CANCELLED).then(() => {
      void this.eventEmitter.emit(AgentEventType.RUN_CANCELLED, 'unknown', executionId, {
        executionId,
      });
    });
  }

  /** Agent OS — durable run repository */
  getRunRepository(): AgentRunRepository {
    return this.runRepository;
  }

  /** Agent OS — checkpoint service */
  getCheckpointService(): CheckpointService {
    return this.checkpointService;
  }

  async getRun(runId: string): Promise<AgentRun | undefined> {
    return this.runRepository.get(runId);
  }

  getHumanTaskService(): HumanTaskService {
    return this.humanTaskService;
  }

  getPolicyService(): PolicyService | undefined {
    return this.policyService;
  }

  getScheduler(): AgentScheduler | undefined {
    return this.scheduler ?? undefined;
  }

  getRunLeaseService(): AgentRunLeaseService | undefined {
    return this.runLeaseService;
  }

  /**
   * Typed child-agent call with parent/root AgentRun linkage (AOS-009).
   */
  async callAgent(
    targetAgent: string,
    input: string,
    options: AgentExecutionOptions & { parentRunId?: string; rootRunId?: string } = {}
  ): Promise<AgentExecutionResult> {
    const parentRunId = options.parentRunId;
    if (parentRunId && this.enableAgentRuns) {
      const parent = await this.runRepository.get(parentRunId);
      if (parent && parent.status === AgentRunStatus.RUNNING) {
        await this.trackRunStatus(parentRunId, AgentRunStatus.WAITING_FOR_AGENT);
      }
    }
    void this.eventEmitter.emit(AgentEventType.AGENT_CALL_STARTED, targetAgent, parentRunId ?? '', {
      targetAgent,
      parentRunId,
    });
    try {
      const result = await this.execute(targetAgent, input, {
        ...options,
        parentRunId,
        rootRunId: options.rootRunId ?? parentRunId,
        metadata: {
          ...options.metadata,
          parentRunId,
          rootRunId: options.rootRunId ?? parentRunId,
        },
      });
      if (parentRunId && this.enableAgentRuns) {
        const parent = await this.runRepository.get(parentRunId);
        if (parent?.status === AgentRunStatus.WAITING_FOR_AGENT) {
          await this.trackRunStatus(parentRunId, AgentRunStatus.RUNNING);
        }
      }
      void this.eventEmitter.emit(
        AgentEventType.AGENT_CALL_COMPLETED,
        targetAgent,
        result.executionId,
        { parentRunId, state: result.state }
      );
      return result;
    } catch (err) {
      if (parentRunId && this.enableAgentRuns) {
        const parent = await this.runRepository.get(parentRunId);
        if (parent?.status === AgentRunStatus.WAITING_FOR_AGENT) {
          await this.trackRunStatus(parentRunId, AgentRunStatus.RUNNING);
        }
      }
      throw err;
    }
  }

  /**
   * Queue or delay an agent run (AOS-010). Creates AgentRun in QUEUED then executes when due.
   */
  async scheduleRun(
    agentName: string,
    input: string,
    opts: { at?: Date; runId?: string; options?: AgentExecutionOptions } = {}
  ): Promise<{ jobId: string; runId: string }> {
    const scheduler = this.scheduler ?? new InMemoryAgentScheduler();
    if (!this.scheduler) {
      this.scheduler = scheduler;
      scheduler.setHandler((job) => {
        void this.execute(job.agentName, job.input, {
          ...(job.options as AgentExecutionOptions | undefined),
          metadata: {
            ...((job.options as AgentExecutionOptions | undefined)?.metadata ?? {}),
            scheduledJobId: job.id,
          },
        });
      });
    }
    const runId = opts.runId ?? `queued_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (this.enableAgentRuns) {
      const existing = await this.runRepository.get(runId);
      if (!existing) {
        await this.runRepository.create({
          id: runId,
          agentName,
          input,
          metadata: { scheduled: true },
        });
        await this.runRepository.updateStatus(runId, AgentRunStatus.QUEUED);
      }
    }
    const when = opts.at ?? new Date();
    const jobId = await scheduler.scheduleAt(when, {
      id: undefined,
      agentName,
      input,
      runId,
      options: opts.options as Record<string, unknown> | undefined,
    });
    return { jobId, runId };
  }

  /**
   * Persist a durable HITL checkpoint and mark the run SUSPENDED (AOS-006).
   * Prefer `approveAndResume` to continue after approval.
   */
  async suspendRun(runId: string, payload?: unknown): Promise<AgentRun | undefined> {
    if (!this.enableAgentRuns) return undefined;
    const existing = await this.runRepository.get(runId);
    if (!existing) return undefined;
    const cp = await this.checkpointService.save(runId, payload ?? { reason: 'suspend' });
    await this.trackRunStatus(runId, AgentRunStatus.SUSPENDED, { checkpointId: cp.id });
    await this.releaseRunLease(runId);
    void this.eventEmitter.emit(AgentEventType.CHECKPOINT_CREATED, existing.agentName, runId, {
      checkpointId: cp.id,
    });
    return this.runRepository.get(runId);
  }

  /**
   * Mark a suspended run RUNNING again (status only).
   * For durable HITL continuation after approval, use `approveAndResume`.
   */
  async resumeRun(runId: string): Promise<AgentRun | undefined> {
    if (!this.enableAgentRuns) return undefined;
    await this.trackRunStatus(runId, AgentRunStatus.RUNNING);
    await this.acquireRunLease(runId);
    return this.runRepository.get(runId);
  }

  /**
   * Approve or reject a durable HITL wait and continue the agent (AOS-006).
   * Survives process restart when using file-backed run/checkpoint/human-task stores.
   */
  async approveAndResume(
    runIdOrRequestId: string,
    opts: { approved: boolean; approvedBy: string }
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    let run = await this.runRepository.get(runIdOrRequestId);
    let requestId: string | undefined;

    if (!run) {
      const all = await this.runRepository.list();
      for (const r of all) {
        const tasks = await this.humanTaskService.listByRun(r.id);
        const hit = tasks.find(
          (t) =>
            t.status === 'pending' &&
            (t.id === runIdOrRequestId ||
              t.metadata?.requestId === runIdOrRequestId ||
              (t.payload as { requestId?: string } | undefined)?.requestId === runIdOrRequestId)
        );
        if (hit) {
          run = r;
          requestId = String(
            hit.metadata?.requestId ?? (hit.payload as { requestId?: string })?.requestId ?? ''
          );
          break;
        }
      }
    }

    if (!run) {
      throw new Error(`AgentRun not found for approveAndResume: ${runIdOrRequestId}`);
    }

    const runId = run.id;
    const cp = await this.checkpointService.load(runId, run.checkpointId);
    if (!cp || !isDurableHitlCheckpoint(cp.payload)) {
      throw new Error(`No durable HITL checkpoint for run ${runId}`);
    }
    const payload = cp.payload;
    requestId = requestId ?? payload.pendingTool.requestId;

    const tasks = await this.humanTaskService.listByRun(runId);
    const pending = tasks.find(
      (t) =>
        t.status === 'pending' &&
        (t.metadata?.requestId === requestId ||
          (t.payload as { requestId?: string } | undefined)?.requestId === requestId)
    );
    if (pending) {
      await this.humanTaskService.resolve(
        pending.id,
        opts.approved ? 'approved' : 'rejected',
        opts.approvedBy
      );
    }

    if (payload.flowRunId && this.flowEngine) {
      await resumeFlowHitlWait(this.flowEngine, payload.flowRunId, {
        approved: opts.approved,
        requestId,
        approvedBy: opts.approvedBy,
      });
    }

    if (!opts.approved) {
      await this.trackRunStatus(runId, AgentRunStatus.CANCELLED, {
        error: { message: `Tool approval rejected by ${opts.approvedBy}` },
      });
      return {
        executionId: runId,
        agentId: payload.agentName,
        state: AgentState.FAILED,
        error: new Error('Tool execution rejected by user'),
        steps: payload.context.steps ?? [],
        metadata: { rejected: true, requestId },
        duration: Date.now() - startTime,
        completedAt: new Date(),
      };
    }

    await this.trackRunStatus(runId, AgentRunStatus.RUNNING);
    await this.acquireRunLease(runId);

    const context = { ...payload.context, state: AgentState.THINKING };
    if (typeof this.stateManager.putContext !== 'function') {
      throw new Error(
        'State manager does not support putContext (required for durable HITL resume)'
      );
    }
    await this.stateManager.putContext(context);

    const fullToolName = `${context.agentId}.${payload.pendingTool.toolName}`;
    const tool = this.toolRegistry.getTool(fullToolName);
    if (!tool) {
      await this.trackRunStatus(runId, AgentRunStatus.FAILED, {
        error: { message: `Tool not found on resume: ${payload.pendingTool.toolName}` },
      });
      throw new Error(`Tool not found on resume: ${payload.pendingTool.toolName}`);
    }

    const toolResult = await this.toolExecutor.execute(
      tool,
      payload.pendingTool.toolInput,
      context.agentId,
      context.sessionId,
      context.userId,
      runId,
      { skipApproval: true }
    );

    const toolSummary = `[Tool: ${payload.pendingTool.toolName}]\nInput: ${JSON.stringify(payload.pendingTool.toolInput)}\nOutput: ${JSON.stringify(toolResult.output)}`;
    await this.stateManager.addMessage(runId, 'assistant', toolSummary);

    if (!toolResult.success) {
      await this.trackRunStatus(runId, AgentRunStatus.FAILED, {
        error: { message: toolResult.error?.message ?? 'Tool failed after approval' },
      });
      await this.releaseRunLease(runId);
      return {
        executionId: runId,
        agentId: context.agentId,
        state: AgentState.FAILED,
        error: toolResult.error ?? new Error('Tool failed after approval'),
        steps: context.steps,
        metadata: { requestId },
        duration: Date.now() - startTime,
        completedAt: new Date(),
      };
    }

    const refreshed = (await this.stateManager.getContext(runId)) ?? context;
    refreshed.state = AgentState.THINKING;
    const result = await this.agentExecutor.execute(refreshed, payload.maxSteps);
    if (
      result.state === AgentState.WAITING_FOR_APPROVAL ||
      result.state === AgentState.WAITING_FOR_INPUT
    ) {
      if (result.state === AgentState.WAITING_FOR_APPROVAL) {
        await this.persistDurableHitlSuspend(
          refreshed,
          result,
          payload.agentName,
          payload.maxSteps
        );
      }
      await this.releaseRunLease(runId);
      return result;
    }
    if (result.state === AgentState.FAILED) {
      await this.trackRunStatus(runId, AgentRunStatus.FAILED, {
        error: { message: result.error?.message ?? 'Agent execution failed after resume' },
      });
      await this.releaseRunLease(runId);
      return result;
    }
    await this.trackRunStatus(runId, AgentRunStatus.COMPLETED, { output: result.response });
    await this.releaseRunLease(runId);
    return result;
  }

  private async persistDurableHitlSuspend(
    context: AgentContext,
    result: AgentExecutionResult,
    agentName: string,
    maxSteps: number
  ): Promise<void> {
    const pending = (result.metadata?.pendingApproval ?? {}) as {
      requestId?: string;
      toolName?: string;
      toolInput?: Record<string, unknown>;
    };

    let flowRunId: string | undefined;
    if (this.durableSuspend && this.flowEngine) {
      try {
        flowRunId = await startFlowHitlWait(this.flowEngine, {
          agentRunId: context.executionId,
          requestId: pending.requestId,
        });
      } catch (err) {
        this.logger.warn('Flow HITL bridge failed; continuing with agent-owned durability', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const live = (await this.stateManager.getContext(context.executionId)) ?? context;
    const checkpoint: DurableHitlCheckpoint = {
      kind: 'durable_hitl',
      context: live,
      pendingTool: {
        toolName: pending.toolName ?? 'unknown',
        toolInput: pending.toolInput ?? {},
        requestId: pending.requestId ?? '',
      },
      maxSteps,
      agentName,
      flowRunId,
    };

    await this.suspendRun(context.executionId, checkpoint);
  }

  private async handleApprovalRequested(info: {
    runId?: string;
    requestId: string;
    toolName: string;
    input: Record<string, unknown>;
  }): Promise<void> {
    if (!info.runId || !this.enableAgentRuns) return;
    const existing = await this.runRepository.get(info.runId);
    if (!existing || existing.status !== AgentRunStatus.RUNNING) return;

    const cp = await this.checkpointService.save(info.runId, {
      kind: 'tool_approval',
      requestId: info.requestId,
      toolName: info.toolName,
      input: info.input,
    });

    await this.trackRunStatus(info.runId, AgentRunStatus.WAITING_FOR_HUMAN, {
      checkpointId: cp.id,
      metadata: {
        pendingApprovalRequestId: info.requestId,
        pendingToolName: info.toolName,
      },
    });

    await this.humanTaskService.create({
      runId: info.runId,
      type: 'tool_approval',
      toolName: info.toolName,
      payload: { requestId: info.requestId, input: info.input },
      metadata: { requestId: info.requestId },
    });

    void this.eventEmitter.emit(AgentEventType.CHECKPOINT_CREATED, existing.agentName, info.runId, {
      checkpointId: cp.id,
    });
  }

  private async handleApprovalResolved(info: {
    runId?: string;
    requestId: string;
    approved: boolean;
  }): Promise<void> {
    if (!info.runId || !this.enableAgentRuns) return;
    const existing = await this.runRepository.get(info.runId);
    if (!existing || existing.status !== AgentRunStatus.WAITING_FOR_HUMAN) return;

    const tasks = await this.humanTaskService.listByRun(info.runId);
    const pending = tasks.find(
      (t) =>
        t.status === 'pending' &&
        (t.metadata?.requestId === info.requestId ||
          (t.payload as { requestId?: string } | undefined)?.requestId === info.requestId)
    );
    if (pending) {
      await this.humanTaskService.resolve(pending.id, info.approved ? 'approved' : 'rejected');
    }

    if (info.approved) {
      await this.trackRunStatus(info.runId, AgentRunStatus.RUNNING, {
        metadata: { pendingApprovalRequestId: undefined, pendingToolName: undefined },
      });
    }
  }

  private async trackRunCreated(
    agentName: string,
    executionId: string,
    input: string,
    options: AgentExecutionOptions
  ): Promise<void> {
    if (!this.enableAgentRuns) return;
    const existing = await this.runRepository.get(executionId);
    if (existing) return;
    const agent = this.agentRegistry.getAgent(agentName);
    const identity =
      options.identity ??
      (agent
        ? identityFromAgentConfig({
            name: agent.name,
            version: agent.version,
            tenantId: agent.tenantId,
            capabilities: agent.capabilities,
          })
        : undefined);
    const parentRunId =
      options.parentRunId ?? (options.metadata?.parentRunId as string | undefined);
    const rootRunId =
      options.rootRunId ??
      (options.metadata?.rootRunId as string | undefined) ??
      parentRunId ??
      executionId;
    const run = await this.runRepository.create({
      id: executionId,
      agentName,
      agentVersion: identity?.version ?? agent?.version,
      input,
      userId: options.userId,
      tenantId: identity?.tenantId ?? agent?.tenantId,
      parentRunId,
      rootRunId,
      metadata: {
        ...options.metadata,
        capabilities: identity?.capabilities,
      },
    });
    void this.eventEmitter.emit(AgentEventType.RUN_CREATED, agentName, executionId, { run });
  }

  private async trackRunStatus(
    executionId: string,
    status: AgentRunStatus,
    patch?: Parameters<AgentRunRepository['updateStatus']>[2]
  ): Promise<void> {
    if (!this.enableAgentRuns) return;
    const existing = await this.runRepository.get(executionId);
    if (!existing) return;
    if (existing.status === status && !patch) return;
    try {
      const run = await this.runRepository.updateStatus(executionId, status, patch);
      if (existing.status !== status) {
        void this.eventEmitter.emit(
          AgentEventType.RUN_STATUS_CHANGED,
          existing.agentName,
          executionId,
          {
            from: existing.status,
            to: status,
            run,
          }
        );
      }
    } catch (e) {
      this.logger.warn('AgentRun status update skipped', {
        executionId,
        status,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  private async acquireRunLease(runId: string): Promise<void> {
    if (!this.runLeaseService || !this.workerId) return;
    const result = await this.runLeaseService.tryAcquire(runId, this.workerId, this.runLeaseTtlMs);
    if (!result.acquired || !result.lease) {
      throw AgentError.leaseHeld(runId);
    }
    this.activeLeases.set(runId, result.lease);
  }

  private async releaseRunLease(runId: string): Promise<void> {
    const lease = this.activeLeases.get(runId);
    if (!lease || !this.runLeaseService) return;
    this.activeLeases.delete(runId);
    try {
      await this.runLeaseService.release(runId, lease.owner, lease.token);
    } catch (e) {
      this.logger.warn('AgentRun lease release failed', {
        runId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /**
   * Subscribe to agent events
   */
  on(type: AgentEventType, handler: (event: unknown) => void): void {
    this.eventEmitter.on(type, handler);
  }

  /**
   * Subscribe when the agent enters a specific state.
   * @example runtime.onState('planning', (e) => console.log(e))
   */
  onState(
    state: AgentState | string,
    callback: (event: AgentEvent<StateChangedEvent>) => void | Promise<void>
  ): void {
    const wrapped = (event: AgentEvent): void => {
      if (event.type !== AgentEventType.STATE_CHANGED) return;
      const data = event.data as StateChangedEvent;
      if (data.newState === state) {
        void callback(event as AgentEvent<StateChangedEvent>);
      }
    };
    this.stateHandlers.set(callback as (event: AgentEvent<StateChangedEvent>) => void, wrapped);
    this.eventEmitter.on(AgentEventType.STATE_CHANGED, wrapped);
  }

  /**
   * Subscribe to every state transition.
   */
  onStateChange(callback: (event: AgentEvent<StateChangedEvent>) => void | Promise<void>): void {
    this.eventEmitter.on(AgentEventType.STATE_CHANGED, callback as (event: AgentEvent) => void);
  }

  /**
   * Subscribe to all agent events
   */
  onAny(handler: (event: unknown) => void): void {
    this.eventEmitter.onAny(handler);
  }

  offAny(handler: (event: unknown) => void): void {
    this.eventEmitter.offAny(handler);
  }

  /**
   * Emit a control-plane or runtime event.
   */
  emit(type: AgentEventType, agentId: string, executionId: string, data: unknown): void {
    void this.eventEmitter.emit(type, agentId, executionId, data);
  }

  unregisterAgent(name: string): void {
    this.agentRegistry.unregister(name);
    this.toolRegistry.unregisterAgentTools(name);
  }

  /**
   * Unsubscribe from events
   */
  off(type: AgentEventType, handler: (event: unknown) => void): void {
    this.eventEmitter.off(type, handler);
  }

  /**
   * Timeline recorder for Inspector / Visual Reasoning Timeline.
   */
  getTimelineRecorder(): AgentTimelineRecorder {
    return this.timelineRecorder;
  }

  /**
   * Get recorded timeline for an agent (by name) or executionId.
   */
  getTimeline(filter: {
    agentName?: string;
    executionId?: string;
  }): import('../timeline/timeline.recorder').TimelineStep[] {
    return this.timelineRecorder.getTimeline(filter);
  }

  /** Agent OS Phase 2 — time travel debugger */
  getTimeTravel(): TimeTravelDebugger {
    return this.timeTravel;
  }

  setPolicyEngine(engine: PolicyEngine): void {
    this.policyEngine = engine;
    this.toolExecutor.setPolicyEngine(engine);
  }

  getPolicyEngine(): PolicyEngine | undefined {
    return this.policyEngine;
  }

  getCostOptimizer(): CostOptimizer | undefined {
    return this.costOptimizer;
  }

  getGovernanceGate(): GovernanceGate | undefined {
    return this.governanceGate;
  }

  /** Shared execution state — used by @hazeljs/agent-vm BranchStateManager. */
  getStateManager(): IAgentStateManager {
    return this.stateManager;
  }

  /** Registered agent instance (for compensation handlers). */
  getAgentInstance(agentName: string): unknown | undefined {
    return this.agentRegistry.getInstance(agentName);
  }

  /** Wire or replace the tool effect gate (@hazeljs/agent-vm). */
  setEffectGate(
    gate: import('../effects/tool-effect-gate.interface').IToolEffectGate | undefined
  ): void {
    this.toolExecutor.setEffectGate(gate);
  }

  /** Hot-reload agent DNA (system prompt, model, policies, dynamic tools) without restart. */
  hotReloadDna(dna: string | AgentDna): HotReloadResult {
    return hotReloadAgentDna(
      {
        getAgent: (name) => this.agentRegistry.getAgent(name),
        patchAgent: (name, patch) => this.agentRegistry.patchAgent(name, patch),
        setPolicyEngine: (engine) => this.setPolicyEngine(engine),
        getPolicyEngine: () => this.policyEngine,
        registerDynamicTool: (agentName, tool) =>
          this.toolRegistry.registerDynamicTool(agentName, tool),
      },
      dna
    );
  }

  /** Install a marketplace package or .dna JSON file into the live runtime. */
  installAgentPackage(source: string | AgentDna | MarketplaceAgentPackage): HotReloadResult {
    return installAgentPackage(
      {
        getAgent: (name) => this.agentRegistry.getAgent(name),
        patchAgent: (name, patch) => this.agentRegistry.patchAgent(name, patch),
        setPolicyEngine: (engine) => this.setPolicyEngine(engine),
        getPolicyEngine: () => this.policyEngine,
        registerDynamicTool: (agentName, tool) =>
          this.toolRegistry.registerDynamicTool(agentName, tool),
      },
      source
    );
  }

  /** Register or replace a dynamic tool (DNA / CLI bootstrap). */
  registerDynamicTool(
    agentName: string,
    tool: Parameters<ToolRegistry['registerDynamicTool']>[1]
  ): void {
    this.toolRegistry.registerDynamicTool(agentName, tool);
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

  /** Same registry Skillgate / dynamic tools register into. */
  getToolRegistry(): import('../registry/tool.registry').ToolRegistry {
    return this.toolRegistry;
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

  async getPendingApprovalsAsync(): Promise<import('../types/tool.types').ToolApprovalRequest[]> {
    return this.toolExecutor.getPendingApprovalsAsync();
  }

  private handleRagError(context: AgentContext, error: Error): void {
    this.logger.error('RAG query failed', error, {
      executionId: context.executionId,
      sessionId: context.sessionId,
    });
    if (this.metrics) {
      this.metrics.recordLLMCall(0, true);
    }
    void this.eventEmitter.emit(
      AgentEventType.RAG_QUERY_FAILED,
      context.agentId,
      context.executionId,
      {
        error: error.message,
        input: context.input,
      }
    );
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
  createGraph(graphId: string): AgentGraph {
    return new AgentGraph(graphId, this);
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
  createSupervisor(config: SupervisorConfig): SupervisorAgent {
    if (!this.config.llmProvider) {
      throw new Error(
        'createSupervisor() requires an LLM provider. ' +
          'Pass `llmProvider` in AgentRuntimeConfig.'
      );
    }
    return new SupervisorAgent(config, this.config.llmProvider, this);
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
  async spawn(
    agentName: string,
    input: string,
    options: AgentExecutionOptions = {}
  ): Promise<AgentExecutionResult> {
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
  pipeline(pipelineId: string, agentNames: string[]): ReturnType<AgentGraph['compile']> {
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
  static async quick(
    agentClass: new (...args: unknown[]) => unknown,
    input: string,
    config: AgentRuntimeConfig = {},
    options: AgentExecutionOptions = {}
  ): Promise<AgentExecutionResult> {
    const runtime = new AgentRuntime(config);
    runtime.registerAgent(agentClass);

    // Derive agent name from decorator metadata
    const agents = runtime.getAgents();
    if (agents.length === 0) {
      throw new Error(
        'AgentRuntime.quick(): No agent found. Ensure the class is decorated with @Agent().'
      );
    }

    return runtime.execute(agents[0], input, options);
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
