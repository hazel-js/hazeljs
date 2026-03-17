/**
 * Worker module types and interfaces
 */

/**
 * Handler interface for worker tasks.
 * Task classes must implement a run method that accepts payload and returns result.
 */
export interface WorkerTaskHandler<TInput = unknown, TOutput = unknown> {
  run(payload: TInput): Promise<TOutput> | TOutput;
}

/**
 * Options for the @WorkerTask decorator
 */
export interface WorkerTaskOptions {
  /**
   * Unique task identifier used for execution and registry lookup
   */
  name: string;

  /**
   * Task-specific timeout in milliseconds
   */
  timeout?: number;

  /**
   * Maximum concurrent executions of this task across the pool
   */
  maxConcurrency?: number;
}

/**
 * Internal task definition with resolved handler path
 */
export interface WorkerTaskDefinition {
  name: string;
  handlerPath: string;
  timeout?: number;
  maxConcurrency?: number;
}

/**
 * Options for executing a task
 */
export interface WorkerExecutionOptions {
  /**
   * Override timeout for this execution (ms)
   */
  timeout?: number;

  /**
   * Transferable objects for efficient memory transfer (future use)
   */
  transferList?: ArrayBuffer[];
}

/**
 * Result of a successful task execution
 */
export interface WorkerExecutionResult<T = unknown> {
  result: T;
  durationMs: number;
}

/**
 * Context available during task execution (for future use)
 */
export interface WorkerTaskContext {
  taskName: string;
  workerId?: string;
  executionId?: string;
}

/**
 * Worker module configuration options
 */
export interface WorkerModuleOptions {
  /**
   * Number of worker threads in the pool
   * @default os.cpus().length - 1 (minimum 1)
   */
  poolSize?: number;

  /**
   * Explicit map of task name to absolute path of handler module
   */
  taskRegistry?: Record<string, string>;

  /**
   * Directory containing task handlers. Paths resolved at runtime as taskDirectory + taskName + taskFileExtension.
   */
  taskDirectory?: string;

  /**
   * File extension for task handlers when using taskDirectory (e.g. '.js' or '.task.js').
   * @default '.js'
   */
  taskFileExtension?: string;

  /**
   * Default task timeout in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Whether this module is global
   * @default true
   */
  isGlobal?: boolean;

  /**
   * Timeout for graceful shutdown (wait for in-flight tasks)
   * @default 10000
   */
  gracefulShutdownTimeout?: number;
}

/**
 * Worker pool configuration (taskRegistry provided at start from WorkerRegistry)
 */
export interface WorkerPoolOptions {
  poolSize: number;
  defaultTimeout: number;
  bootstrapPath: string;
  gracefulShutdownTimeout: number;
}

/**
 * Message sent from main thread to worker
 */
export interface WorkerRunMessage {
  type: 'run';
  id: string;
  taskName: string;
  payload: unknown;
  timeout?: number;
}

/**
 * Message sent from worker to main thread (success)
 */
export interface WorkerResultMessage {
  type: 'result';
  id: string;
  result: unknown;
  durationMs: number;
}

/**
 * Message sent from worker to main thread (error)
 */
export interface WorkerErrorMessage {
  type: 'error';
  id: string;
  error: {
    message: string;
    stack?: string;
    name?: string;
  };
}

export type WorkerResponseMessage = WorkerResultMessage | WorkerErrorMessage;
