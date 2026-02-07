import {
  IAIProvider,
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIStreamChunk,
  AIEmbeddingRequest,
  AIEmbeddingResponse,
} from '../ai-enhanced.types';
import logger from '@hazeljs/core';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Anthropic Claude AI Provider
 *
 * Production-ready implementation using Anthropic SDK.
 *
 * Setup:
 * 1. Install the SDK: `npm install @anthropic-ai/sdk`
 * 2. Set ANTHROPIC_API_KEY environment variable
 * 3. Use the provider in your application
 *
 * Supported models:
 * - claude-3-5-sonnet-20241022: Latest and most intelligent model
 * - claude-3-opus-20240229: Most powerful for complex tasks
 * - claude-3-sonnet-20240229: Balanced performance
 * - claude-3-haiku-20240307: Fast and cost-effective
 *
 * Note: Anthropic does not provide embeddings API. Use OpenAI or Cohere for embeddings.
 */
export class AnthropicProvider implements IAIProvider {
  readonly name: AIProvider = 'anthropic';
  private apiKey: string;
  private anthropic: Anthropic;
  private endpoint: string;

  constructor(apiKey?: string, endpoint?: string) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.endpoint = endpoint || 'https://api.anthropic.com/v1';

    if (!this.apiKey) {
      logger.warn('Anthropic API key not provided. Set ANTHROPIC_API_KEY environment variable.');
    }

    this.anthropic = new Anthropic({ apiKey: this.apiKey });
    logger.info('Anthropic provider initialized');
  }

  /**
   * Generate completion
   */
  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const modelName = request.model || 'claude-3-5-sonnet-20241022';
    logger.debug(`Anthropic completion request for model: ${modelName}`);

    try {
      // Separate system messages from conversation messages
      const systemMessages = request.messages.filter((m) => m.role === 'system');
      const conversationMessages = request.messages.filter((m) => m.role !== 'system');

      const systemPrompt = systemMessages.map((m) => m.content).join('\n\n');

      // Create message request
      const response = await this.anthropic.messages.create({
        model: modelName,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature,
        system: systemPrompt || undefined,
        messages: conversationMessages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });

      // Extract text content
      const textContent = response.content
        .filter((block: { type: string; text?: string }) => block.type === 'text')
        .map((block: { type: string; text?: string }) => block.text || '')
        .join('');

      return {
        id: response.id,
        content: textContent,
        role: 'assistant',
        model: response.model,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        finishReason: response.stop_reason || 'end_turn',
      };
    } catch (error) {
      logger.error('Anthropic completion error:', error);
      throw new Error(
        `Anthropic API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate streaming completion
   */
  async *streamComplete(request: AICompletionRequest): AsyncGenerator<AIStreamChunk> {
    const modelName = request.model || 'claude-3-5-sonnet-20241022';
    logger.debug('Anthropic streaming completion started');

    try {
      // Separate system messages from conversation messages
      const systemMessages = request.messages.filter((m) => m.role === 'system');
      const conversationMessages = request.messages.filter((m) => m.role !== 'system');

      const systemPrompt = systemMessages.map((m) => m.content).join('\n\n');

      // Create streaming request
      const stream = await this.anthropic.messages.stream({
        model: modelName,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature,
        system: systemPrompt || undefined,
        messages: conversationMessages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      });

      let fullContent = '';
      let messageId = '';
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const event of stream) {
        if (event.type === 'message_start') {
          messageId = event.message.id;
          inputTokens = event.message.usage.input_tokens;
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            const text = event.delta.text;
            fullContent += text;

            yield {
              id: messageId || `claude-stream-${Date.now()}`,
              content: fullContent,
              delta: text,
              done: false,
            };
          }
        } else if (event.type === 'message_delta') {
          outputTokens = event.usage.output_tokens;
        } else if (event.type === 'message_stop') {
          yield {
            id: messageId || `claude-stream-${Date.now()}`,
            content: fullContent,
            delta: '',
            done: true,
            usage: {
              promptTokens: inputTokens,
              completionTokens: outputTokens,
              totalTokens: inputTokens + outputTokens,
            },
          };
        }
      }

      logger.debug('Anthropic streaming completed');
    } catch (error) {
      logger.error('Anthropic streaming error:', error);
      throw new Error(
        `Anthropic streaming error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate embeddings
   * Note: Anthropic doesn't provide embeddings API
   */
  async embed(_request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
    throw new Error('Anthropic does not support embeddings. Use OpenAI or Cohere instead.');
  }

  /**
   * Check if provider is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      logger.warn('Anthropic API key not configured');
      return false;
    }

    try {
      // Test with a minimal request using fastest model
      await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch (error) {
      logger.error('Anthropic availability check failed:', error);
      return false;
    }
  }

  /**
   * Get supported models
   */
  getSupportedModels(): string[] {
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-2.1',
      'claude-2.0',
    ];
  }
}
