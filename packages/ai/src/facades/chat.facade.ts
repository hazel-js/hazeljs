import { AIEnhancedService } from '../ai-enhanced.service';
import type { AIStreamChunk, AIMessage } from '../ai-enhanced.types';
import type { HazelAIConfig, ChatOptions } from '../platform/hazel-ai.types';

/**
 * Chat Facade — Provides high-level chat and streaming APIs.
 *
 * This facade wraps the AIEnhancedService to provide a simple
 * chat interface with sensible defaults and automatic provider
 * detection from configuration.
 */
export class ChatFacade {
  constructor(
    private aiService: AIEnhancedService,
    private config: HazelAIConfig
  ) {}

  /**
   * Send a chat message and get a response.
   *
   * @param message The user message
   * @param options Optional configuration overrides
   * @returns The assistant's response
   */
  async chat(message: string, options?: ChatOptions): Promise<string> {
    if (options?.outputSchema) {
      const out = await this.aiService.generateObject(
        [...(options?.systemPrompt ? `${options.systemPrompt}\n\n` : ''), message].join(''),
        options.outputSchema,
        {
          provider: options?.provider || this.config.defaultProvider,
          model: options?.model || this.config.model,
          temperature: options?.temperature ?? this.config.temperature,
        }
      );
      return typeof out === 'string' ? out : JSON.stringify(out);
    }

    const userContent = this.buildUserContent(message, options);

    const response = await this.aiService.complete(
      {
        messages: [
          ...(options?.systemPrompt
            ? [{ role: 'system' as const, content: options.systemPrompt }]
            : []),
          { role: 'user' as const, content: userContent },
        ],
        model: options?.model || this.config.model,
        temperature: options?.temperature ?? this.config.temperature,
        maxTokens: options?.maxTokens ?? this.config.maxTokens,
        responseFormat: options?.responseFormat,
      },
      {
        provider: options?.provider || this.config.defaultProvider,
      }
    );

    return response.content;
  }

  private buildUserContent(message: string, options?: ChatOptions): AIMessage['content'] {
    if (!options?.contentParts?.length) {
      return message;
    }
    const parts: NonNullable<ChatOptions['contentParts']> = [
      { type: 'text', text: message },
      ...options.contentParts,
    ];
    return parts;
  }

  /**
   * Stream a chat response.
   *
   * @param message The user message
   * @param options Optional configuration overrides
   * @returns AsyncGenerator yielding response chunks
   */
  async *stream(message: string, options?: ChatOptions): AsyncGenerator<string> {
    const chunks = this.aiService.streamComplete(
      {
        messages: [
          ...(options?.systemPrompt
            ? [{ role: 'system' as const, content: options.systemPrompt }]
            : []),
          { role: 'user' as const, content: message },
        ],
        model: options?.model || this.config.model,
        temperature: options?.temperature ?? this.config.temperature,
        maxTokens: options?.maxTokens ?? this.config.maxTokens,
        responseFormat: options?.responseFormat,
      },
      {
        provider: options?.provider || this.config.defaultProvider,
      }
    );

    for await (const chunk of chunks) {
      yield chunk.delta;
    }
  }

  /**
   * Like {@link ChatFacade.stream} but yields full {@link AIStreamChunk} objects (delta, usage, done, id).
   */
  async *streamFull(message: string, options?: ChatOptions): AsyncGenerator<AIStreamChunk> {
    const chunks = this.aiService.streamComplete(
      {
        messages: [
          ...(options?.systemPrompt
            ? [{ role: 'system' as const, content: options.systemPrompt }]
            : []),
          { role: 'user' as const, content: message },
        ],
        model: options?.model || this.config.model,
        temperature: options?.temperature ?? this.config.temperature,
        maxTokens: options?.maxTokens ?? this.config.maxTokens,
        responseFormat: options?.responseFormat,
      },
      {
        provider: options?.provider || this.config.defaultProvider,
      }
    );

    for await (const chunk of chunks) {
      yield chunk;
    }
  }
}
