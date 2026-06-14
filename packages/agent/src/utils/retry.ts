/**
 * @deprecated Use RetryPolicy from @hazeljs/resilience directly.
 * Thin adapter preserving the legacy RetryHandler API.
 */

import { RetryPolicy, RetryExhaustedError } from '@hazeljs/resilience';

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error) => void;
}

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

export class RetryHandler {
  private readonly policy: RetryPolicy;

  constructor(config: Partial<RetryConfig> = {}) {
    const retryableErrors = config.retryableErrors ?? [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'RATE_LIMIT',
      'SERVICE_UNAVAILABLE',
      'TIMEOUT',
    ];
    this.policy = new RetryPolicy({
      maxAttempts: config.maxRetries ?? 3,
      baseDelay: config.initialDelayMs ?? 1000,
      maxDelay: config.maxDelayMs ?? 30000,
      backoff: 'exponential',
      jitter: true,
      onRetry: config.onRetry
        ? (error, attempt): void => config.onRetry!(attempt, error as Error)
        : undefined,
      retryPredicate: (error): boolean => {
        const err = error as Error & { code?: string };
        const errorCode = err.code || err.name;
        const errorMessage = err.message.toUpperCase();
        return retryableErrors.some(
          (retryableError) =>
            errorCode === retryableError || errorMessage.includes(retryableError.toUpperCase())
        );
      },
    });
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await this.policy.execute(fn);
    } catch (error) {
      if (error instanceof RetryExhaustedError) {
        const totalAttempts = error.attempts + 1;
        throw new RetryError(
          `Failed after ${totalAttempts} attempts`,
          totalAttempts,
          error.lastError as Error
        );
      }
      throw error;
    }
  }
}

export function Retry(config?: Partial<RetryConfig>): MethodDecorator {
  const retryHandler = new RetryHandler(config);

  return function (_target: object, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      return retryHandler.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
