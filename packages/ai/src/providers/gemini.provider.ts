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
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Google Gemini AI Provider
 *
 * Production-ready implementation using Google Generative AI SDK.
 *
 * Setup:
 * 1. Install the SDK: `npm install @google/generative-ai`
 * 2. Set GEMINI_API_KEY environment variable
 * 3. Use the provider in your application
 *
 * Supported models:
 * - gemini-pro: Text generation
 * - gemini-pro-vision: Multimodal (text + images)
 * - gemini-1.5-pro: Latest model with extended context
 * - text-embedding-004: Text embeddings
 */
export class GeminiProvider implements IAIProvider {
  readonly name: AIProvider = 'gemini';
  private apiKey: string;
  private genAI: GoogleGenerativeAI;
  private endpoint: string;

  constructor(apiKey?: string, endpoint?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    this.endpoint = endpoint || 'https://generativelanguage.googleapis.com/v1';

    if (!this.apiKey) {
      logger.warn('Gemini API key not provided. Set GEMINI_API_KEY environment variable.');
    }

    this.genAI = new GoogleGenerativeAI(this.apiKey);
    logger.info('Gemini provider initialized');
  }

  /**
   * Generate completion
   */
  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const modelName = request.model || 'gemini-pro';
    logger.debug(`Gemini completion request for model: ${modelName}`);

    try {
      const model = this.genAI.getGenerativeModel({ model: modelName });

      // Convert messages to Gemini format
      const prompt = request.messages
        .map((m) => {
          const role = m.role === 'assistant' ? 'model' : m.role;
          return `${role}: ${m.content}`;
        })
        .join('\n\n');

      // Generate content
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      return {
        id: `gemini-${Date.now()}`,
        content: text,
        role: 'assistant',
        model: modelName,
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount || 0,
          completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata?.totalTokenCount || 0,
        },
        finishReason: response.candidates?.[0]?.finishReason || 'STOP',
      };
    } catch (error) {
      logger.error('Gemini completion error:', error);
      throw new Error(
        `Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate streaming completion
   */
  async *streamComplete(request: AICompletionRequest): AsyncGenerator<AIStreamChunk> {
    const modelName = request.model || 'gemini-pro';
    logger.debug('Gemini streaming completion started');

    try {
      const model = this.genAI.getGenerativeModel({ model: modelName });

      // Convert messages to Gemini format
      const prompt = request.messages
        .map((m) => {
          const role = m.role === 'assistant' ? 'model' : m.role;
          return `${role}: ${m.content}`;
        })
        .join('\n\n');

      // Generate streaming content
      const result = await model.generateContentStream(prompt);
      let fullContent = '';
      let chunkCount = 0;

      for await (const chunk of result.stream) {
        const text = chunk.text();
        fullContent += text;
        chunkCount++;

        const isLast = chunk.candidates?.[0]?.finishReason !== undefined;

        yield {
          id: `gemini-stream-${Date.now()}-${chunkCount}`,
          content: fullContent,
          delta: text,
          done: isLast,
          usage:
            isLast && chunk.usageMetadata
              ? {
                  promptTokens: chunk.usageMetadata.promptTokenCount || 0,
                  completionTokens: chunk.usageMetadata.candidatesTokenCount || 0,
                  totalTokens: chunk.usageMetadata.totalTokenCount || 0,
                }
              : undefined,
        };
      }

      logger.debug('Gemini streaming completed');
    } catch (error) {
      logger.error('Gemini streaming error:', error);
      throw new Error(
        `Gemini streaming error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate embeddings
   */
  async embed(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
    const modelName = request.model || 'text-embedding-004';
    logger.debug(`Gemini embedding request for model: ${modelName}`);

    try {
      const model = this.genAI.getGenerativeModel({ model: modelName });
      const inputs = Array.isArray(request.input) ? request.input : [request.input];

      // Generate embeddings for each input
      const embeddings = await Promise.all(
        inputs.map(async (text) => {
          const result = await model.embedContent(text);
          return result.embedding.values;
        })
      );

      // Estimate token usage (Gemini doesn't provide exact counts for embeddings)
      const estimatedTokens = inputs.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);

      return {
        embeddings,
        model: modelName,
        usage: {
          promptTokens: estimatedTokens,
          totalTokens: estimatedTokens,
        },
      };
    } catch (error) {
      logger.error('Gemini embedding error:', error);
      throw new Error(
        `Gemini embedding error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if provider is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      logger.warn('Gemini API key not configured');
      return false;
    }

    try {
      // Test with a minimal request
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
      await model.generateContent('test');
      return true;
    } catch (error) {
      logger.error('Gemini availability check failed:', error);
      return false;
    }
  }

  /**
   * Get supported models
   */
  getSupportedModels(): string[] {
    return [
      'gemini-pro',
      'gemini-pro-vision',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'text-embedding-004',
    ];
  }
}
