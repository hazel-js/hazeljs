/**
 * ChatBuilder — Fluent API for building AI completion requests
 *
 * @example
 * ```ts
 * const response = await ai.chat('Summarize this text')
 *   .system('You are a helpful assistant')
 *   .model('gpt-4')
 *   .temperature(0.7)
 *   .maxTokens(500)
 *   .send();
 *
 * // Streaming
 * for await (const chunk of ai.chat('Hello').model('gpt-4').stream()) {
 *   process.stdout.write(chunk.delta);
 * }
 * ```
 */

import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIStreamChunk,
  AIMessage,
  AIFunction,
} from './ai-enhanced.types';

/** Minimal interface so ChatBuilder doesn't import the full service class. */
export interface ChatBuilderHost {
  complete(
    request: AICompletionRequest,
    config?: { provider?: AIProvider; userId?: string; cacheKey?: string; cacheTTL?: number }
  ): Promise<AICompletionResponse>;
  streamComplete(
    request: AICompletionRequest,
    config?: { provider?: AIProvider; userId?: string }
  ): AsyncGenerator<AIStreamChunk>;
}

export class ChatBuilder {
  private _messages: AIMessage[] = [];
  private _model?: string;
  private _temperature?: number;
  private _maxTokens?: number;
  private _topP?: number;
  private _provider?: AIProvider;
  private _userId?: string;
  private _cacheKey?: string;
  private _cacheTTL?: number;
  private _functions?: AIFunction[];
  private _functionCall?: 'auto' | 'none' | { name: string };

  constructor(
    private readonly host: ChatBuilderHost,
    userMessage: string
  ) {
    this._messages.push({ role: 'user', content: userMessage });
  }

  /** Prepend a system message. */
  system(content: string): this {
    this._messages.unshift({ role: 'system', content });
    return this;
  }

  /** Append an additional user message. */
  user(content: string): this {
    this._messages.push({ role: 'user', content });
    return this;
  }

  /** Append an assistant message (for few-shot examples). */
  assistant(content: string): this {
    this._messages.push({ role: 'assistant', content });
    return this;
  }

  /** Set the model name (e.g. 'gpt-4', 'claude-3-opus'). */
  model(name: string): this {
    this._model = name;
    return this;
  }

  /** Set sampling temperature (0–1). */
  temperature(value: number): this {
    this._temperature = value;
    return this;
  }

  /** Set maximum tokens for the completion. */
  maxTokens(value: number): this {
    this._maxTokens = value;
    return this;
  }

  /** Set top-p (nucleus sampling). */
  topP(value: number): this {
    this._topP = value;
    return this;
  }

  /** Override the default provider for this request. */
  provider(name: AIProvider): this {
    this._provider = name;
    return this;
  }

  /** Set the user ID for token tracking and rate limiting. */
  userId(id: string): this {
    this._userId = id;
    return this;
  }

  /** Enable response caching with an optional TTL (seconds). */
  cache(key: string, ttl?: number): this {
    this._cacheKey = key;
    this._cacheTTL = ttl;
    return this;
  }

  /** Provide function definitions for function calling. */
  functions(fns: AIFunction[], call?: 'auto' | 'none' | { name: string }): this {
    this._functions = fns;
    this._functionCall = call;
    return this;
  }

  // ── Terminal operations ──────────────────────────────────────────────────

  /** Send the request and return the full response. */
  async send(): Promise<AICompletionResponse> {
    return this.host.complete(this.buildRequest(), {
      provider: this._provider,
      userId: this._userId,
      cacheKey: this._cacheKey,
      cacheTTL: this._cacheTTL,
    });
  }

  /** Send the request and return only the text content. */
  async text(): Promise<string> {
    const response = await this.send();
    return response.content;
  }

  /** Send the request and parse the response as JSON. */
  async json<T = unknown>(): Promise<T> {
    const content = await this.text();
    // Strip markdown code fences if present
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    return JSON.parse(cleaned) as T;
  }

  /** Stream the response, yielding chunks as they arrive. */
  async *stream(): AsyncGenerator<AIStreamChunk> {
    yield* this.host.streamComplete(this.buildRequest(), {
      provider: this._provider,
      userId: this._userId,
    });
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private buildRequest(): AICompletionRequest {
    return {
      messages: this._messages,
      model: this._model,
      temperature: this._temperature,
      maxTokens: this._maxTokens,
      topP: this._topP,
      functions: this._functions,
      functionCall: this._functionCall,
    };
  }
}
