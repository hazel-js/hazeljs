/**
 * Structured agent errors for robust handling and observability
 */

export enum AgentErrorCode {
  TIMEOUT = 'AGENT_TIMEOUT',
  CANCELLED = 'AGENT_CANCELLED',
  MAX_STEPS_EXCEEDED = 'AGENT_MAX_STEPS_EXCEEDED',
  TOOL_NOT_FOUND = 'AGENT_TOOL_NOT_FOUND',
  INVALID_TOOL_INPUT = 'AGENT_INVALID_TOOL_INPUT',
  LLM_ERROR = 'AGENT_LLM_ERROR',
  EXECUTION_NOT_FOUND = 'AGENT_EXECUTION_NOT_FOUND',
  RATE_LIMIT_EXCEEDED = 'AGENT_RATE_LIMIT_EXCEEDED',
}

/**
 * AgentError – structured error with code and optional cause
 */
export class AgentError extends Error {
  readonly code: AgentErrorCode;
  readonly cause?: Error;

  constructor(message: string, code: AgentErrorCode, cause?: Error) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    this.cause = cause;
    Object.setPrototypeOf(this, AgentError.prototype);
  }

  static timeout(message: string = 'Execution timed out'): AgentError {
    return new AgentError(message, AgentErrorCode.TIMEOUT);
  }

  static cancelled(message: string = 'Execution was cancelled'): AgentError {
    return new AgentError(message, AgentErrorCode.CANCELLED);
  }

  static maxSteps(maxSteps: number): AgentError {
    return new AgentError(
      `Maximum steps (${maxSteps}) exceeded`,
      AgentErrorCode.MAX_STEPS_EXCEEDED
    );
  }

  static toolNotFound(toolName: string): AgentError {
    return new AgentError(`Tool ${toolName} not found`, AgentErrorCode.TOOL_NOT_FOUND);
  }

  static invalidToolInput(toolName: string, reason: string, cause?: Error): AgentError {
    return new AgentError(
      `Invalid tool input for ${toolName}: ${reason}`,
      AgentErrorCode.INVALID_TOOL_INPUT,
      cause
    );
  }

  static llmError(message: string, cause?: Error): AgentError {
    return new AgentError(message, AgentErrorCode.LLM_ERROR, cause);
  }

  static executionNotFound(executionId: string): AgentError {
    return new AgentError(
      `Execution context ${executionId} not found`,
      AgentErrorCode.EXECUTION_NOT_FOUND
    );
  }

  static rateLimitExceeded(
    message: string = 'Rate limit exceeded - too many requests'
  ): AgentError {
    return new AgentError(message, AgentErrorCode.RATE_LIMIT_EXCEEDED);
  }
}
