"use strict";
/**
 * Structured agent errors for robust handling and observability
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentError = exports.AgentErrorCode = void 0;
var AgentErrorCode;
(function (AgentErrorCode) {
    AgentErrorCode["TIMEOUT"] = "AGENT_TIMEOUT";
    AgentErrorCode["CANCELLED"] = "AGENT_CANCELLED";
    AgentErrorCode["MAX_STEPS_EXCEEDED"] = "AGENT_MAX_STEPS_EXCEEDED";
    AgentErrorCode["TOOL_NOT_FOUND"] = "AGENT_TOOL_NOT_FOUND";
    AgentErrorCode["INVALID_TOOL_INPUT"] = "AGENT_INVALID_TOOL_INPUT";
    AgentErrorCode["LLM_ERROR"] = "AGENT_LLM_ERROR";
    AgentErrorCode["EXECUTION_NOT_FOUND"] = "AGENT_EXECUTION_NOT_FOUND";
    AgentErrorCode["RATE_LIMIT_EXCEEDED"] = "AGENT_RATE_LIMIT_EXCEEDED";
})(AgentErrorCode || (exports.AgentErrorCode = AgentErrorCode = {}));
/**
 * AgentError – structured error with code and optional cause
 */
class AgentError extends Error {
    constructor(message, code, cause) {
        super(message);
        this.name = 'AgentError';
        this.code = code;
        this.cause = cause;
        Object.setPrototypeOf(this, AgentError.prototype);
    }
    static timeout(message = 'Execution timed out') {
        return new AgentError(message, AgentErrorCode.TIMEOUT);
    }
    static cancelled(message = 'Execution was cancelled') {
        return new AgentError(message, AgentErrorCode.CANCELLED);
    }
    static maxSteps(maxSteps) {
        return new AgentError(`Maximum steps (${maxSteps}) exceeded`, AgentErrorCode.MAX_STEPS_EXCEEDED);
    }
    static toolNotFound(toolName) {
        return new AgentError(`Tool ${toolName} not found`, AgentErrorCode.TOOL_NOT_FOUND);
    }
    static invalidToolInput(toolName, reason, cause) {
        return new AgentError(`Invalid tool input for ${toolName}: ${reason}`, AgentErrorCode.INVALID_TOOL_INPUT, cause);
    }
    static llmError(message, cause) {
        return new AgentError(message, AgentErrorCode.LLM_ERROR, cause);
    }
    static executionNotFound(executionId) {
        return new AgentError(`Execution context ${executionId} not found`, AgentErrorCode.EXECUTION_NOT_FOUND);
    }
    static rateLimitExceeded(message = 'Rate limit exceeded - too many requests') {
        return new AgentError(message, AgentErrorCode.RATE_LIMIT_EXCEEDED);
    }
}
exports.AgentError = AgentError;
