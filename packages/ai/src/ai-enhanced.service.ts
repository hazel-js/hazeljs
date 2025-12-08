import {
  IAIProvider,
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIStreamChunk,
  AIEmbeddingRequest,
  AIEmbeddingResponse,
  AIModelConfig,
} from './ai-enhanced.types';
import { Injectable } from '@hazeljs/core';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { CohereProvider } from './providers/cohere.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { AIContextManager } from './context/context.manager';
import { TokenTracker } from './tracking/token.tracker';
import { CacheService } from '@hazeljs/cache';
import logger from '@hazeljs/core';

/**
 * Enhanced AI Service
 * Production-ready AI service with provider management, caching, and rate limiting
 */
@Injectable()
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

      // Initialize Ollama (always available if Ollama server is running)
      // Ollama doesn't require an API key, just a running server
      const ollamaProvider = new OllamaProvider({
        baseURL: process.env.OLLAMA_BASE_URL,
        defaultModel: process.env.OLLAMA_DEFAULT_MODEL,
      });
      this.providers.set('ollama', ollamaProvider);
      logger.info('Ollama provider registered (will check availability on first use)');

      if (this.providers.size === 0) {
        logger.warn(
          'No AI providers configured. Set API keys in environment variables or start Ollama server.'
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
      throw new Error(`Provider ${provider} is not registered`);
    }
    this.defaultProvider = provider;
    logger.info(`Default provider set to: ${provider}`);
  }

  /**
   * Create a context manager for conversation
   */
  createContext(maxTokens?: number): AIContextManager {
    this.contextManager = new AIContextManager(maxTokens);
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

    // Check cache first
    if (this.cacheService && config?.cacheKey) {
      const cached = await this.cacheService.get<AICompletionResponse>(cacheKey);
      if (cached) {
        logger.debug('Returning cached AI response');
        return cached;
      }
    }

    // Check rate limits
    const estimatedTokens = this.estimateRequestTokens(request);
    const limitCheck = await this.tokenTracker.checkLimits(config?.userId, estimatedTokens);

    if (!limitCheck.allowed) {
      throw new Error(`Rate limit exceeded: ${limitCheck.reason}`);
    }

    // Execute with retry logic
    const response = await this.executeWithRetry(async () => {
      return await provider.complete(request);
    });

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
      throw new Error(`Rate limit exceeded: ${limitCheck.reason}`);
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
      throw new Error(`Provider ${config.provider} not found`);
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
      throw new Error(`Provider ${name} is not registered or available`);
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
    let tokens = 0;

    for (const message of request.messages) {
      // Rough estimate: 1 token ≈ 4 characters
      tokens += Math.ceil(message.content.length / 4);
      tokens += 4; // Message overhead
    }

    // Add estimated completion tokens
    tokens += request.maxTokens || 1000;

    return tokens;
  }

  /**
   * Set retry configuration
   */
  setRetryConfig(attempts: number, delay: number): void {
    this.retryAttempts = attempts;
    this.retryDelay = delay;
    logger.info(`Retry config updated: ${attempts} attempts, ${delay}ms delay`);
  }
}
