import {
  type AICompletionRequest,
  type AICompletionResponse,
  type AIEmbeddingRequest,
  type AIEmbeddingResponse,
  type AIProvider,
  type AIStreamChunk,
  type AIToolCall,
  type IAIProvider,
} from '../ai-enhanced.types';
import { AIProviderError } from '../errors/provider.error';

export type FakeModelReply =
  | string
  | {
      text?: string;
      toolCalls?: Array<{ name: string; input: Record<string, unknown>; id?: string }>;
      usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
      finishReason?: string;
    }
  | { error: { statusCode?: number; message?: string; retryable?: boolean; code?: string } };

/**
 * Scripted IAIProvider for tests — no network. Each complete/stream consumes the next reply.
 */
export class FakeModel implements IAIProvider {
  readonly name: AIProvider;
  private readonly replies: FakeModelReply[];
  private index = 0;
  readonly calls: AICompletionRequest[] = [];

  constructor(replies: FakeModelReply[] = [], name: AIProvider = 'openai') {
    this.replies = [...replies];
    this.name = name;
  }

  push(...replies: FakeModelReply[]): void {
    this.replies.push(...replies);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    this.calls.push(request);
    const reply = this.nextReply();
    if (typeof reply === 'string') {
      return {
        id: `fake_${this.calls.length}`,
        content: reply,
        role: 'assistant',
        model: request.model || 'fake',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: 'stop',
      };
    }
    if ('error' in reply && reply.error) {
      throw new AIProviderError(reply.error.message || 'Fake model error', {
        statusCode: reply.error.statusCode,
        retryable: reply.error.retryable,
        code: reply.error.code,
      });
    }
    const success = reply as {
      text?: string;
      toolCalls?: Array<{ name: string; input: Record<string, unknown>; id?: string }>;
      usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
      finishReason?: string;
    };
    const toolCalls: AIToolCall[] | undefined = success.toolCalls?.map((tc, i) => ({
      id: tc.id || `call_${i}`,
      type: 'function' as const,
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.input),
      },
    }));
    return {
      id: `fake_${this.calls.length}`,
      content: success.text ?? '',
      role: 'assistant',
      model: request.model || 'fake',
      usage: success.usage ?? { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      toolCalls,
      finishReason: success.finishReason ?? (toolCalls?.length ? 'tool_calls' : 'stop'),
    };
  }

  async *streamComplete(request: AICompletionRequest): AsyncGenerator<AIStreamChunk> {
    const full = await this.complete(request);
    const words = full.content.split(/(\s+)/).filter(Boolean);
    let content = '';
    for (const word of words) {
      content += word;
      yield {
        id: full.id,
        content,
        delta: word,
        done: false,
      };
    }
    yield {
      id: full.id,
      content,
      delta: '',
      done: true,
      usage: full.usage,
    };
  }

  async embed(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
    const inputs = Array.isArray(request.input) ? request.input : [request.input];
    return {
      embeddings: inputs.map(() => [0.1, 0.2, 0.3]),
      model: request.model || 'fake-embed',
      usage: { promptTokens: inputs.length, totalTokens: inputs.length },
    };
  }

  private nextReply(): FakeModelReply {
    if (this.index >= this.replies.length) {
      throw new AIProviderError('FakeModel has no more scripted replies', {
        retryable: false,
        statusCode: 500,
      });
    }
    return this.replies[this.index++];
  }
}
