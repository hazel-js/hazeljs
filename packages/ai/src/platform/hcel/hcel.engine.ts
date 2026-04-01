/**
 * HCEL Execution Engine - Core execution logic for composable chains
 */

import type {
  HCELChain,
  HCELOperation,
  HCELContext,
  HCELResult,
  HCELEvent,
  HCELOperationResult,
  HCELResultMetadata,
} from './hcel.types';
import { randomUUID } from 'crypto';

export class HCELEngine {
  private eventListeners: Map<string, ((event: HCELEvent) => void)[]> = new Map();

  constructor() {}

  async execute<TInput, TOutput>(
    chain: HCELChain<TInput, TOutput>,
    input: TInput,
    context?: HCELContext
  ): Promise<HCELResult<TOutput>> {
    const startTime = Date.now();
    const chainId = chain.id || randomUUID();
    const traceId = context?.traceId || randomUUID();

    // Initialize context
    const executionContext: HCELContext = {
      sessionId: context?.sessionId,
      userId: context?.userId,
      traceId,
      metadata: context?.metadata || {},
      propagate: () => executionContext,
    };

    // Emit chain start event
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

    try {
      // Execute operations sequentially (for now, parallel will be handled by ParallelOperation)
      for (const operation of chain.operations) {
        const operationStart = Date.now();

        // Validate input
        if (operation.validate && !operation.validate(currentOutput)) {
          throw new Error(`Operation ${operation.type} validation failed`);
        }

        // Emit operation start event
        this.emitEvent({
          type: 'operation.start',
          chainId,
          operationId: operation.id,
          timestamp: operationStart,
          data: { operationType: operation.type },
        });

        try {
          // Execute operation
          const operationOutput = await operation.execute(currentOutput, executionContext);
          const operationDuration = Date.now() - operationStart;

          // Update current output for next operation
          currentOutput = operationOutput;

          // Record operation result
          results.push({
            operationId: operation.id,
            type: operation.type,
            duration: operationDuration,
            success: true,
            output: operationOutput,
          });

          // Emit operation complete event
          this.emitEvent({
            type: 'operation.complete',
            chainId,
            operationId: operation.id,
            timestamp: Date.now(),
            data: { duration: operationDuration, success: true },
          });

          // Extract token usage if available
          if (
            operationOutput &&
            typeof operationOutput === 'object' &&
            'usage' in operationOutput
          ) {
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
        } catch (error) {
          const operationDuration = Date.now() - operationStart;

          // Record operation failure
          results.push({
            operationId: operation.id,
            type: operation.type,
            duration: operationDuration,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });

          // Emit operation error event
          this.emitEvent({
            type: 'operation.error',
            chainId,
            operationId: operation.id,
            timestamp: Date.now(),
            data: { error: error instanceof Error ? error.message : String(error) },
          });

          // Handle retry logic if configured
          if (chain.config.retryPolicy && operation.metadata?.retriable) {
            // TODO: Implement retry logic
          }

          // Re-throw error to stop chain execution
          throw error;
        }
      }

      const totalDuration = Date.now() - startTime;

      // Emit chain complete event
      this.emitEvent({
        type: 'chain.complete',
        chainId,
        timestamp: Date.now(),
        data: { duration: totalDuration, success: true },
      });

      return {
        output: currentOutput as TOutput,
        chainId,
        duration: totalDuration,
        operations: results,
        metadata: {
          totalTokens,
          totalCost,
          adaptiveChoices,
        },
      };
    } catch (error) {
      const totalDuration = Date.now() - startTime;

      // Emit chain complete event with failure
      this.emitEvent({
        type: 'chain.complete',
        chainId,
        timestamp: Date.now(),
        data: { duration: totalDuration, success: false, error },
      });

      throw error;
    }
  }

  async *stream<TInput, TOutput>(
    chain: HCELChain<TInput, TOutput>,
    input: TInput,
    context?: HCELContext
  ): AsyncGenerator<TOutput, HCELResult<TOutput>> {
    // For now, execute the full chain and yield the final result
    // TODO: Implement true streaming execution
    const result = await this.execute(chain, input, context);
    yield result.output as TOutput;
    return result;
  }

  // ── Event Management ───────────────────────────────────────────

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

  // ── Adaptive Execution ─────────────────────────────────────────

  private shouldExecuteParallel(operations: HCELOperation[]): boolean {
    // Simple heuristic: execute parallel if operations are independent
    // TODO: Implement more sophisticated adaptive logic
    return operations.length > 1 && operations.every((op) => op.type !== 'conditional');
  }

  private optimizeExecutionOrder(operations: HCELOperation[]): HCELOperation[] {
    // Simple optimization: move expensive operations later if possible
    // TODO: Implement more sophisticated optimization
    return operations.sort((a, b) => {
      const aCost = a.metadata?.cost || 0;
      const bCost = b.metadata?.cost || 0;
      return aCost - bCost;
    });
  }

  // ── Context Management ─────────────────────────────────────────

  private createContext(baseContext?: HCELContext): HCELContext {
    return {
      sessionId: baseContext?.sessionId || randomUUID(),
      userId: baseContext?.userId,
      traceId: baseContext?.traceId || randomUUID(),
      metadata: baseContext?.metadata || {},
      propagate: function (): HCELContext {
        return this;
      },
    };
  }

  // ── Error Handling ───────────────────────────────────────────

  private createExecutionError(
    operation: HCELOperation,
    error: unknown,
    _context: HCELContext
  ): Error {
    const message = error instanceof Error ? error.message : String(error);
    return new Error(
      `HCEL execution failed in operation ${operation.type} (${operation.id}): ${message}`
    );
  }

  // ── Metrics Collection ─────────────────────────────────────────

  private collectMetrics(result: HCELResult): {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageOperationDuration: number;
    totalTokens: number;
    totalCost: number;
  } {
    const successfulOps = result.operations.filter((op) => op.success);
    const failedOps = result.operations.filter((op) => !op.success);
    const totalDuration = result.operations.reduce((sum, op) => sum + op.duration, 0);

    return {
      totalOperations: result.operations.length,
      successfulOperations: successfulOps.length,
      failedOperations: failedOps.length,
      averageOperationDuration: totalDuration / result.operations.length,
      totalTokens: result.metadata.totalTokens || 0,
      totalCost: result.metadata.totalCost || 0,
    };
  }
}
