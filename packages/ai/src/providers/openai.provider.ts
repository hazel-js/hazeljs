import {
  IAIProvider,
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIStreamChunk,
  AIEmbeddingRequest,
  AIEmbeddingResponse,
  AIMessage,
} from '../ai-enhanced.types';
import logger from '@hazeljs/core';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/**
 * OpenAI Provider
 * Production-ready implementation with full OpenAI API support
 */
export class OpenAIProvider implements IAIProvider {
  readonly name: AIProvider = 'openai';
  private client: InstanceType<typeof OpenAI>;
  private defaultModel: string;

  constructor(apiKey?: string, config?: { baseURL?: string; defaultModel?: string }) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
      baseURL: config?.baseURL,
    });
    this.defaultModel = config?.defaultModel || 'gpt-4-turbo-preview';
    logger.info('OpenAI provider initialized');
  }

  /**
   * Generate completion
   */
  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    try {
      logger.debug(`OpenAI completion request for model: ${request.model || this.defaultModel}`);

      const messages = this.transformMessages(request.messages);

      const response = await this.client.chat.completions.create({
        model: request.model || this.defaultModel,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        top_p: request.topP,
        functions: request.functions,
        function_call: request.functionCall,
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('No completion choice returned');
      }

      const result: AICompletionResponse = {
        id: response.id,
        content: choice.message.content || '',
        role: 'assistant',
        model: response.model,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
        functionCall: choice.message.function_call
          ? {
              name: choice.message.function_call.name,
              arguments: choice.message.function_call.arguments,
            }
          : undefined,
        finishReason: choice.finish_reason,
      };

      logger.debug('OpenAI completion successful', {
        tokens: result.usage?.totalTokens,
        finishReason: result.finishReason,
      });

      return result;
    } catch (error) {
      logger.error('OpenAI completion failed:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Generate streaming completion
   */
  async *streamComplete(request: AICompletionRequest): AsyncGenerator<AIStreamChunk> {
    try {
      logger.debug('OpenAI streaming completion started');

      const messages = this.transformMessages(request.messages);

      const stream = await this.client.chat.completions.create({
        model: request.model || this.defaultModel,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        top_p: request.topP,
        stream: true,
      });

      let fullContent = '';
      let chunkId = '';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const content = delta?.content || '';

        if (content) {
          fullContent += content;
          chunkId = chunk.id;

          yield {
            id: chunk.id,
            content: fullContent,
            delta: content,
            done: false,
          };
        }

        // Check if stream is done
        if (chunk.choices[0]?.finish_reason) {
          yield {
            id: chunkId,
            content: fullContent,
            delta: '',
            done: true,
            usage: chunk.usage
              ? {
                  promptTokens: chunk.usage.prompt_tokens,
                  completionTokens: chunk.usage.completion_tokens,
                  totalTokens: chunk.usage.total_tokens,
                }
              : undefined,
          };
        }
      }

      logger.debug('OpenAI streaming completed');
    } catch (error) {
      logger.error('OpenAI streaming failed:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Generate embeddings
   */
  async embed(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
    try {
      logger.debug('OpenAI embedding request');

      const input = Array.isArray(request.input) ? request.input : [request.input];

      const response = await this.client.embeddings.create({
        model: request.model || 'text-embedding-3-small',
        input,
      });

      const result: AIEmbeddingResponse = {
        embeddings: response.data.map((item: { embedding: number[] }) => item.embedding),
        model: response.model,
        usage: {
          promptTokens: response.usage.prompt_tokens,
          totalTokens: response.usage.total_tokens,
        },
      };

      logger.debug('OpenAI embedding successful', {
        count: result.embeddings.length,
        dimensions: result.embeddings[0]?.length,
      });

      return result;
    } catch (error) {
      logger.error('OpenAI embedding failed:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Check if provider is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Make a minimal API call to check availability
      await this.client.models.list();
      return true;
    } catch (error) {
      logger.warn('OpenAI provider not available:', error);
      return false;
    }
  }

  /**
   * Get supported models
   */
  getSupportedModels(): string[] {
    return [
      'gpt-4-turbo-preview',
      'gpt-4-0125-preview',
      'gpt-4-1106-preview',
      'gpt-4',
      'gpt-4-0613',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-0125',
      'gpt-3.5-turbo-1106',
    ];
  }

  /**
   * Get supported embedding models
   */
  getSupportedEmbeddingModels(): string[] {
    return ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'];
  }

  /**
   * Transform messages to OpenAI format
   */
  private transformMessages(messages: AIMessage[]): ChatCompletionMessageParam[] {
    return messages.map((msg): ChatCompletionMessageParam => {
      if (msg.role === 'function') {
        return {
          role: 'function',
          content: msg.content,
          name: msg.name || 'unknown',
        };
      }

      if (msg.role === 'assistant' && msg.functionCall) {
        return {
          role: 'assistant',
          content: msg.content || null,
          function_call: {
            name: msg.functionCall.name,
            arguments: msg.functionCall.arguments,
          },
        };
      }

      if (msg.role === 'system') {
        return {
          role: 'system',
          content: msg.content,
        };
      }

      if (msg.role === 'user') {
        return {
          role: 'user',
          content: msg.content,
        };
      }

      // Default to assistant
      return {
        role: 'assistant',
        content: msg.content,
      };
    });
  }

  /**
   * Handle OpenAI errors
   */
  private handleError(error: unknown): Error {
    if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
      const apiError = error as { status?: number; message?: string };
      const status = apiError.status ?? 'unknown';
      const message = `OpenAI API Error (${status}): ${apiError.message ?? 'Unknown error'}`;
      return new Error(message);
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error('Unknown OpenAI error');
  }
}
