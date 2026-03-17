import 'reflect-metadata';
import type { WorkerTaskOptions } from './worker.types';

/**
 * Metadata key for worker tasks
 */
export const WORKER_TASK_METADATA_KEY = Symbol('worker:task');

/**
 * Metadata stored on @WorkerTask decorated classes
 */
export interface WorkerTaskMetadata {
  name: string;
  timeout?: number;
  maxConcurrency?: number;
}

/**
 * Class decorator to mark a class as a worker task handler.
 * The class must implement a run(payload) method.
 *
 * @example
 * ```ts
 * @WorkerTask({
 *   name: 'generate-embeddings',
 *   timeout: 15000,
 *   maxConcurrency: 4,
 * })
 * export class GenerateEmbeddingsTask {
 *   async run(payload: { text: string[] }) {
 *     return expensiveEmbeddingGeneration(payload.text);
 *   }
 * }
 * ```
 */
export function WorkerTask(options: WorkerTaskOptions): ClassDecorator {
  return (target: object) => {
    const metadata: WorkerTaskMetadata = {
      name: options.name,
      timeout: options.timeout,
      maxConcurrency: options.maxConcurrency,
    };
    Reflect.defineMetadata(WORKER_TASK_METADATA_KEY, metadata, target);
  };
}

/**
 * Get worker task metadata from a class or instance
 */
export function getWorkerTaskMetadata(target: object): WorkerTaskMetadata | undefined {
  const constructor = typeof target === 'function' ? target : target.constructor;
  return Reflect.getMetadata(WORKER_TASK_METADATA_KEY, constructor);
}
