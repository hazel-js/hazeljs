/**
 * Structured agent errors for robust handling and observability
 */
export declare enum AgentErrorCode {
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
export declare class AgentError extends Error {
  readonly code: AgentErrorCode;
  readonly cause?: Error;
  constructor(message: string, code: AgentErrorCode, cause?: Error);
  static timeout(message?: string): AgentError;
  static cancelled(message?: string): AgentError;
  static maxSteps(maxSteps: number): AgentError;
  static toolNotFound(toolName: string): AgentError;
  static invalidToolInput(toolName: string, reason: string, cause?: Error): AgentError;
  static llmError(message: string, cause?: Error): AgentError;
  static executionNotFound(executionId: string): AgentError;
  static rateLimitExceeded(message?: string): AgentError;
}
//# sourceMappingURL=agent.error.d.ts.map
