/**
 * Structured AI errors for robust handling and observability.
 *
 * Mirrors the `AgentError` pattern from `@hazeljs/agent` for consistency.
 */

export enum AIErrorCode {
  PROVIDER_NOT_FOUND = 'AI_PROVIDER_NOT_FOUND',
  PROVIDER_NOT_CONFIGURED = 'AI_PROVIDER_NOT_CONFIGURED',
  COMPLETION_FAILED = 'AI_COMPLETION_FAILED',
  STREAMING_FAILED = 'AI_STREAMING_FAILED',
  EMBEDDING_FAILED = 'AI_EMBEDDING_FAILED',
  RATE_LIMIT = 'AI_RATE_LIMIT',
  TOKEN_LIMIT_EXCEEDED = 'AI_TOKEN_LIMIT_EXCEEDED',
  INVALID_REQUEST = 'AI_INVALID_REQUEST',
  AUTHENTICATION_FAILED = 'AI_AUTHENTICATION_FAILED',
}

export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly cause?: Error;

  constructor(message: string, code: AIErrorCode, cause?: Error) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.cause = cause;
    Object.setPrototypeOf(this, AIError.prototype);
  }

  static providerNotFound(name: string): AIError {
    return new AIError(
      `AI provider "${name}" not found. Available providers are registered via AIEnhancedService. ` +
        `Did you forget to call registerProvider()?`,
      AIErrorCode.PROVIDER_NOT_FOUND
    );
  }

  static providerNotConfigured(name: string): AIError {
    const envVars: Record<string, string> = {
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
      gemini: 'GOOGLE_API_KEY',
      cohere: 'COHERE_API_KEY',
    };
    const envVar = envVars[name.toLowerCase()] || `${name.toUpperCase()}_API_KEY`;
    return new AIError(
      `AI provider "${name}" is not configured. Set the ${envVar} environment variable ` +
        `or pass apiKey when registering the provider.`,
      AIErrorCode.PROVIDER_NOT_CONFIGURED
    );
  }

  static completionFailed(message: string, cause?: Error): AIError {
    return new AIError(message, AIErrorCode.COMPLETION_FAILED, cause);
  }

  static streamingFailed(message: string, cause?: Error): AIError {
    return new AIError(message, AIErrorCode.STREAMING_FAILED, cause);
  }

  static embeddingFailed(message: string, cause?: Error): AIError {
    return new AIError(message, AIErrorCode.EMBEDDING_FAILED, cause);
  }

  static rateLimit(retryAfterMs?: number): AIError {
    const msg = retryAfterMs
      ? `Rate limited by the AI provider. Retry after ${retryAfterMs}ms.`
      : 'Rate limited by the AI provider. Please wait before retrying.';
    return new AIError(msg, AIErrorCode.RATE_LIMIT);
  }

  static tokenLimitExceeded(limit: number, actual: number): AIError {
    return new AIError(
      `Token limit exceeded: request uses ~${actual} tokens but the limit is ${limit}. ` +
        `Reduce the prompt length or increase maxTokens.`,
      AIErrorCode.TOKEN_LIMIT_EXCEEDED
    );
  }

  static invalidRequest(message: string): AIError {
    return new AIError(message, AIErrorCode.INVALID_REQUEST);
  }

  static authenticationFailed(provider: string, cause?: Error): AIError {
    return new AIError(
      `Authentication failed for provider "${provider}". Check your API key.`,
      AIErrorCode.AUTHENTICATION_FAILED,
      cause
    );
  }
}
