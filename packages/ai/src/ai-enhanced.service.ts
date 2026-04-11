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
} from './ai-enhanced.types';
import { ChatBuilder } from './chat-builder';
import { Service } from '@hazeljs/core';
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
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const dbg = debug('ai');

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

  constructor(tokenTracker?: TokenTracker, cacheService?: CacheService) {
    this.tokenTracker = tokenTracker || new TokenTracker();
    this.cacheService = cacheService;
    this.initializeProviders();

    // Register this instance globally for easy access by other modules
    // Users can reference this via: (global as typeof globalThis & { __HAZELJS_AI_ENHANCED_SERVICE__: AIEnhancedService }).__HAZELJS_AI_ENHANCED_SERVICE__
    (
      global as typeof globalThis & { __HAZELJS_AI_ENHANCED_SERVICE__: AIEnhancedService }
    ).__HAZELJS_AI_ENHANCED_SERVICE__ = this;
    logger.info('AI Enhanced Service initialized');
  }

  /**
   * Initialize AI providers
   */
  private initializeProviders(): void {
    try {
      // Initialize OpenAI
      if (process.env.OPENAI_API_KEY) {
        this.providers.set('openai', new OpenAIProvider());
        logger.info('OpenAI provider registered');
      }

      // Initialize Anthropic
      if (process.env.ANTHROPIC_API_KEY) {
        this.providers.set('anthropic', new AnthropicProvider());
        logger.info('Anthropic provider registered');
      }

      // Initialize Gemini
      if (process.env.GEMINI_API_KEY) {
        this.providers.set('gemini', new GeminiProvider());
        logger.info('Gemini provider registered');
      }

      // Initialize Cohere
      if (process.env.COHERE_API_KEY) {
        this.providers.set('cohere', new CohereProvider());
        logger.info('Cohere provider registered');
      }

      // Initialize Ollama only when explicitly enabled.
      // This avoids unexpected logs/connections in environments that do not use Ollama.
      const ollamaEnabled =
        process.env.OLLAMA_ENABLED === 'true' || process.env.OLLAMA_ENABLED === '1';
      if (ollamaEnabled) {
        const ollamaProvider = new OllamaProvider({
          baseURL: process.env.OLLAMA_BASE_URL,
          defaultModel: process.env.OLLAMA_DEFAULT_MODEL,
        });
        this.providers.set('ollama', ollamaProvider);
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

  /**
   * Register a custom provider
   */
  registerProvider(provider: IAIProvider): void {
    this.providers.set(provider.name, provider);
    logger.info(`Custom provider registered: ${provider.name}`);
  }

  /**
   * Set default provider
   */
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

  /**
   * Create a context manager for conversation
   */
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

  /**
   * Get current context manager
   */
  getContext(): AIContextManager | undefined {
    return this.contextManager;
  }

  /**
   * Generate completion with retry logic and caching
   */
  async complete(
    request: AICompletionRequest,
    config?: {
      provider?: AIProvider;
      userId?: string;
      cacheKey?: string;
      cacheTTL?: number;
    }
  ): Promise<AICompletionResponse> {
    const provider = this.getProvider(config?.provider);
    const cacheKey = config?.cacheKey || this.generateCacheKey(request);

    dbg(
      'complete start model=%s provider=%s',
      request.model || 'default',
      config?.provider || this.defaultProvider
    );

    // Check cache first
    if (this.cacheService && config?.cacheKey) {
      const cached = await this.cacheService.get<AICompletionResponse>(cacheKey);
      if (cached) {
        logger.debug('Returning cached AI response');
        dbg('complete cache hit key=%s', cacheKey);
        return cached;
      }
    }

    // Check rate limits
    const estimatedTokens = this.estimateRequestTokens(request);
    dbg('complete tokens estimated=%d user=%s', estimatedTokens, config?.userId || 'anonymous');
    const limitCheck = await this.tokenTracker.checkLimits(config?.userId, estimatedTokens);

    if (!limitCheck.allowed) {
      dbg('complete rate limited reason=%s', limitCheck.reason || 'unknown');
      throw new AIError(`Rate limit exceeded: ${limitCheck.reason}`, AIErrorCode.RATE_LIMIT);
    }

    // Execute with retry logic
    const startTime = Date.now();
    const response = await this.executeWithRetry(async () => {
      return await provider.complete(request);
    });
    const duration = Date.now() - startTime;

    dbg('complete success duration=%dms tokens=%d', duration, response.usage?.totalTokens || 0);

    // Track token usage
    if (response.usage) {
      this.tokenTracker.track(
        {
          userId: config?.userId,
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens,
          timestamp: Date.now(),
        },
        request.model
      );
    }

    // Cache response
    if (this.cacheService && config?.cacheKey) {
      await this.cacheService.set(cacheKey, response, config.cacheTTL || 3600);
      dbg('complete cached ttl=%d', config.cacheTTL || 3600);
    }

    return response;
  }

  /**
   * Generate streaming completion
   */
  async *streamComplete(
    request: AICompletionRequest,
    config?: {
      provider?: AIProvider;
      userId?: string;
    }
  ): AsyncGenerator<AIStreamChunk> {
    const provider = this.getProvider(config?.provider);

    // Check rate limits
    const estimatedTokens = this.estimateRequestTokens(request);
    const limitCheck = await this.tokenTracker.checkLimits(config?.userId, estimatedTokens);

    if (!limitCheck.allowed) {
      throw new AIError(`Rate limit exceeded: ${limitCheck.reason}`, AIErrorCode.RATE_LIMIT);
    }

    try {
      for await (const chunk of provider.streamComplete(request)) {
        yield chunk;

        // Track final usage
        if (chunk.done && chunk.usage) {
          this.tokenTracker.track(
            {
              userId: config?.userId,
              promptTokens: chunk.usage.promptTokens,
              completionTokens: chunk.usage.completionTokens,
              totalTokens: chunk.usage.totalTokens,
              timestamp: Date.now(),
            },
            request.model
          );
        }
      }
    } catch (error) {
      logger.error('Streaming completion failed:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings
   */
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

    // Check cache first
    if (this.cacheService && config?.cacheKey) {
      const cached = await this.cacheService.get<AIEmbeddingResponse>(cacheKey);
      if (cached) {
        logger.debug('Returning cached embeddings');
        return cached;
      }
    }

    // Execute with retry logic
    const response = await this.executeWithRetry(async () => {
      return await provider.embed(request);
    });

    // Track token usage
    if (response.usage) {
      this.tokenTracker.track(
        {
          userId: config?.userId,
          promptTokens: response.usage.promptTokens,
          completionTokens: 0,
          totalTokens: response.usage.totalTokens,
          timestamp: Date.now(),
        },
        request.model
      );
    }

    // Cache response
    if (this.cacheService && config?.cacheKey) {
      await this.cacheService.set(cacheKey, response, config.cacheTTL || 86400); // 24 hours
    }

    return response;
  }

  /**
   * Check if a provider is available
   */
  async isProviderAvailable(provider: AIProvider): Promise<boolean> {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      return false;
    }
    return await providerInstance.isAvailable();
  }

  /**
   * Get list of available providers
   */
  getAvailableProviders(): AIProvider[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get token usage statistics
   */
  getTokenStats(userId?: string, days?: number): unknown {
    if (userId) {
      return this.tokenTracker.getUserStats(userId, days);
    }
    return this.tokenTracker.getGlobalStats(days);
  }

  /**
   * Configure model settings
   */
  configureModel(config: AIModelConfig): void {
    const provider = this.providers.get(config.provider);
    if (!provider) {
      throw new AIError(`Provider "${config.provider}" not found.`, AIErrorCode.PROVIDER_NOT_FOUND);
    }

    // Provider-specific configuration would go here
    logger.info(`Model configured for provider: ${config.provider}`);
  }

  /**
   * Get provider instance
   */
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

  /**
   * Execute function with retry logic
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn(`Attempt ${attempt} failed:`, lastError.message);

        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Generate cache key for completion request
   */
  private generateCacheKey(request: AICompletionRequest): string {
    const key = JSON.stringify({
      messages: request.messages,
      model: request.model,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    });
    return `ai:completion:${this.hashString(key)}`;
  }

  /**
   * Generate cache key for embedding request
   */
  private generateEmbeddingCacheKey(request: AIEmbeddingRequest): string {
    const key = JSON.stringify({
      input: request.input,
      model: request.model,
    });
    return `ai:embedding:${this.hashString(key)}`;
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Estimate tokens for a request (rough estimation)
   */
  private estimateRequestTokens(request: AICompletionRequest): number {
    const text = request.messages.map((m) => m.content).join('\n');
    const tik = this.tryTiktokenCount(text);
    let promptTokens = tik ?? 0;

    if (promptTokens === 0) {
      for (const message of request.messages) {
        promptTokens += Math.ceil(message.content.length / 4);
        promptTokens += 4;
      }
    } else {
      promptTokens += request.messages.length * 4;
    }

    return promptTokens + (request.maxTokens || 1000);
  }

  /** Optional `tiktoken` install yields more accurate counts (cl100k_base). */
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

  /**
   * Generate JSON matching a Zod schema (OpenAI-style JSON schema response format when supported).
   */
  async generateObject<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options?: {
      provider?: AIProvider;
      model?: string;
      temperature?: number;
      maxRetries?: number;
    }
  ): Promise<T> {
    const zodSchema = schema as z.ZodTypeAny;
    // zod-to-json-schema + Zod can trigger TS2589 on some schemas; keep output loosely typed.
    const jsonSchemaRaw = zodToJsonSchema(zodSchema as never, { target: 'openApi3' }) as Record<
      string,
      unknown
    >;
    const schemaWrapper: AIJsonSchema = {
      name: 'structured_response',
      description: 'Structured model output',
      schema: jsonSchemaRaw,
      strict: true,
    };
    let lastErr: Error | undefined;
    const attempts = Math.max(1, options?.maxRetries ?? 2);
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await this.complete(
          {
            messages: [{ role: 'user', content: prompt }],
            model: options?.model,
            temperature: options?.temperature ?? 0.2,
            responseFormat: schemaWrapper,
          },
          { provider: options?.provider }
        );
        const parsed = schema.safeParse(JSON.parse(res.content));
        if (parsed.success) {
          return parsed.data;
        }
        lastErr = new Error(parsed.error.message);
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
      }
    }
    throw AIError.completionFailed(
      `generateObject failed after ${attempts} attempt(s): ${lastErr?.message || 'unknown'}`,
      lastErr
    );
  }

  /**
   * Set retry configuration
   */
  setRetryConfig(attempts: number, delay: number): void {
    this.retryAttempts = attempts;
    this.retryDelay = delay;
    logger.info(`Retry config updated: ${attempts} attempts, ${delay}ms delay`);
  }

  /**
   * Ensure a provider is registered and throw an actionable error if not.
   */
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

  /**
   * List all registered provider names.
   */
  listProviders(): AIProvider[] {
    return [...this.providers.keys()];
  }

  /**
   * Fluent chat builder — the easiest way to call an LLM.
   *
   * @example
   * ```ts
   * const answer = await ai.chat('Summarize this article')
   *   .system('You are a helpful assistant')
   *   .model('gpt-4')
   *   .temperature(0.3)
   *   .text();
   *
   * // Streaming
   * for await (const chunk of ai.chat('Hello').stream()) {
   *   process.stdout.write(chunk.delta);
   * }
   *
   * // JSON parsing
   * const data = await ai.chat('Return a JSON list of colors')
   *   .model('gpt-4')
   *   .json<string[]>();
   * ```
   */
  chat(message: string): ChatBuilder {
    return new ChatBuilder(this, message);
  }
}
