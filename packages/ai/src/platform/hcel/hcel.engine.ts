/**
 * HCEL Execution Engine - Core execution logic for composable chains
 */

import { createHash, randomUUID } from 'crypto';
import type {
  HCELChain,
  HCELOperation,
  HCELContext,
  HCELResult,
  HCELEvent,
  HCELOperationResult,
  HCELResultMetadata,
  HCELRetryPolicy,
} from './hcel.types';
import { HCELError, HCELErrorCode } from './hcel.error';
import type { HCELResultCache } from './hcel.cache';
import { getDefaultHCELResultCache } from './hcel.cache';
import { PromptOperation } from './hcel.operations';

function fingerprintOperations(ops: HCELOperation[], input: unknown): string {
  const body = ops.map((op) => JSON.stringify({ type: op.type, config: op.config })).join('\n');
  return createHash('sha256')
    .update(body)
    .update('\n')
    .update(JSON.stringify(input ?? null))
    .digest('hex');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeBackoffDelayMs(policy: HCELRetryPolicy, attemptIndex: number): number {
  const { initialDelay, maxDelay, backoffMultiplier } = policy;
  const base = Math.min(initialDelay * Math.pow(backoffMultiplier, attemptIndex), maxDelay);
  const jitter = base * 0.2 * Math.random();
  return Math.floor(base + jitter);
}

export class HCELEngine {
  private eventListeners: Map<string, ((event: HCELEvent) => void)[]> = new Map();

  constructor(private readonly defaultResultCache?: HCELResultCache) {}

  private resolveCache(chain: HCELChain): HCELResultCache {
    return (
      chain.config.caching?.store ??
      chain.config.resultCache ??
      this.defaultResultCache ??
      getDefaultHCELResultCache()
    );
  }

  async execute<TInput, TOutput>(
    chain: HCELChain<TInput, TOutput>,
    input: TInput,
    context?: HCELContext
  ): Promise<HCELResult<TOutput>> {
    const startTime = Date.now();
    const chainId = chain.id || randomUUID();
    const traceId = context?.traceId || randomUUID();

    const executionContext: HCELContext = {
      sessionId: context?.sessionId,
      userId: context?.userId,
      traceId,
      metadata: context?.metadata || {},
      propagate: () => executionContext,
    };

    const cache = this.resolveCache(chain);
    const persist = chain.config.persistence;

    if (persist?.restoreKey) {
      const raw = await cache.get(`persist:${persist.restoreKey}`);
      if (raw !== undefined && raw !== null) {
        const restored = raw as HCELResult<TOutput>;
        if (typeof restored === 'object' && restored !== null && 'output' in restored) {
          return restored;
        }
        return {
          output: raw as TOutput,
          chainId,
          duration: 0,
          operations: [],
          metadata: { totalTokens: 0, totalCost: 0 },
        };
      }
    }

    if (chain.config.caching?.enabled) {
      const fp = fingerprintOperations(chain.operations, input);
      const hit = await cache.get(`run:${fp}`);
      if (hit !== undefined && hit !== null) {
        return hit as HCELResult<TOutput>;
      }
    }

    this.emitEvent({
      type: 'chain.start',
      chainId,
      timestamp: startTime,
      data: { input, operationCount: chain.operations.length },
    });

    const results: HCELOperationResult[] = [];
    let currentOutput: unknown = input;
    let totalTokens = 0;
    let totalCost = 0;
    const adaptiveChoices: HCELResultMetadata['adaptiveChoices'] = [];

    if (chain.config.adaptive) {
      adaptiveChoices.push({
        operation: 'chain',
        choice: 'sequential',
        reasoning:
          'Adaptive scheduling is reserved; operations always run in declaration order (no reordering).',
      });
    }

    try {
      for (const operation of chain.operations) {
        const operationStart = Date.now();

        if (operation.validate && !operation.validate(currentOutput)) {
          throw HCELError.validationFailed(operation.type, operation.id, chainId);
        }

        this.emitEvent({
          type: 'operation.start',
          chainId,
          operationId: operation.id,
          timestamp: operationStart,
          data: { operationType: operation.type },
        });

        let operationOutput: unknown;
        try {
          operationOutput = await this.runWithRetry(
            chain,
            operation,
            currentOutput,
            executionContext,
            chainId
          );
        } catch (error) {
          const operationDuration = Date.now() - operationStart;
          results.push({
            operationId: operation.id,
            type: operation.type,
            duration: operationDuration,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
          this.emitEvent({
            type: 'operation.error',
            chainId,
            operationId: operation.id,
            timestamp: Date.now(),
            data: { error: error instanceof Error ? error.message : String(error) },
          });
          throw error instanceof HCELError
            ? error
            : HCELError.operationFailed(operation.type, operation.id, chainId, error);
        }

        const operationDuration = Date.now() - operationStart;
        currentOutput = operationOutput;

        results.push({
          operationId: operation.id,
          type: operation.type,
          duration: operationDuration,
          success: true,
          output: operationOutput,
        });

        this.emitEvent({
          type: 'operation.complete',
          chainId,
          operationId: operation.id,
          timestamp: Date.now(),
          data: { duration: operationDuration, success: true },
        });

        if (operationOutput && typeof operationOutput === 'object' && 'usage' in operationOutput) {
          const usage = (
            operationOutput as { usage: { totalTokens?: number; estimatedCost?: number } }
          ).usage;
          if (usage.totalTokens) {
            totalTokens += usage.totalTokens;
          }
          if (usage.estimatedCost) {
            totalCost += usage.estimatedCost;
          }
        }
      }

      const totalDuration = Date.now() - startTime;

      this.emitEvent({
        type: 'chain.complete',
        chainId,
        timestamp: Date.now(),
        data: { duration: totalDuration, success: true },
      });

      const result: HCELResult<TOutput> = {
        output: currentOutput as TOutput,
        chainId,
        duration: totalDuration,
        operations: results,
        metadata: {
          totalTokens,
          totalCost,
          adaptiveChoices,
          adaptiveRequested: Boolean(chain.config.adaptive),
        },
      };

      if (chain.config.caching?.enabled) {
        const fp = fingerprintOperations(chain.operations, input);
        const ttlMs = Math.max(0, (chain.config.caching.ttl ?? 3600) * 1000);
        await cache.set(`run:${fp}`, result, ttlMs);
      }

      if (persist?.enabled && persist.key) {
        const ttlMs = persist.ttlMs ?? 0;
        await cache.set(`persist:${persist.key}`, result, ttlMs);
      }

      return result;
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      this.emitEvent({
        type: 'chain.complete',
        chainId,
        timestamp: Date.now(),
        data: { duration: totalDuration, success: false, error },
      });
      throw error;
    }
  }

  private async runWithRetry(
    chain: HCELChain,
    operation: HCELOperation,
    currentOutput: unknown,
    executionContext: HCELContext,
    chainId: string
  ): Promise<unknown> {
    const policy = chain.config.retryPolicy;
    const retriable = operation.metadata?.retriable === true;

    if (!policy || !retriable) {
      try {
        return await operation.execute(currentOutput, executionContext);
      } catch (error) {
        if (error instanceof HCELError) {
          throw error;
        }
        throw HCELError.operationFailed(operation.type, operation.id, chainId, error);
      }
    }

    const maxAttempts = Math.max(1, policy.maxAttempts);
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await operation.execute(currentOutput, executionContext);
      } catch (error) {
        lastError = error;
        if (attempt >= maxAttempts - 1) {
          break;
        }
        const delay = computeBackoffDelayMs(policy, attempt);
        await sleep(delay);
      }
    }

    throw HCELError.retryExhausted(operation.type, operation.id, chainId, maxAttempts, lastError);
  }

  async *stream<TInput, TOutput>(
    chain: HCELChain<TInput, TOutput>,
    input: TInput,
    context?: HCELContext
  ): AsyncGenerator<TOutput, HCELResult<TOutput>> {
    const chainId = chain.id || randomUUID();
    const ops = chain.operations;
    if (ops.length === 0) {
      throw new HCELError('HCEL stream: no operations', HCELErrorCode.STREAMING_NOT_SUPPORTED, {
        chainId,
      });
    }

    const last = ops[ops.length - 1];
    if (last.type !== 'prompt' || !(last instanceof PromptOperation)) {
      throw HCELError.streamingNotSupported(last.type, chainId);
    }

    const startTime = Date.now();
    const traceId = context?.traceId || randomUUID();
    const executionContext: HCELContext = {
      sessionId: context?.sessionId,
      userId: context?.userId,
      traceId,
      metadata: context?.metadata || {},
      propagate: () => executionContext,
    };

    this.emitEvent({
      type: 'chain.start',
      chainId,
      timestamp: startTime,
      data: { input, operationCount: ops.length, streaming: true },
    });

    let prefixResults: HCELOperationResult[] = [];
    let prefixOutput: unknown = input;

    if (ops.length > 1) {
      const prefixChain: HCELChain<TInput, unknown> = {
        id: `${chainId}-prefix`,
        operations: ops.slice(0, -1),
        config: {
          ...chain.config,
          persistence: undefined,
          caching: undefined,
        },
      };
      const prefixExec = await this.execute(prefixChain, input, context);
      prefixResults = prefixExec.operations;
      prefixOutput = prefixExec.output;
    }

    const prompt = last as PromptOperation;
    const opStart = Date.now();
    let accumulated = '';

    this.emitEvent({
      type: 'operation.start',
      chainId,
      operationId: prompt.id,
      timestamp: opStart,
      data: { operationType: 'prompt', streaming: true },
    });

    try {
      for await (const chunk of prompt.streamChunks(prefixOutput as string, executionContext)) {
        accumulated += chunk;
        yield chunk as TOutput;
      }
    } catch (error) {
      this.emitEvent({
        type: 'operation.error',
        chainId,
        operationId: prompt.id,
        timestamp: Date.now(),
        data: { error: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }

    const opDuration = Date.now() - opStart;
    const lastResult: HCELOperationResult = {
      operationId: prompt.id,
      type: 'prompt',
      duration: opDuration,
      success: true,
      output: accumulated,
    };

    prefixResults.push(lastResult);

    this.emitEvent({
      type: 'operation.complete',
      chainId,
      operationId: prompt.id,
      timestamp: Date.now(),
      data: { duration: opDuration, success: true, streaming: true },
    });

    const totalDuration = Date.now() - startTime;
    this.emitEvent({
      type: 'chain.complete',
      chainId,
      timestamp: Date.now(),
      data: { duration: totalDuration, success: true, streaming: true },
    });

    const adaptiveChoices: HCELResultMetadata['adaptiveChoices'] = [];
    if (chain.config.adaptive) {
      adaptiveChoices.push({
        operation: 'chain',
        choice: 'sequential',
        reasoning:
          'Adaptive scheduling is reserved; stream path runs prefix then token stream for terminal prompt.',
      });
    }

    const result: HCELResult<TOutput> = {
      output: accumulated as TOutput,
      chainId,
      duration: totalDuration,
      operations: prefixResults,
      metadata: {
        adaptiveChoices,
        adaptiveRequested: Boolean(chain.config.adaptive),
      },
    };

    const cache = this.resolveCache(chain);
    if (chain.config.caching?.enabled) {
      const fp = fingerprintOperations(chain.operations, input);
      const ttlMs = Math.max(0, (chain.config.caching.ttl ?? 3600) * 1000);
      await cache.set(`run:${fp}`, result, ttlMs);
    }
    const persist = chain.config.persistence;
    if (persist?.enabled && persist.key) {
      const ttlMs = persist.ttlMs ?? 0;
      await cache.set(`persist:${persist.key}`, result, ttlMs);
    }

    return result;
  }

  addEventListener(eventType: string, listener: (event: HCELEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  removeEventListener(eventType: string, listener: (event: HCELEvent) => void): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emitEvent(event: HCELEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(`Error in event listener for ${event.type}:`, error);
        }
      });
    }
  }
}
