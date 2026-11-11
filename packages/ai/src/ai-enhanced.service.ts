import {
  IAIProvider,
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIStreamChunk,
  AIEmbeddingRequest,
  AIEmbeddingResponse,
  AIModelConfig,
  AIJsonSchema,
  AIMessage,
  AIToolCall,
} from './ai-enhanced.types';
import { ChatBuilder } from './chat-builder';
import { Container, Service } from '@hazeljs/core';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { CohereProvider } from './providers/cohere.provider';
import { OllamaProvider } from './providers/ollama.provider';
import {
  AIContextManager,
  type AIContextManagerOptions,
  type ContextTrimStrategy,
} from './context/context.manager';
import { TokenTracker } from './tracking/token.tracker';
import { CacheService } from '@hazeljs/cache';
import logger from '@hazeljs/core';
import { debug } from './utils/debug';
import { AIError, AIErrorCode } from './errors/ai.error';
import { AIProviderError } from './errors/provider.error';
import { z } from 'zod';
import { messageContentToText } from './utils/message-content';
import type { AIMetrics } from './platform/hazel-ai.types';
import { AITaskConfig, AITaskResult } from './ai.types';
import { AITaskExecutor } from './ai-task.executor';
import {
  getAIModuleOptions,
  hasNamedModels,
  listModelNames,
  resolveNamedModel,
  validateNamedModels,
} from './models/module-options';
import type {
  AICallBudget,
  AIModelPricing,
  AIUsageListener,
  ResolvedNamedModel,
} from './models/model-registry.types';
import { estimateCost, executeWithCallPolicy, isOutputInvalidError } from './policy/call-policy';
import { AgentToolRegistry } from './tools/tool-registry';
import type { AgentToolCaller, AgentToolContext } from './tools/agent-tool.decorator';
import type { ApprovalPort } from './approval/approval-port';
import {
  InMemoryCallCheckpointStore,
  type CallCheckpoint,
  type CallCheckpointStore,
  type CheckpointCallConfig,
} from './approval/call-checkpoint-store';
import {
  injectAssembledContext,
  lastUserQuery,
  type CallContextMeta,
  type CallContextRequest,
  type ContextAssemblerPort,
} from './context/context-port';
import { randomUUID } from 'crypto';

const dbg = debug('ai');

export interface AIEnhancedServiceHooks {
  onCompletion?: (evt: {
    provider: import('./ai-enhanced.types').AIProvider;
    model?: string;
    latencyMs: number;
    usage?: import('./ai-enhanced.types').AICompletionResponse['usage'];
    error: boolean;
  }) => void;
}

export interface CompleteCallConfig {
  provider?: AIProvider;
  /** Named model from AIModule.register({ models }) */
  modelName?: string;
  userId?: string;
  cacheKey?: string;
  cacheTTL?: number;
  label?: string;
  timeoutMs?: number;
  fallback?: string[] | false;
  fallbackIf?: (error: unknown) => boolean;
  abortSignal?: AbortSignal;
  budget?: AICallBudget;
  tools?: string[];
  approve?: string[];
  maxSteps?: number;
  caller?: AgentToolCaller;
  onUsage?: AIUsageListener;
  /** Progress reporter used during streamed tool loops. */
  onToolProgress?: AgentToolContext['reportProgress'];
  /** Duck-typed ContextService; falls back to AIModule.register({ contextService }). */
  context?: ContextAssemblerPort;
  /** When set (with a context port), assemble CAG/RAG/KAG/Memory into the prompt. */
  contextRequest?: CallContextRequest;
  /** Token from a prior Gatekeeper / approval resolve, used on resume. */
  approvalToken?: string;
  /** Resume a suspended tool-loop checkpoint. */
  checkpointId?: string;
}

export interface GenerateObjectResult<T> {
  object: T;
  usage?: AICompletionResponse['usage'];
  model: string;
  finishReason?: string;
  cost?: number;
}

/**
 * Enhanced AI Service
 * Production-ready AI service with provider management, caching, and rate limiting
 */
@Service()
export class AIEnhancedService {
  private providers: Map<AIProvider, IAIProvider> = new Map();
  private defaultProvider: AIProvider = 'openai';
  private contextManager?: AIContextManager;
  private tokenTracker: TokenTracker;
  private cacheService?: CacheService;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000;
  private readonly hooks?: AIEnhancedServiceHooks;
  private requestSuccessCount = 0;
  private requestErrorCount = 0;
  private readonly taskExecutor = new AITaskExecutor();
  private readonly toolRegistry = new AgentToolRegistry();
  private approvalPort?: ApprovalPort;
  private checkpointStore: CallCheckpointStore = new InMemoryCallCheckpointStore();

  constructor(
    tokenTracker?: TokenTracker,
    cacheService?: CacheService,
    hooks?: AIEnhancedServiceHooks
  ) {
    this.tokenTracker = tokenTracker || new TokenTracker();
    this.cacheService = cacheService;
    this.hooks = hooks;
    this.initializeProviders();

    // Register in the DI container so AgentModule / self-healing can resolve without a process global.
    try {
      Container.getInstance().register(AIEnhancedService, this);
    } catch {
      /* ignore duplicate registration in tests */
    }

    const opts = getAIModuleOptions();
    if (opts.defaultProvider) {
      this.defaultProvider = opts.defaultProvider;
    }
    if (opts.defaults?.retry?.attempts) {
      this.retryAttempts = opts.defaults.retry.attempts;
    }
    if (opts.defaults?.retry?.backoff?.delayMs) {
      this.retryDelay = opts.defaults.retry.backoff.delayMs;
    }
    if (opts.models) {
      validateNamedModels(opts.models);
    }

    logger.info('AI Enhanced Service initialized');
  }

  private initializeProviders(): void {
    try {
      if (process.env.OPENAI_API_KEY) {
        this.providers.set('openai', new OpenAIProvider());
        logger.info('OpenAI provider registered');
      }
      if (process.env.ANTHROPIC_API_KEY) {
        this.providers.set('anthropic', new AnthropicProvider());
        logger.info('Anthropic provider registered');
      }
      if (process.env.GEMINI_API_KEY) {
        this.providers.set('gemini', new GeminiProvider());
        logger.info('Gemini provider registered');
      }
      if (process.env.COHERE_API_KEY) {
        this.providers.set('cohere', new CohereProvider());
        logger.info('Cohere provider registered');
      }
      const ollamaEnabled =
        process.env.OLLAMA_ENABLED === 'true' || process.env.OLLAMA_ENABLED === '1';
      if (ollamaEnabled) {
        this.providers.set(
          'ollama',
          new OllamaProvider({
            baseURL: process.env.OLLAMA_BASE_URL,
            defaultModel: process.env.OLLAMA_DEFAULT_MODEL,
          })
        );
        logger.info('Ollama provider registered (enabled via OLLAMA_ENABLED)');
      }
      if (this.providers.size === 0) {
        logger.warn(
          'No AI providers configured. Set API keys or enable Ollama with OLLAMA_ENABLED=true.'
        );
      }
    } catch (error) {
      logger.error('Error initializing AI providers:', error);
    }
  }

  registerProvider(provider: IAIProvider): void {
    this.providers.set(provider.name, provider);
    logger.info(`Custom provider registered: ${provider.name}`);
  }

  registerTools(instance: object): void {
    this.toolRegistry.registerTools(instance);
  }

  setApprovalPort(port: ApprovalPort | undefined): void {
    this.approvalPort = port;
  }

  setCheckpointStore(store: CallCheckpointStore): void {
    this.checkpointStore = store;
  }

  /**
   * Resume a tool loop after durable HITL approval (finishReason `approval-required`).
   */
  async resumeAfterApproval(opts: {
    checkpointId: string;
    approvalToken?: string;
    approvalId?: string;
  }): Promise<AICompletionResponse> {
    const checkpoint = await this.checkpointStore.get(opts.checkpointId);
    if (!checkpoint) {
      throw AIError.invalidRequest(`Unknown checkpoint: ${opts.checkpointId}`);
    }
    if (opts.approvalId && opts.approvalId !== checkpoint.approvalId) {
      throw AIError.invalidRequest(
        `approvalId mismatch: expected ${checkpoint.approvalId}, got ${opts.approvalId}`
      );
    }

    const config: CompleteCallConfig = {
      ...checkpoint.config,
      tools: checkpoint.config.tools,
      approve: checkpoint.config.approve,
      maxSteps: checkpoint.config.maxSteps,
      caller: checkpoint.config.caller as AgentToolCaller | undefined,
      approvalToken: opts.approvalToken,
      checkpointId: checkpoint.id,
    };

    const messages = [...checkpoint.messages];
    const toolResult = await this.invokeRegisteredTool(
      checkpoint.pendingToolCall,
      config,
      messages,
      { pendingInput: checkpoint.pendingInput, skipPending: false }
    );

    if (toolResult.kind === 'pending') {
      // Still waiting — refresh checkpoint and return suspended again.
      const nextId = randomUUID();
      const next: CallCheckpoint = {
        ...checkpoint,
        id: nextId,
        createdAt: Date.now(),
        approvalId: toolResult.approvalId,
      };
      await this.checkpointStore.save(next);
      await this.checkpointStore.delete(checkpoint.id);
      return {
        id: `suspended_${nextId}`,
        content: '',
        role: 'assistant',
        model: checkpoint.resolved.modelId,
        usage: { ...checkpoint.running },
        finishReason: 'approval-required',
        approvalId: toolResult.approvalId,
        checkpointId: nextId,
        toolCalls: [checkpoint.pendingToolCall],
      };
    }

    messages.push({
      role: 'tool',
      content: toolResult.text,
      toolCallId: checkpoint.pendingToolCall.id,
      name: checkpoint.pendingToolCall.function.name,
    });

    await this.checkpointStore.delete(checkpoint.id);

    return this.continueToolLoop(
      {
        messages,
        model: checkpoint.request.model,
        temperature: checkpoint.request.temperature,
        maxTokens: checkpoint.request.maxTokens,
        topP: checkpoint.request.topP,
        responseFormat: checkpoint.request.responseFormat,
      },
      config,
      checkpoint.resolved,
      {
        running: { ...checkpoint.running },
        runningCost: checkpoint.runningCost,
        committedTools: true,
      }
    );
  }

  setDefaultProvider(provider: AIProvider): void {
    if (!this.providers.has(provider)) {
      throw new AIError(
        `Provider "${provider}" is not registered.`,
        AIErrorCode.PROVIDER_NOT_FOUND
      );
    }
    this.defaultProvider = provider;
    logger.info(`Default provider set to: ${provider}`);
  }

  createContext(
    maxTokens?: number,
    trimStrategy?: ContextTrimStrategy,
    options?: Pick<AIContextManagerOptions, 'summarizeDropped'>
  ): AIContextManager {
    this.contextManager = new AIContextManager(maxTokens, {
      trimStrategy,
      summarizeDropped: options?.summarizeDropped,
    });
    return this.contextManager;
  }

  getContext(): AIContextManager | undefined {
    return this.contextManager;
  }

  /**
   * Generate completion with named models, policy, optional tool loop, cache, and budgets.
   */
  async complete(
    request: AICompletionRequest,
    config?: CompleteCallConfig
  ): Promise<AICompletionResponse> {
    const prepared = await this.prepareRequestWithContext(request, config);
    const resolved = this.resolveCallTarget(prepared.request.model, config);
    const cacheKey = config?.cacheKey || this.generateCacheKey(prepared.request);

    dbg(
      'complete start model=%s provider=%s name=%s',
      resolved.modelId,
      resolved.provider,
      resolved.name ?? '(ad-hoc)'
    );

    if (this.cacheService && config?.cacheKey) {
      const cached = await this.cacheService.get<AICompletionResponse>(cacheKey);
      if (cached) {
        logger.debug('Returning cached AI response');
        return prepared.contextMeta ? { ...cached, contextMeta: prepared.contextMeta } : cached;
      }
    }

    const estimatedTokens = this.estimateRequestTokens(prepared.request);
    const limitCheck = await this.tokenTracker.checkLimits(config?.userId, estimatedTokens);
    if (!limitCheck.allowed) {
      throw new AIError(`Rate limit exceeded: ${limitCheck.reason}`, AIErrorCode.RATE_LIMIT);
    }

    const startTime = Date.now();
    let response: AICompletionResponse;
    try {
      if (config?.tools?.length) {
        response = await this.runToolLoop(prepared.request, config, resolved);
      } else {
        response = await this.runSingleCompletion(prepared.request, config, resolved, {
          step: 0,
          running: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          runningCost: 0,
        });
      }
    } catch (e) {
      this.requestErrorCount++;
      this.hooks?.onCompletion?.({
        provider: resolved.provider,
        model: resolved.modelId,
        latencyMs: Date.now() - startTime,
        error: true,
      });
      throw e;
    }

    const duration = Date.now() - startTime;
    this.requestSuccessCount++;

    if (response.usage) {
      this.tokenTracker.track(
        {
          userId: config?.userId,
          provider: resolved.provider,
          model: response.model,
          latencyMs: duration,
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens,
          timestamp: Date.now(),
        },
        request.model
      );
    }

    this.hooks?.onCompletion?.({
      provider: resolved.provider,
      model: response.model,
      latencyMs: duration,
      usage: response.usage,
      error: false,
    });

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { trace } = require('@opentelemetry/api') as {
        trace: {
          getActiveSpan: () =>
            { setAttribute: (k: string, v: string | number) => void } | undefined;
        };
      };
      const span = trace.getActiveSpan();
      if (span && response.usage) {
        span.setAttribute('llm.provider', resolved.provider);
        span.setAttribute('llm.usage.total_tokens', response.usage.totalTokens);
      }
    } catch {
      /* optional peer */
    }

    if (this.cacheService && config?.cacheKey) {
      await this.cacheService.set(cacheKey, response, config.cacheTTL || 3600);
    }

    if (prepared.contextMeta) {
      return { ...response, contextMeta: prepared.contextMeta };
    }
    return response;
  }

  async *streamComplete(
    request: AICompletionRequest,
    config?: CompleteCallConfig
  ): AsyncGenerator<AIStreamChunk> {
    const prepared = await this.prepareRequestWithContext(request, config);
    const resolved = this.resolveCallTarget(prepared.request.model, config);
    const estimatedTokens = this.estimateRequestTokens(prepared.request);
    const limitCheck = await this.tokenTracker.checkLimits(config?.userId, estimatedTokens);
    if (!limitCheck.allowed) {
      throw new AIError(`Rate limit exceeded: ${limitCheck.reason}`, AIErrorCode.RATE_LIMIT);
    }

    const provider = this.getProvider(resolved.provider);
    const req: AICompletionRequest = {
      ...prepared.request,
      model: resolved.modelId,
      stream: true,
    };
    let committed = false;

    try {
      const stream = provider.streamComplete(req);
      for await (const chunk of stream) {
        if (config?.abortSignal?.aborted) {
          throw AIError.aborted(config.abortSignal.reason);
        }
        if (chunk.delta || chunk.content) {
          committed = true;
        }
        yield chunk;
        if (chunk.done && chunk.usage) {
          this.tokenTracker.track(
            {
              userId: config?.userId,
              provider: provider.name,
              model: request.model,
              promptTokens: chunk.usage.promptTokens,
              completionTokens: chunk.usage.completionTokens,
              totalTokens: chunk.usage.totalTokens,
              timestamp: Date.now(),
            },
            request.model
          );
          this.requestSuccessCount++;
          this.emitUsage(config, resolved, {
            step: 0,
            attempt: 1,
            fallback: false,
            stream: true,
            usage: chunk.usage,
            durationMs: 0,
            finishReason: 'stop',
          });
        }
      }
    } catch (error) {
      if (committed) {
        throw error;
      }
      throw AIProviderError.fromUnknown(error);
    }
  }

  async embed(
    request: AIEmbeddingRequest,
    config?: {
      provider?: AIProvider;
      userId?: string;
      cacheKey?: string;
      cacheTTL?: number;
    }
  ): Promise<AIEmbeddingResponse> {
    const provider = this.getProvider(config?.provider);
    const cacheKey = config?.cacheKey || this.generateEmbeddingCacheKey(request);

    if (this.cacheService && config?.cacheKey) {
      const cached = await this.cacheService.get<AIEmbeddingResponse>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const response = await executeWithCallPolicy(
      provider.name,
      async () => {
        try {
          return await provider.embed(request);
        } catch (e) {
          throw AIProviderError.fromUnknown(e);
        }
      },
      {
        timeoutMs: getAIModuleOptions().defaults?.timeoutMs,
        retry: {
          attempts: this.retryAttempts,
          backoff: { delayMs: this.retryDelay },
        },
      }
    );

    if (response.usage) {
      this.tokenTracker.track(
        {
          userId: config?.userId,
          provider: provider.name,
          model: request.model,
          promptTokens: response.usage.promptTokens,
          completionTokens: 0,
          totalTokens: response.usage.totalTokens,
          timestamp: Date.now(),
        },
        request.model
      );
    }

    if (this.cacheService && config?.cacheKey) {
      await this.cacheService.set(cacheKey, response, config.cacheTTL || 86400);
    }

    return response;
  }

  async isProviderAvailable(provider: AIProvider): Promise<boolean> {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) return false;
    return providerInstance.isAvailable();
  }

  getAvailableProviders(): AIProvider[] {
    return Array.from(this.providers.keys());
  }

  getAIMetrics(): AIMetrics {
    const snap = this.tokenTracker.getSnapshotForMetrics();
    const totalReq = this.requestSuccessCount + this.requestErrorCount;
    const errorRate = totalReq > 0 ? this.requestErrorCount / totalReq : 0;
    const avgLatency = snap.latencySamples > 0 ? snap.totalLatencyMs / snap.latencySamples : 0;
    const byProvider: AIMetrics['byProvider'] = {};
    for (const [name, v] of Object.entries(snap.byProvider)) {
      byProvider[name] = {
        requests: v.requests,
        tokens: v.tokens,
        averageLatencyMs: v.averageLatencyMs,
      };
    }
    return {
      totalRequests: snap.requestCount,
      totalTokens: snap.totalTokens,
      averageLatencyMs: Number.isFinite(avgLatency) ? avgLatency : 0,
      errorRate,
      costEstimate: snap.totalCost,
      byProvider,
    };
  }

  getTokenStats(userId?: string, days?: number): unknown {
    if (userId) {
      return this.tokenTracker.getUserStats(userId, days);
    }
    return this.tokenTracker.getGlobalStats(days);
  }

  configureModel(config: AIModelConfig): void {
    const provider = this.providers.get(config.provider);
    if (!provider) {
      throw new AIError(`Provider "${config.provider}" not found.`, AIErrorCode.PROVIDER_NOT_FOUND);
    }
    logger.info(`Model configured for provider: ${config.provider}`);
  }

  /**
   * Generate JSON matching a Zod schema. Schema misses are OUTPUT_INVALID (not retried).
   */
  async generateObject<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options?: {
      provider?: AIProvider;
      model?: string;
      modelName?: string;
      temperature?: number;
      instructions?: string;
      schemaName?: string;
      schemaDescription?: string;
      tools?: string[];
      approve?: string[];
      maxSteps?: number;
      caller?: AgentToolCaller;
      budget?: AICallBudget;
      abortSignal?: AbortSignal;
      label?: string;
      onUsage?: AIUsageListener;
      context?: ContextAssemblerPort;
      contextRequest?: CallContextRequest;
    }
  ): Promise<GenerateObjectResult<T>> {
    const zodSchema = schema as z.ZodType;
    const jsonSchemaRaw = z.toJSONSchema(zodSchema, { target: 'openapi-3.0' }) as Record<
      string,
      unknown
    >;
    const schemaWrapper: AIJsonSchema = {
      name: options?.schemaName ?? 'structured_response',
      description: options?.schemaDescription ?? 'Structured model output',
      schema: jsonSchemaRaw,
      strict: true,
    };

    const messages: AIMessage[] = [];
    if (options?.instructions) {
      messages.push({ role: 'system', content: options.instructions });
    }
    messages.push({ role: 'user', content: prompt });

    const res = await this.complete(
      {
        messages,
        model: options?.model,
        temperature: options?.temperature ?? 0.2,
        responseFormat: schemaWrapper,
      },
      {
        provider: options?.provider,
        modelName: options?.modelName,
        tools: options?.tools,
        approve: options?.approve,
        maxSteps: options?.maxSteps,
        caller: options?.caller,
        budget: options?.budget,
        abortSignal: options?.abortSignal,
        label: options?.label,
        onUsage: options?.onUsage,
        context: options?.context,
        contextRequest: options?.contextRequest,
      }
    );

    if (options?.tools?.length && res.finishReason === 'tool-calls') {
      throw AIError.outputInvalid(
        'generateObject ended on tool-calls without a structured object',
        res.content
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(res.content);
    } catch {
      throw AIError.outputInvalid('Model response was not valid JSON', res.content);
    }

    const parsed = schema.safeParse(parsedJson);
    if (!parsed.success) {
      throw AIError.outputInvalid(parsed.error.message, res.content);
    }

    const named = options?.modelName ? resolveNamedModel(options.modelName) : undefined;
    const cost = estimateCost(
      {
        promptTokens: res.usage?.promptTokens ?? 0,
        completionTokens: res.usage?.completionTokens ?? 0,
      },
      named?.pricing
    );

    return {
      object: parsed.data,
      usage: res.usage,
      model: res.model,
      finishReason: res.finishReason,
      cost,
    };
  }

  setRetryConfig(attempts: number, delay: number): void {
    this.retryAttempts = attempts;
    this.retryDelay = delay;
    logger.info(`Retry config updated: ${attempts} attempts, ${delay}ms delay`);
  }

  ensureProvider(name: AIProvider): IAIProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new AIError(
        `AI provider "${name}" is not registered. ` +
          `Available providers: ${[...this.providers.keys()].join(', ') || '(none)'}. ` +
          `Set the appropriate API key environment variable or call registerProvider().`,
        AIErrorCode.PROVIDER_NOT_FOUND
      );
    }
    return provider;
  }

  listProviders(): AIProvider[] {
    return [...this.providers.keys()];
  }

  chat(message: string): ChatBuilder {
    return new ChatBuilder(this, message);
  }

  async executeTask(config: AITaskConfig, input: unknown): Promise<AITaskResult> {
    return this.taskExecutor.executeTask(config, input);
  }

  // ── internals ────────────────────────────────────────────────────────────

  private resolveCallTarget(
    requestModel: string | undefined,
    config?: CompleteCallConfig
  ): {
    name?: string;
    provider: AIProvider;
    modelId: string;
    fallback: string[];
    pricing?: AIModelPricing;
    timeoutMs?: number;
    retry?: ResolvedNamedModel['retry'];
  } {
    const modelName =
      config?.modelName ||
      (requestModel && hasNamedModels() && listModelNames().includes(requestModel)
        ? requestModel
        : undefined);

    if (modelName) {
      const resolved = resolveNamedModel(modelName);
      return {
        name: resolved.name,
        provider: resolved.provider,
        modelId: resolved.modelId,
        fallback: resolved.fallback,
        pricing: resolved.pricing,
        timeoutMs: resolved.timeoutMs,
        retry: resolved.retry,
      };
    }

    return {
      provider: config?.provider || this.defaultProvider,
      modelId: requestModel || 'default',
      fallback: [],
      timeoutMs: getAIModuleOptions().defaults?.timeoutMs,
      retry: getAIModuleOptions().defaults?.retry,
    };
  }

  private getProvider(providerName?: AIProvider): IAIProvider {
    const name = providerName || this.defaultProvider;
    const provider = this.providers.get(name);
    if (!provider) {
      throw new AIError(
        `Provider "${name}" is not registered or available. Available: ${[...this.providers.keys()].join(', ') || '(none)'}.`,
        AIErrorCode.PROVIDER_NOT_FOUND
      );
    }
    return provider;
  }

  private assertBudget(
    running: { promptTokens: number; completionTokens: number; totalTokens: number },
    runningCost: number,
    budget?: AICallBudget
  ): void {
    if (!budget) return;
    if (budget.maxTokens !== undefined && running.totalTokens >= budget.maxTokens) {
      throw AIError.budgetExceeded(running, runningCost, budget);
    }
    if (budget.maxCost !== undefined && runningCost >= budget.maxCost) {
      throw AIError.budgetExceeded(running, runningCost, budget);
    }
  }

  private emitUsage(
    config: CompleteCallConfig | undefined,
    resolved: { name?: string; provider: AIProvider; modelId: string; pricing?: AIModelPricing },
    evt: {
      step: number;
      attempt: number;
      fallback: boolean;
      stream: boolean;
      usage: NonNullable<AICompletionResponse['usage']>;
      durationMs: number;
      finishReason?: string;
    }
  ): void {
    const cost = estimateCost(
      {
        promptTokens: evt.usage.promptTokens,
        completionTokens: evt.usage.completionTokens,
      },
      resolved.pricing
    );
    const payload = {
      label: config?.label,
      model: {
        name: resolved.name,
        provider: resolved.provider,
        modelId: resolved.modelId,
      },
      step: evt.step,
      attempt: evt.attempt,
      fallback: evt.fallback,
      stream: evt.stream,
      usage: {
        promptTokens: evt.usage.promptTokens,
        completionTokens: evt.usage.completionTokens,
        totalTokens: evt.usage.totalTokens,
      },
      cost,
      durationMs: evt.durationMs,
      finishReason: evt.finishReason,
    };
    try {
      getAIModuleOptions().onUsage?.(payload);
    } catch (e) {
      logger.error('onUsage (module) threw:', e);
    }
    try {
      config?.onUsage?.(payload);
    } catch (e) {
      logger.error('onUsage (call) threw:', e);
    }
  }

  private async runSingleCompletion(
    request: AICompletionRequest,
    config: CompleteCallConfig | undefined,
    resolved: {
      name?: string;
      provider: AIProvider;
      modelId: string;
      fallback: string[];
      pricing?: AIModelPricing;
      timeoutMs?: number;
      retry?: ResolvedNamedModel['retry'];
    },
    state: {
      step: number;
      running: { promptTokens: number; completionTokens: number; totalTokens: number };
      runningCost: number;
      committed?: boolean;
    }
  ): Promise<AICompletionResponse> {
    this.assertBudget(
      state.running,
      state.runningCost,
      config?.budget ?? getAIModuleOptions().defaults?.budget
    );

    const fallbackNames =
      config?.fallback === false
        ? []
        : Array.isArray(config?.fallback)
          ? config!.fallback
          : resolved.fallback;

    const timeoutMs = config?.timeoutMs ?? resolved.timeoutMs;
    const retry = resolved.retry ?? {
      attempts: this.retryAttempts,
      backoff: { delayMs: this.retryDelay },
    };

    const runForResolved = async (
      target: typeof resolved,
      isFallback: boolean
    ): Promise<AICompletionResponse> => {
      const provider = this.getProvider(target.provider);
      const req: AICompletionRequest = { ...request, model: target.modelId };
      const started = Date.now();
      return executeWithCallPolicy(
        target.name ?? target.modelId,
        async (ctx) => {
          try {
            const response = await provider.complete(req);
            if (response.usage) {
              state.running.promptTokens += response.usage.promptTokens;
              state.running.completionTokens += response.usage.completionTokens;
              state.running.totalTokens += response.usage.totalTokens;
              const stepCost = estimateCost(
                {
                  promptTokens: response.usage.promptTokens,
                  completionTokens: response.usage.completionTokens,
                },
                target.pricing
              );
              if (stepCost !== undefined) state.runningCost += stepCost;
              this.emitUsage(config, target, {
                step: state.step,
                attempt: ctx.attempt,
                fallback: isFallback,
                stream: false,
                usage: response.usage,
                durationMs: Date.now() - started,
                finishReason: response.finishReason,
              });
            }
            return response;
          } catch (e) {
            if (isOutputInvalidError(e)) throw e;
            throw AIProviderError.fromUnknown(e);
          }
        },
        {
          timeoutMs,
          retry,
          abortSignal: config?.abortSignal,
          committed: state.committed,
          fallbackIf: config?.fallbackIf,
          // primary policy handles fallback via runFallback below; disable nested list here
          fallbackNames: [],
        }
      );
    };

    return executeWithCallPolicy(
      resolved.name ?? resolved.modelId,
      async () => runForResolved(resolved, false),
      {
        timeoutMs,
        retry: { attempts: 1 }, // retries happen inside runForResolved
        abortSignal: config?.abortSignal,
        committed: state.committed,
        fallbackIf: config?.fallbackIf,
        fallbackNames,
      },
      async (fallbackName) => {
        const fb = resolveNamedModel(fallbackName);
        return runForResolved(
          {
            name: fb.name,
            provider: fb.provider,
            modelId: fb.modelId,
            fallback: [],
            pricing: fb.pricing,
            timeoutMs: fb.timeoutMs,
            retry: fb.retry,
          },
          true
        );
      }
    );
  }

  private async runToolLoop(
    request: AICompletionRequest,
    config: CompleteCallConfig,
    resolved: {
      name?: string;
      provider: AIProvider;
      modelId: string;
      fallback: string[];
      pricing?: AIModelPricing;
      timeoutMs?: number;
      retry?: ResolvedNamedModel['retry'];
    }
  ): Promise<AICompletionResponse> {
    return this.continueToolLoop(request, config, resolved, {
      running: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      runningCost: 0,
      committedTools: false,
    });
  }

  private async continueToolLoop(
    request: AICompletionRequest,
    config: CompleteCallConfig,
    resolved: {
      name?: string;
      provider: AIProvider;
      modelId: string;
      fallback: string[];
      pricing?: AIModelPricing;
      timeoutMs?: number;
      retry?: ResolvedNamedModel['retry'];
    },
    state: {
      running: { promptTokens: number; completionTokens: number; totalTokens: number };
      runningCost: number;
      committedTools: boolean;
    }
  ): Promise<AICompletionResponse> {
    const maxSteps = config.maxSteps ?? getAIModuleOptions().defaults?.maxSteps ?? 10;
    const toolNames = config.tools ?? [];
    const functions = this.toolRegistry.toAIFunctions(toolNames);
    const messages: AIMessage[] = [...request.messages];
    const running = state.running;
    const runningCost = state.runningCost;
    let lastResponse: AICompletionResponse | undefined;
    let committedTools = state.committedTools;

    for (let step = 0; step < maxSteps; step++) {
      const stepResponse = await this.runSingleCompletion(
        {
          ...request,
          messages,
          functions,
          functionCall: 'auto',
        },
        config,
        resolved,
        { step, running, runningCost, committed: committedTools }
      );
      lastResponse = stepResponse;

      const toolCalls = stepResponse.toolCalls;
      if (!toolCalls?.length) {
        return {
          ...stepResponse,
          usage: { ...running },
          finishReason: stepResponse.finishReason || 'stop',
        };
      }

      if (step === maxSteps - 1) {
        return {
          ...stepResponse,
          usage: { ...running },
          finishReason: 'tool-calls',
        };
      }

      committedTools = true;
      messages.push({
        role: 'assistant',
        content: stepResponse.content || '',
        toolCalls,
      });

      for (const call of toolCalls) {
        const result = await this.invokeRegisteredTool(call, config, messages);
        if (result.kind === 'pending') {
          const checkpointId = randomUUID();
          const checkpointConfig: CheckpointCallConfig = {
            provider: config.provider,
            modelName: config.modelName,
            userId: config.userId,
            label: config.label,
            tools: config.tools,
            approve: config.approve,
            maxSteps: config.maxSteps,
            budget: config.budget,
            caller: config.caller as Record<string, unknown> | undefined,
          };
          const checkpoint: CallCheckpoint = {
            id: checkpointId,
            createdAt: Date.now(),
            messages,
            request: {
              model: request.model,
              temperature: request.temperature,
              maxTokens: request.maxTokens,
              topP: request.topP,
              responseFormat: request.responseFormat,
            },
            config: checkpointConfig,
            resolved: {
              name: resolved.name,
              provider: resolved.provider,
              modelId: resolved.modelId,
              fallback: resolved.fallback,
              pricing: resolved.pricing,
              timeoutMs: resolved.timeoutMs,
              retry: resolved.retry,
            },
            running: { ...running },
            runningCost,
            pendingToolCall: call,
            pendingInput: result.input,
            approvalId: result.approvalId,
            idempotencyKey: result.idempotencyKey,
          };
          await this.checkpointStore.save(checkpoint);
          return {
            id: `suspended_${checkpointId}`,
            content: '',
            role: 'assistant',
            model: resolved.modelId,
            usage: { ...running },
            finishReason: 'approval-required',
            approvalId: result.approvalId,
            checkpointId,
            toolCalls: [call],
          };
        }
        messages.push({
          role: 'tool',
          content: result.text,
          toolCallId: call.id,
          name: call.function.name,
        });
      }
    }

    return {
      ...(lastResponse as AICompletionResponse),
      usage: { ...running },
      finishReason: 'tool-calls',
    };
  }

  private async invokeRegisteredTool(
    call: AIToolCall,
    config: CompleteCallConfig,
    messages: AIMessage[],
    opts?: { pendingInput?: unknown; skipPending?: boolean }
  ): Promise<
    | { kind: 'ok'; text: string }
    | {
        kind: 'pending';
        approvalId: string;
        input: unknown;
        idempotencyKey: string;
      }
  > {
    const tool = this.toolRegistry.get(call.function.name);
    let input: unknown = opts?.pendingInput;
    if (input === undefined) {
      input = {};
      try {
        input = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        return { kind: 'ok', text: JSON.stringify({ error: 'Invalid tool arguments JSON' }) };
      }
    }

    if (tool.inputSchema && opts?.pendingInput === undefined) {
      const parsed = tool.inputSchema.safeParse(input);
      if (!parsed.success) {
        return { kind: 'ok', text: JSON.stringify({ error: parsed.error.message }) };
      }
      input = parsed.data;
    }

    const idempotencyKey = `${call.id}:${call.function.name}`;
    const approveList = config.approve ?? [];
    if (approveList.includes(call.function.name)) {
      if (!this.approvalPort) {
        return {
          kind: 'ok',
          text: JSON.stringify({
            error: 'Tool requires approval but no ApprovalPort is configured',
          }),
        };
      }
      const decision = await this.approvalPort.approve({
        toolName: call.function.name,
        input,
        idempotencyKey,
        approvalToken: config.approvalToken,
        caller: config.caller,
      });
      if (decision === 'approved') {
        // continue to invoke
      } else if (typeof decision === 'object' && 'pending' in decision) {
        if (opts?.skipPending) {
          return {
            kind: 'ok',
            text: JSON.stringify({
              error: 'Tool still requires approval',
              approvalId: decision.pending.approvalId,
            }),
          };
        }
        return {
          kind: 'pending',
          approvalId: decision.pending.approvalId,
          input,
          idempotencyKey,
        };
      } else {
        const reason =
          typeof decision === 'object' && 'rejected' in decision ? decision.rejected : 'rejected';
        return {
          kind: 'ok',
          text: JSON.stringify({
            rejected: true,
            reason,
          }),
        };
      }
    }

    const ctx: AgentToolContext = {
      name: call.function.name,
      toolCallId: call.id,
      signal: config.abortSignal,
      caller: config.caller,
      idempotencyKey,
      messages,
      reportProgress: async (progress, total, message) => {
        await config.onToolProgress?.(progress, total, message);
      },
    };

    try {
      const output = await tool.invoke(input, ctx);
      return {
        kind: 'ok',
        text: typeof output === 'string' ? output : JSON.stringify(output ?? null),
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { kind: 'ok', text: JSON.stringify({ error: msg }) };
    }
  }

  /**
   * Optionally assemble unified context (CAG/RAG/KAG/Memory) into the prompt.
   * Soft-fails like AgentRuntime: assemble errors leave the original messages.
   */
  private async prepareRequestWithContext(
    request: AICompletionRequest,
    config?: CompleteCallConfig
  ): Promise<{ request: AICompletionRequest; contextMeta?: CallContextMeta }> {
    const contextRequest = config?.contextRequest;
    if (!contextRequest?.tenantId) {
      return { request };
    }

    const port = config?.context ?? getAIModuleOptions().contextService;
    if (!port) {
      return { request };
    }

    const query = contextRequest.query?.trim() || lastUserQuery(request.messages) || '';

    try {
      const assembled = await port.assemble({
        query,
        tenantId: contextRequest.tenantId,
        namespace: contextRequest.namespace,
        agentId: contextRequest.agentId,
        userId: contextRequest.userId ?? config?.userId,
        sessionId: contextRequest.sessionId,
      });
      const contextMeta: CallContextMeta = {
        sourcesUsed: assembled.sourcesUsed,
        tokenEstimate: assembled.tokenEstimate,
        plan: assembled.plan,
      };
      if (!assembled.text?.trim()) {
        return { request, contextMeta };
      }
      return {
        request: {
          ...request,
          messages: injectAssembledContext(request.messages, assembled.text),
        },
        contextMeta,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`Context assemble soft-failed: ${message}`);
      return {
        request,
        contextMeta: { softFailed: true, error: message },
      };
    }
  }

  private generateCacheKey(request: AICompletionRequest): string {
    const key = JSON.stringify({
      messages: request.messages,
      model: request.model,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    });
    return `ai:completion:${this.hashString(key)}`;
  }

  private generateEmbeddingCacheKey(request: AIEmbeddingRequest): string {
    const key = JSON.stringify({
      input: request.input,
      model: request.model,
    });
    return `ai:embedding:${this.hashString(key)}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private estimateRequestTokens(request: AICompletionRequest): number {
    const text = request.messages
      .map((m) => (typeof m.content === 'string' ? m.content : messageContentToText(m.content)))
      .join('\n');
    const tik = this.tryTiktokenCount(text);
    let promptTokens = tik ?? 0;

    if (promptTokens === 0) {
      for (const message of request.messages) {
        const chunk =
          typeof message.content === 'string'
            ? message.content
            : messageContentToText(message.content);
        promptTokens += Math.ceil(chunk.length / 4);
        promptTokens += 4;
      }
    } else {
      promptTokens += request.messages.length * 4;
    }

    return promptTokens + (request.maxTokens || 1000);
  }

  private tryTiktokenCount(text: string): number | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('tiktoken') as {
        get_encoding?: (name: string) => { encode: (s: string) => number[]; free: () => void };
      };
      if (typeof mod.get_encoding !== 'function') {
        return null;
      }
      const enc = mod.get_encoding('cl100k_base');
      try {
        return enc.encode(text).length;
      } finally {
        enc.free();
      }
    } catch {
      return null;
    }
  }
}
