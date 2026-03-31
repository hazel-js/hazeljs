import { AIEnhancedService } from '../ai-enhanced.service';
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
    const response = await this.aiService.complete(
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

    return response.content;
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
}
