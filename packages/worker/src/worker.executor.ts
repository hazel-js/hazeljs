import { Injectable } from '@hazeljs/core';
import type { WorkerExecutionOptions, WorkerExecutionResult } from './worker.types';
import type { WorkerResultMessage, WorkerErrorMessage } from './worker.types';
import { WorkerExecutionFailedError } from './worker.errors';
import type { WorkerRegistry } from './worker.registry';
import type { WorkerPoolManager } from './worker.pool';

/**
 * Service for executing CPU-intensive tasks in worker threads.
 * Inject this service to run tasks from controllers or other providers.
 */
@Injectable()
export class WorkerExecutor {
  constructor(
    private readonly registry: WorkerRegistry,
    private readonly pool: WorkerPoolManager
  ) {}

  /**
   * Execute a task by name with the given payload.
   *
   * @example
   * ```ts
   * const result = await this.workerExecutor.execute('generate-embeddings', { text: ['hello'] });
   * console.log(result.result, result.durationMs);
   * ```
   */
  async execute<T = unknown>(
    taskName: string,
    payload: unknown,
    options?: WorkerExecutionOptions
  ): Promise<WorkerExecutionResult<T>> {
    const definition = this.registry.get(taskName);
    const timeout = options?.timeout ?? definition.timeout;

    const response = await this.pool.execute(taskName, payload, timeout);

    if (response.type === 'error') {
      const errMsg = response as WorkerErrorMessage;
      throw new WorkerExecutionFailedError(taskName, new Error(errMsg.error.message));
    }

    const resultMsg = response as WorkerResultMessage;
    return {
      result: resultMsg.result as T,
      durationMs: resultMsg.durationMs,
    };
  }

  /**
   * Check if a task is registered
   */
  hasTask(taskName: string): boolean {
    return this.registry.has(taskName);
  }

  /**
   * Get list of registered task names
   */
  getTaskNames(): string[] {
    return this.registry.getTaskNames();
  }
}
