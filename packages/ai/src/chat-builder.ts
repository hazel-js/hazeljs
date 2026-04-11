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

import type { z } from 'zod';
import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIStreamChunk,
  AIMessage,
  AIFunction,
  AIMessageContentPart,
} from './ai-enhanced.types';
import { messageContentToText } from './utils/message-content';

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
  generateObject?<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options?: {
      provider?: AIProvider;
      model?: string;
      temperature?: number;
      maxRetries?: number;
    }
  ): Promise<T>;
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
  private _extraParts: AIMessageContentPart[] = [];
  private _outputSchema?: z.ZodType<unknown>;

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

  /** Append an image URL to the user message (multimodal; OpenAI and others). */
  imageUrl(url: string): this {
    this._extraParts.push({ type: 'image_url', imageUrl: url });
    return this;
  }

  /** Append a base64-encoded image to the user message. */
  imageBase64(base64: string, mimeType = 'image/png'): this {
    this._extraParts.push({ type: 'image_base64', base64, mimeType });
    return this;
  }

  /** Append audio input (provider-dependent; may be text-placeholder for some APIs). */
  audioBase64(base64: string, mimeType = 'audio/wav'): this {
    this._extraParts.push({ type: 'input_audio', base64, mimeType });
    return this;
  }

  /** Structured output validated with Zod (uses JSON schema / json mode under the hood). */
  objectSchema<T>(schema: z.ZodType<T>): this {
    this._outputSchema = schema;
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
    if (this._outputSchema && this.host.generateObject) {
      const prompt = this.buildPromptString();
      const data = await this.host.generateObject(prompt, this._outputSchema, {
        provider: this._provider,
        model: this._model,
        temperature: this._temperature,
      });
      return typeof data === 'string' ? data : JSON.stringify(data);
    }
    const response = await this.send();
    return response.content;
  }

  /** Structured output validated with Zod. */
  async object<T>(schema: z.ZodType<T>): Promise<T> {
    if (this.host.generateObject) {
      const prompt = this.buildPromptString();
      return this.host.generateObject(prompt, schema, {
        provider: this._provider,
        model: this._model,
        temperature: this._temperature,
      });
    }
    const raw = await this.json<unknown>();
    return schema.parse(raw);
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
    const msgs = [...this._messages];
    const lastIdx = msgs.length - 1;
    if (lastIdx >= 0 && msgs[lastIdx].role === 'user' && this._extraParts.length > 0) {
      const last = msgs[lastIdx];
      const base =
        typeof last.content === 'string' ? last.content : messageContentToText(last.content);
      msgs[lastIdx] = {
        ...last,
        content: [{ type: 'text', text: base }, ...this._extraParts],
      };
    }

    return {
      messages: msgs,
      model: this._model,
      temperature: this._temperature,
      maxTokens: this._maxTokens,
      topP: this._topP,
      functions: this._functions,
      functionCall: this._functionCall,
    };
  }

  private buildPromptString(): string {
    return this._messages.map((m) => messageText(m)).join('\n');
  }
}

function messageText(m: AIMessage): string {
  if (typeof m.content === 'string') {
    return `${m.role}: ${m.content}`;
  }
  const t = m.content.map((p) => (p.type === 'text' ? p.text : '[media]')).join(' ');
  return `${m.role}: ${t}`;
}
