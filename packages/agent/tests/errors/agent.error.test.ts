import { AgentError, AgentErrorCode } from '../../src/errors/agent.error';

describe('AgentError', () => {
  describe('constructor', () => {
    it('should create error with code', () => {
      const error = new AgentError('Test error', AgentErrorCode.TIMEOUT);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(AgentErrorCode.TIMEOUT);
      expect(error.name).toBe('AgentError');
    });

    it('should create error with cause', () => {
      const cause = new Error('Original error');
      const error = new AgentError('Test error', AgentErrorCode.LLM_ERROR, cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('timeout', () => {
    it('should create timeout error with default message', () => {
      const error = AgentError.timeout();
      expect(error.code).toBe(AgentErrorCode.TIMEOUT);
      expect(error.message).toBe('Execution timed out');
    });

    it('should create timeout error with custom message', () => {
      const error = AgentError.timeout('Custom timeout');
      expect(error.message).toBe('Custom timeout');
    });
  });

  describe('cancelled', () => {
    it('should create cancelled error with default message', () => {
      const error = AgentError.cancelled();
      expect(error.code).toBe(AgentErrorCode.CANCELLED);
      expect(error.message).toBe('Execution was cancelled');
    });

    it('should create cancelled error with custom message', () => {
      const error = AgentError.cancelled('User cancelled');
      expect(error.message).toBe('User cancelled');
    });
  });

  describe('maxSteps', () => {
    it('should create max steps error', () => {
      const error = AgentError.maxSteps(10);
      expect(error.code).toBe(AgentErrorCode.MAX_STEPS_EXCEEDED);
      expect(error.message).toContain('10');
    });
  });

  describe('toolNotFound', () => {
    it('should create tool not found error', () => {
      const error = AgentError.toolNotFound('myTool');
      expect(error.code).toBe(AgentErrorCode.TOOL_NOT_FOUND);
      expect(error.message).toContain('myTool');
    });
  });

  describe('invalidToolInput', () => {
    it('should create invalid tool input error without cause', () => {
      const error = AgentError.invalidToolInput('myTool', 'missing parameter');
      expect(error.code).toBe(AgentErrorCode.INVALID_TOOL_INPUT);
      expect(error.message).toContain('myTool');
      expect(error.message).toContain('missing parameter');
      expect(error.cause).toBeUndefined();
    });

    it('should create invalid tool input error with cause', () => {
      const cause = new Error('Validation failed');
      const error = AgentError.invalidToolInput('myTool', 'invalid format', cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('llmError', () => {
    it('should create LLM error without cause', () => {
      const error = AgentError.llmError('API failed');
      expect(error.code).toBe(AgentErrorCode.LLM_ERROR);
      expect(error.message).toBe('API failed');
      expect(error.cause).toBeUndefined();
    });

    it('should create LLM error with cause', () => {
      const cause = new Error('Network error');
      const error = AgentError.llmError('API failed', cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('executionNotFound', () => {
    it('should create execution not found error', () => {
      const error = AgentError.executionNotFound('exec-123');
      expect(error.code).toBe(AgentErrorCode.EXECUTION_NOT_FOUND);
      expect(error.message).toContain('exec-123');
    });
  });

  describe('rateLimitExceeded', () => {
    it('should create rate limit error with default message', () => {
      const error = AgentError.rateLimitExceeded();
      expect(error.code).toBe(AgentErrorCode.RATE_LIMIT_EXCEEDED);
      expect(error.message).toBe('Rate limit exceeded - too many requests');
    });

    it('should create rate limit error with custom message', () => {
      const error = AgentError.rateLimitExceeded('Custom rate limit message');
      expect(error.message).toBe('Custom rate limit message');
    });
  });
});
