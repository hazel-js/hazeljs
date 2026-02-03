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
import { CohereClient } from 'cohere-ai';

/**
 * Cohere AI Provider
 *
 * Production-ready implementation using Cohere AI SDK.
 *
 * Setup:
 * 1. Install the SDK: `npm install cohere-ai`
 * 2. Set COHERE_API_KEY environment variable
 * 3. Use the provider in your application
 *
 * Supported models:
 * - command-r-plus: Most powerful model for complex tasks
 * - command-r: Balanced performance and cost
 * - command: Standard text generation
 * - command-light: Fast, cost-effective model
 * - embed-english-v3.0: English text embeddings
 * - embed-multilingual-v3.0: Multilingual embeddings
 * - rerank-english-v3.0: Document reranking
 */
export class CohereProvider implements IAIProvider {
  readonly name: AIProvider = 'cohere';
  private apiKey: string;
  private cohere: CohereClient;
  private endpoint: string;

  constructor(apiKey?: string, endpoint?: string) {
    this.apiKey = apiKey || process.env.COHERE_API_KEY || '';
    this.endpoint = endpoint || 'https://api.cohere.ai/v1';

    if (!this.apiKey) {
      logger.warn('Cohere API key not provided. Set COHERE_API_KEY environment variable.');
    }

    this.cohere = new CohereClient({ token: this.apiKey });
    logger.info('Cohere provider initialized');
  }

  /**
   * Generate completion
   */
  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const modelName = request.model || 'command';
    logger.debug(`Cohere completion request for model: ${modelName}`);

    try {
      // Convert messages to prompt format
      const prompt = request.messages.map((m) => `${m.role}: ${m.content}`).join('\n\n');

      // Generate completion
      const response = await this.cohere.generate({
        model: modelName,
        prompt,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        p: request.topP,
      });

      return {
        id: response.id || `cohere-${Date.now()}`,
        content: response.generations[0].text,
        role: 'assistant',
        model: modelName,
        usage: {
          promptTokens: response.meta?.billedUnits?.inputTokens || 0,
          completionTokens: response.meta?.billedUnits?.outputTokens || 0,
          totalTokens:
            (response.meta?.billedUnits?.inputTokens || 0) +
            (response.meta?.billedUnits?.outputTokens || 0),
        },
        finishReason: 'COMPLETE',
      };
    } catch (error) {
      logger.error('Cohere completion error:', error);
      throw new Error(
        `Cohere API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate streaming completion
   */
  async *streamComplete(request: AICompletionRequest): AsyncGenerator<AIStreamChunk> {
    const modelName = request.model || 'command';
    logger.debug('Cohere streaming completion started');

    try {
      // Convert messages to prompt format
      const prompt = request.messages.map((m) => `${m.role}: ${m.content}`).join('\n\n');

      // Generate streaming completion
      const stream = await this.cohere.generateStream({
        model: modelName,
        prompt,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        p: request.topP,
      });

      let fullContent = '';
      const streamId = `cohere-stream-${Date.now()}`;

      for await (const chunk of stream) {
        if (chunk.eventType === 'text-generation') {
          const text = chunk.text || '';
          fullContent += text;

          yield {
            id: streamId,
            content: fullContent,
            delta: text,
            done: false,
          };
        } else if (chunk.eventType === 'stream-end') {
          const response = chunk as any;
          yield {
            id: streamId,
            content: fullContent,
            delta: '',
            done: true,
            usage: response.response?.meta?.billedUnits
              ? {
                  promptTokens: response.response.meta.billedUnits.inputTokens || 0,
                  completionTokens: response.response.meta.billedUnits.outputTokens || 0,
                  totalTokens:
                    (response.response.meta.billedUnits.inputTokens || 0) +
                    (response.response.meta.billedUnits.outputTokens || 0),
                }
              : undefined,
          };
        }
      }

      logger.debug('Cohere streaming completed');
    } catch (error) {
      logger.error('Cohere streaming error:', error);
      throw new Error(
        `Cohere streaming error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate embeddings
   */
  async embed(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
    const modelName = request.model || 'embed-english-v3.0';
    logger.debug(`Cohere embedding request for model: ${modelName}`);

    try {
      const inputs = Array.isArray(request.input) ? request.input : [request.input];

      // Generate embeddings
      const response = await this.cohere.embed({
        texts: inputs,
        model: modelName,
        inputType: 'search_document',
      });

      // Estimate token usage (Cohere doesn't provide exact counts for embeddings)
      const estimatedTokens = inputs.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);

      // Handle different response formats
      const embeddings = Array.isArray(response.embeddings)
        ? response.embeddings
        : (response.embeddings as any).float || [];

      return {
        embeddings,
        model: modelName,
        usage: {
          promptTokens: estimatedTokens,
          totalTokens: estimatedTokens,
        },
      };
    } catch (error) {
      logger.error('Cohere embedding error:', error);
      throw new Error(
        `Cohere embedding error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if provider is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      logger.warn('Cohere API key not configured');
      return false;
    }

    try {
      // Test with a minimal request
      await this.cohere.generate({
        model: 'command-light',
        prompt: 'test',
        maxTokens: 10,
      });
      return true;
    } catch (error) {
      logger.error('Cohere availability check failed:', error);
      return false;
    }
  }

  /**
   * Get supported models
   */
  getSupportedModels(): string[] {
    return [
      'command-r-plus',
      'command-r',
      'command',
      'command-light',
      'command-nightly',
      'embed-english-v3.0',
      'embed-multilingual-v3.0',
      'embed-english-light-v3.0',
      'embed-multilingual-light-v3.0',
      'rerank-english-v3.0',
      'rerank-multilingual-v3.0',
    ];
  }

  /**
   * Rerank documents (Cohere-specific feature)
   * Useful for RAG applications to improve retrieval quality
   */
  async rerank(
    query: string,
    documents: string[],
    topN?: number,
    model?: string
  ): Promise<Array<{ index: number; score: number; document: string }>> {
    const modelName = model || 'rerank-english-v3.0';
    logger.debug(`Cohere rerank request for model: ${modelName}`);

    try {
      const response = await this.cohere.rerank({
        query,
        documents,
        topN,
        model: modelName,
      });

      return response.results.map((r: any) => ({
        index: r.index,
        score: r.relevanceScore,
        document: documents[r.index],
      }));
    } catch (error) {
      logger.error('Cohere rerank error:', error);
      throw new Error(
        `Cohere rerank error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
