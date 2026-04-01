import { AIError, AIErrorCode } from './ai.error';

describe('AIError', () => {
  describe('constructor', () => {
    it('should create AIError with message and code', () => {
      const error = new AIError('Test message', AIErrorCode.COMPLETION_FAILED);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AIError);
      expect(error.name).toBe('AIError');
      expect(error.message).toBe('Test message');
      expect(error.code).toBe(AIErrorCode.COMPLETION_FAILED);
      expect(error.cause).toBeUndefined();
    });

    it('should create AIError with message, code, and cause', () => {
      const cause = new Error('Original error');
      const error = new AIError('Test message', AIErrorCode.COMPLETION_FAILED, cause);

      expect(error.message).toBe('Test message');
      expect(error.code).toBe(AIErrorCode.COMPLETION_FAILED);
      expect(error.cause).toBe(cause);
    });
  });

  describe('static factory methods', () => {
    describe('providerNotFound', () => {
      it('should create provider not found error', () => {
        const error = AIError.providerNotFound('unknown-provider');

        expect(error).toBeInstanceOf(AIError);
        expect(error.code).toBe(AIErrorCode.PROVIDER_NOT_FOUND);
        expect(error.message).toContain('AI provider "unknown-provider" not found');
        expect(error.message).toContain('registerProvider()');
      });
    });

    describe('providerNotConfigured', () => {
      it('should create provider not configured error for known providers', () => {
        const error = AIError.providerNotConfigured('openai');

        expect(error.code).toBe(AIErrorCode.PROVIDER_NOT_CONFIGURED);
        expect(error.message).toContain('AI provider "openai" is not configured');
        expect(error.message).toContain('OPENAI_API_KEY');
      });

      it('should create provider not configured error for anthropic', () => {
        const error = AIError.providerNotConfigured('anthropic');

        expect(error.code).toBe(AIErrorCode.PROVIDER_NOT_CONFIGURED);
        expect(error.message).toContain('ANTHROPIC_API_KEY');
      });

      it('should create provider not configured error for gemini', () => {
        const error = AIError.providerNotConfigured('gemini');

        expect(error.code).toBe(AIErrorCode.PROVIDER_NOT_CONFIGURED);
        expect(error.message).toContain('GOOGLE_API_KEY');
      });

      it('should create provider not configured error for cohere', () => {
        const error = AIError.providerNotConfigured('cohere');

        expect(error.code).toBe(AIErrorCode.PROVIDER_NOT_CONFIGURED);
        expect(error.message).toContain('COHERE_API_KEY');
      });

      it('should create provider not configured error for unknown provider', () => {
        const error = AIError.providerNotConfigured('unknown');

        expect(error.code).toBe(AIErrorCode.PROVIDER_NOT_CONFIGURED);
        expect(error.message).toContain('UNKNOWN_API_KEY');
      });
    });

    describe('completionFailed', () => {
      it('should create completion failed error without cause', () => {
        const error = AIError.completionFailed('Completion failed');

        expect(error.code).toBe(AIErrorCode.COMPLETION_FAILED);
        expect(error.message).toBe('Completion failed');
        expect(error.cause).toBeUndefined();
      });

      it('should create completion failed error with cause', () => {
        const cause = new Error('Network error');
        const error = AIError.completionFailed('Completion failed', cause);

        expect(error.code).toBe(AIErrorCode.COMPLETION_FAILED);
        expect(error.message).toBe('Completion failed');
        expect(error.cause).toBe(cause);
      });
    });

    describe('streamingFailed', () => {
      it('should create streaming failed error without cause', () => {
        const error = AIError.streamingFailed('Streaming failed');

        expect(error.code).toBe(AIErrorCode.STREAMING_FAILED);
        expect(error.message).toBe('Streaming failed');
        expect(error.cause).toBeUndefined();
      });

      it('should create streaming failed error with cause', () => {
        const cause = new Error('Connection lost');
        const error = AIError.streamingFailed('Streaming failed', cause);

        expect(error.code).toBe(AIErrorCode.STREAMING_FAILED);
        expect(error.message).toBe('Streaming failed');
        expect(error.cause).toBe(cause);
      });
    });

    describe('embeddingFailed', () => {
      it('should create embedding failed error without cause', () => {
        const error = AIError.embeddingFailed('Embedding failed');

        expect(error.code).toBe(AIErrorCode.EMBEDDING_FAILED);
        expect(error.message).toBe('Embedding failed');
        expect(error.cause).toBeUndefined();
      });

      it('should create embedding failed error with cause', () => {
        const cause = new Error('Invalid input');
        const error = AIError.embeddingFailed('Embedding failed', cause);

        expect(error.code).toBe(AIErrorCode.EMBEDDING_FAILED);
        expect(error.message).toBe('Embedding failed');
        expect(error.cause).toBe(cause);
      });
    });

    describe('rateLimit', () => {
      it('should create rate limit error without retry after', () => {
        const error = AIError.rateLimit();

        expect(error.code).toBe(AIErrorCode.RATE_LIMIT);
        expect(error.message).toBe('Rate limited by the AI provider. Please wait before retrying.');
      });

      it('should create rate limit error with retry after', () => {
        const error = AIError.rateLimit(5000);

        expect(error.code).toBe(AIErrorCode.RATE_LIMIT);
        expect(error.message).toBe('Rate limited by the AI provider. Retry after 5000ms.');
      });
    });

    describe('tokenLimitExceeded', () => {
      it('should create token limit exceeded error', () => {
        const error = AIError.tokenLimitExceeded(1000, 1500);

        expect(error.code).toBe(AIErrorCode.TOKEN_LIMIT_EXCEEDED);
        expect(error.message).toContain('request uses ~1500 tokens');
        expect(error.message).toContain('limit is 1000');
        expect(error.message).toContain('Reduce the prompt length');
      });
    });

    describe('invalidRequest', () => {
      it('should create invalid request error', () => {
        const error = AIError.invalidRequest('Invalid parameters');

        expect(error.code).toBe(AIErrorCode.INVALID_REQUEST);
        expect(error.message).toBe('Invalid parameters');
      });
    });

    describe('authenticationFailed', () => {
      it('should create authentication failed error without cause', () => {
        const error = AIError.authenticationFailed('openai');

        expect(error.code).toBe(AIErrorCode.AUTHENTICATION_FAILED);
        expect(error.message).toContain('Authentication failed for provider "openai"');
        expect(error.message).toContain('Check your API key');
        expect(error.cause).toBeUndefined();
      });

      it('should create authentication failed error with cause', () => {
        const cause = new Error('Invalid API key');
        const error = AIError.authenticationFailed('anthropic', cause);

        expect(error.code).toBe(AIErrorCode.AUTHENTICATION_FAILED);
        expect(error.message).toContain('Authentication failed for provider "anthropic"');
        expect(error.cause).toBe(cause);
      });
    });
  });

  describe('error codes enum', () => {
    it('should have all expected error codes', () => {
      expect(AIErrorCode.PROVIDER_NOT_FOUND).toBe('AI_PROVIDER_NOT_FOUND');
      expect(AIErrorCode.PROVIDER_NOT_CONFIGURED).toBe('AI_PROVIDER_NOT_CONFIGURED');
      expect(AIErrorCode.COMPLETION_FAILED).toBe('AI_COMPLETION_FAILED');
      expect(AIErrorCode.STREAMING_FAILED).toBe('AI_STREAMING_FAILED');
      expect(AIErrorCode.EMBEDDING_FAILED).toBe('AI_EMBEDDING_FAILED');
      expect(AIErrorCode.RATE_LIMIT).toBe('AI_RATE_LIMIT');
      expect(AIErrorCode.TOKEN_LIMIT_EXCEEDED).toBe('AI_TOKEN_LIMIT_EXCEEDED');
      expect(AIErrorCode.INVALID_REQUEST).toBe('AI_INVALID_REQUEST');
      expect(AIErrorCode.AUTHENTICATION_FAILED).toBe('AI_AUTHENTICATION_FAILED');
    });
  });

  describe('error serialization', () => {
    it('should serialize correctly to JSON', () => {
      const cause = new Error('Original error');
      const error = AIError.completionFailed('Test error', cause);

      const json = JSON.stringify(error, Object.getOwnPropertyNames(error));

      expect(json).toContain('Test error');
      expect(json).toContain('AI_COMPLETION_FAILED');
    });

    it('should have correct stack trace', () => {
      const error = AIError.providerNotFound('test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AIError');
    });
  });
});
