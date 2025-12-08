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

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  temperature?: number;
  num_predict?: number;
  top_p?: number;
  top_k?: number;
  repeat_penalty?: number;
  stop?: string[];
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaEmbeddingResponse {
  embedding: number[];
}

/**
 * Ollama Provider
 * Production-ready implementation for local LLM support via Ollama
 * Supports models like Llama 2, Mistral, CodeLlama, and other open-source models
 */
export class OllamaProvider implements IAIProvider {
  readonly name: AIProvider = 'ollama';
  private baseURL: string;
  private defaultModel: string;

  constructor(config?: { baseURL?: string; defaultModel?: string }) {
    this.baseURL = config?.baseURL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.defaultModel = config?.defaultModel || 'llama2';
    logger.info(`Ollama provider initialized with base URL: ${this.baseURL}`);
  }

  /**
   * Transform messages to Ollama prompt format
   */
  private transformMessages(messages: AIMessage[]): string {
    return messages
      .map((msg) => {
        const role = msg.role === 'assistant' ? 'Assistant' : msg.role === 'system' ? 'System' : 'User';
        return `${role}: ${msg.content}`;
      })
      .join('\n\n');
  }

  /**
   * Generate completion
   */
  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    try {
      const model = request.model || this.defaultModel;
      logger.debug(`Ollama completion request for model: ${model}`);

      const prompt = this.transformMessages(request.messages);

      const ollamaRequest: OllamaGenerateRequest = {
        model,
        prompt,
        stream: false,
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens,
        top_p: request.topP,
      };

      const response = await fetch(`${this.baseURL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ollamaRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as OllamaGenerateResponse;

      return {
        id: `ollama-${Date.now()}`,
        content: data.response,
        role: 'assistant',
        model: data.model,
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
        finishReason: data.done ? 'stop' : 'length',
      };
    } catch (error) {
      logger.error('Ollama completion error:', error);
      throw error;
    }
  }

  /**
   * Generate streaming completion
   */
  async *streamComplete(request: AICompletionRequest): AsyncGenerator<AIStreamChunk> {
    try {
      const model = request.model || this.defaultModel;
      logger.debug(`Ollama streaming completion request for model: ${model}`);

      const prompt = this.transformMessages(request.messages);

      const ollamaRequest: OllamaGenerateRequest = {
        model,
        prompt,
        stream: true,
        temperature: request.temperature ?? 0.7,
        num_predict: request.maxTokens,
        top_p: request.topP,
      };

      const response = await fetch(`${this.baseURL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ollamaRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body available for streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;
      const chunkId = `ollama-${Date.now()}`;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(Boolean);

          for (const line of lines) {
            try {
              const data = JSON.parse(line) as OllamaGenerateResponse;
              if (data.response) {
                fullContent += data.response;
                totalPromptTokens = data.prompt_eval_count || totalPromptTokens;
                totalCompletionTokens = data.eval_count || totalCompletionTokens;

                yield {
                  id: chunkId,
                  content: fullContent,
                  delta: data.response,
                  done: data.done || false,
                  usage: {
                    promptTokens: totalPromptTokens,
                    completionTokens: totalCompletionTokens,
                    totalTokens: totalPromptTokens + totalCompletionTokens,
                  },
                };
              }

              if (data.done) {
                return;
              }
            } catch {
              // Skip invalid JSON lines
              continue;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      logger.error('Ollama streaming error:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings
   */
  async embed(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
    try {
      const model = request.model || this.defaultModel;
      logger.debug(`Ollama embedding request for model: ${model}`);

      const input = Array.isArray(request.input) ? request.input[0] : request.input;

      const response = await fetch(`${this.baseURL}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: input,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as OllamaEmbeddingResponse;

      return {
        embeddings: [data.embedding],
        model,
        usage: {
          promptTokens: 0, // Ollama doesn't provide token usage for embeddings
          totalTokens: 0,
        },
      };
    } catch (error) {
      logger.error('Ollama embedding error:', error);
      throw error;
    }
  }

  /**
   * Check if provider is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get supported models
   * Note: This returns common models, but Ollama supports any model you pull
   */
  getSupportedModels(): string[] {
    return [
      'llama2',
      'llama2:13b',
      'llama2:70b',
      'mistral',
      'mixtral',
      'codellama',
      'neural-chat',
      'starling-lm',
      'phi',
      'orca-mini',
      'vicuna',
      'wizardcoder',
      'wizard-vicuna',
    ];
  }

  /**
   * Get supported embedding models
   */
  getSupportedEmbeddingModels(): string[] {
    return ['llama2', 'mistral', 'nomic-embed-text'];
  }
}

