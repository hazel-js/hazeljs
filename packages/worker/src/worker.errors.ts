/**
 * Worker module error classes
 */

export class WorkerTaskNotFoundError extends Error {
  constructor(taskName: string) {
    super(`Worker task not found: ${taskName}`);
    this.name = 'WorkerTaskNotFoundError';
    Object.setPrototypeOf(this, WorkerTaskNotFoundError.prototype);
  }
}

export class WorkerTaskTimeoutError extends Error {
  constructor(taskName: string, timeoutMs: number) {
    super(`Worker task "${taskName}" timed out after ${timeoutMs}ms`);
    this.name = 'WorkerTaskTimeoutError';
    Object.setPrototypeOf(this, WorkerTaskTimeoutError.prototype);
  }
}

export class WorkerPoolExhaustedError extends Error {
  constructor(message?: string) {
    super(message ?? 'Worker pool exhausted: no available workers');
    this.name = 'WorkerPoolExhaustedError';
    Object.setPrototypeOf(this, WorkerPoolExhaustedError.prototype);
  }
}

export class WorkerExecutionFailedError extends Error {
  readonly cause?: Error;

  constructor(taskName: string, cause?: Error) {
    super(
      cause
        ? `Worker task "${taskName}" failed: ${cause.message}`
        : `Worker task "${taskName}" failed`
    );
    this.name = 'WorkerExecutionFailedError';
    this.cause = cause;
    Object.setPrototypeOf(this, WorkerExecutionFailedError.prototype);
  }
}

export class WorkerSerializationError extends Error {
  readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'WorkerSerializationError';
    this.cause = cause;
    Object.setPrototypeOf(this, WorkerSerializationError.prototype);
  }
}
