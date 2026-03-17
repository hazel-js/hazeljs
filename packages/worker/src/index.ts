/**
 * @hazeljs/worker - Worker thread module for CPU-intensive task offloading
 */

export { WorkerModule, WORKER_MODULE_OPTIONS } from './worker.module';
export { WorkerExecutor } from './worker.executor';
export { WorkerRegistry } from './worker.registry';
export { WorkerTask, getWorkerTaskMetadata, WORKER_TASK_METADATA_KEY } from './worker.decorator';
export type { WorkerTaskMetadata } from './worker.decorator';
export type {
  WorkerTaskHandler,
  WorkerTaskOptions,
  WorkerTaskDefinition,
  WorkerExecutionOptions,
  WorkerExecutionResult,
  WorkerModuleOptions,
  WorkerPoolOptions,
  WorkerTaskContext,
} from './worker.types';
export {
  WorkerTaskNotFoundError,
  WorkerTaskTimeoutError,
  WorkerPoolExhaustedError,
  WorkerExecutionFailedError,
  WorkerSerializationError,
} from './worker.errors';
export { getDefaultPoolSize } from './worker.pool';
