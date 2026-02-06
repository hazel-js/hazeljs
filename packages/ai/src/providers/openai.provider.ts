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

      // Build tools array from functions (modern API)
      const tools = request.functions?.map((fn: { name: string; description?: string; parameters?: Record<string, unknown> }) => ({
        type: 'function' as const,
        function: fn,
      }));

      const response = await this.client.chat.completions.create({
        model: request.model || this.defaultModel,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        top_p: request.topP,
        tools: tools && tools.length > 0 ? tools : undefined,
        tool_choice: request.functionCall === 'auto' ? 'auto' : request.functionCall === 'none' ? 'none' : undefined,
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('No completion choice returned');
      }

      // Extract tool calls from the modern tool_calls response
      // Filter to function-type calls and cast to access .function safely
      const rawToolCalls = choice.message.tool_calls as Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }> | undefined;
      const functionCalls = rawToolCalls?.filter(tc => tc.type === 'function');
      const firstToolCall = functionCalls?.[0];

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
        functionCall: firstToolCall
          ? {
              name: firstToolCall.function.name,
              arguments: firstToolCall.function.arguments,
            }
          : undefined,
        toolCalls: functionCalls?.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
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
      // Map legacy 'function' role to modern 'tool' role
      if (msg.role === 'function' || msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: msg.content,
          tool_call_id: msg.toolCallId || msg.name || 'unknown',
        };
      }

      if (msg.role === 'assistant' && (msg.functionCall || msg.toolCalls)) {
        return {
          role: 'assistant',
          content: msg.content || null,
          tool_calls: msg.toolCalls || (msg.functionCall ? [{
            id: msg.functionCall.name,
            type: 'function' as const,
            function: {
              name: msg.functionCall.name,
              arguments: msg.functionCall.arguments,
            },
          }] : undefined),
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
