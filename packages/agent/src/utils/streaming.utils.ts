/**
 * Streaming Utilities for Agent Runtime
 * Helper functions for working with agent streaming
 */

import { AgentStreamChunk } from '../types/agent.types';
import { StreamingProgress } from '../types/streaming.types';

/**
 * Collect all tokens from a stream into a single string
 */
export async function collectTokens(stream: AsyncIterable<AgentStreamChunk>): Promise<string> {
  let result = '';

  for await (const chunk of stream) {
    if (chunk.type === 'token') {
      result += chunk.content;
    }
  }

  return result;
}

/**
 * Buffer tokens and yield them in batches for reduced network overhead
 */
export async function* bufferTokens(
  stream: AsyncIterable<AgentStreamChunk>,
  bufferSize: number = 5
): AsyncGenerator<AgentStreamChunk> {
  let tokenBuffer: string[] = [];

  for await (const chunk of stream) {
    if (chunk.type === 'token') {
      tokenBuffer.push(chunk.content);

      if (tokenBuffer.length >= bufferSize) {
        yield {
          type: 'token',
          content: tokenBuffer.join(''),
        };
        tokenBuffer = [];
      }
    } else {
      // Flush any buffered tokens first
      if (tokenBuffer.length > 0) {
        yield {
          type: 'token',
          content: tokenBuffer.join(''),
        };
        tokenBuffer = [];
      }

      yield chunk;
    }
  }

  // Flush remaining tokens
  if (tokenBuffer.length > 0) {
    yield {
      type: 'token',
      content: tokenBuffer.join(''),
    };
  }
}

/**
 * Filter stream to only include specific chunk types
 */
export async function* filterChunks(
  stream: AsyncIterable<AgentStreamChunk>,
  types: AgentStreamChunk['type'][]
): AsyncGenerator<AgentStreamChunk> {
  for await (const chunk of stream) {
    if (types.includes(chunk.type)) {
      yield chunk;
    }
  }
}

/**
 * Transform stream chunks with a custom function
 */
export async function* transformStream<T>(
  stream: AsyncIterable<AgentStreamChunk>,
  transform: (chunk: AgentStreamChunk) => T | null
): AsyncGenerator<T> {
  for await (const chunk of stream) {
    const transformed = transform(chunk);
    if (transformed !== null) {
      yield transformed;
    }
  }
}

/**
 * Create a progress tracker for streaming execution
 */
export class StreamingProgressTracker {
  private startTime: number;
  private stepCount = 0;
  private tokenCount = 0;
  private toolCallCount = 0;
  private maxSteps: number;

  constructor(maxSteps: number = 10) {
    this.startTime = Date.now();
    this.maxSteps = maxSteps;
  }

  update(chunk: AgentStreamChunk): void {
    switch (chunk.type) {
      case 'step':
        this.stepCount++;
        if (chunk.step.action?.toolName) {
          this.toolCallCount++;
        }
        break;
      case 'token':
        this.tokenCount++;
        break;
    }
  }

  getProgress(): StreamingProgress {
    const elapsed = Date.now() - this.startTime;
    const progress = this.stepCount / this.maxSteps;
    const estimatedTotal = progress > 0 ? elapsed / progress : undefined;
    const estimatedRemaining = estimatedTotal ? estimatedTotal - elapsed : undefined;

    return {
      currentStep: this.stepCount,
      maxSteps: this.maxSteps,
      elapsedTime: elapsed,
      estimatedTimeRemaining: estimatedRemaining,
      tokensGenerated: this.tokenCount,
      toolsCalled: this.toolCallCount,
    };
  }

  reset(): void {
    this.startTime = Date.now();
    this.stepCount = 0;
    this.tokenCount = 0;
    this.toolCallCount = 0;
  }
}

/**
 * Create a streaming event emitter for easier event handling
 */
export class StreamingEventEmitter {
  private handlers: Map<AgentStreamChunk['type'], Array<(chunk: AgentStreamChunk) => void>> =
    new Map();

  on(type: AgentStreamChunk['type'], handler: (chunk: AgentStreamChunk) => void): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  async process(stream: AsyncIterable<AgentStreamChunk>): Promise<void> {
    for await (const chunk of stream) {
      const handlers = this.handlers.get(chunk.type);
      if (handlers) {
        for (const handler of handlers) {
          await handler(chunk);
        }
      }
    }
  }
}

/**
 * Format streaming output for console display
 */
export class ConsoleStreamFormatter {
  private currentLine = '';
  private stepCount = 0;

  format(chunk: AgentStreamChunk): string | null {
    switch (chunk.type) {
      case 'step':
        this.stepCount++;
        return `\n[Step ${this.stepCount}] ${chunk.step.state}`;

      case 'token':
        this.currentLine += chunk.content;
        return chunk.content;

      case 'done':
        return `\n\n✅ Complete (${chunk.result.duration}ms)`;

      default:
        return null;
    }
  }

  reset(): void {
    this.currentLine = '';
    this.stepCount = 0;
  }
}
