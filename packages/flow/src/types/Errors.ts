/**
 * Flow engine error types
 */

export class FlowError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable = false
  ) {
    super(message);
    this.name = 'FlowError';
    Object.setPrototypeOf(this, FlowError.prototype);
  }
}

export class LockBusyError extends FlowError {
  constructor(runId: string) {
    super(`Lock busy for run ${runId}`, 'LOCK_BUSY', true);
    this.name = 'LockBusyError';
  }
}

export class AmbiguousEdgeError extends FlowError {
  constructor(nodeId: string) {
    super(`Ambiguous edge from node ${nodeId}`, 'AMBIGUOUS_EDGE', false);
    this.name = 'AmbiguousEdgeError';
  }
}

export class FlowNotFoundError extends FlowError {
  constructor(flowId: string, version: string) {
    super(`Flow not found: ${flowId}@${version}`, 'FLOW_NOT_FOUND', false);
    this.name = 'FlowNotFoundError';
  }
}

export class RunNotFoundError extends FlowError {
  constructor(runId: string) {
    super(`Run not found: ${runId}`, 'RUN_NOT_FOUND', false);
    this.name = 'RunNotFoundError';
  }
}
