/**
 * Retry Logic with Exponential Backoff
 * Handles transient failures with configurable retry strategies
 */

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
  private config: Required<RetryConfig>;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      initialDelayMs: config.initialDelayMs ?? 1000,
      maxDelayMs: config.maxDelayMs ?? 30000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      retryableErrors: config.retryableErrors ?? [
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ECONNREFUSED',
        'RATE_LIMIT',
        'SERVICE_UNAVAILABLE',
        'TIMEOUT',
      ],
      onRetry: config.onRetry ?? ((): void => {}),
    };
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error;
    let attempt = 0;

    while (attempt <= this.config.maxRetries) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (attempt > this.config.maxRetries) {
          throw new RetryError(
            `Failed after ${attempt} attempts: ${lastError.message}`,
            attempt,
            lastError
          );
        }

        if (!this.isRetryable(lastError)) {
          throw lastError;
        }

        const delay = this.calculateDelay(attempt);
        this.config.onRetry(attempt, lastError);

        await this.sleep(delay);
      }
    }

    throw new RetryError(
      `Failed after ${attempt} attempts: ${lastError!.message}`,
      attempt,
      lastError!
    );
  }

  /**
   * Check if an error is retryable
   */
  private isRetryable(error: Error): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorCode = (error as any).code || error.name;
    const errorMessage = error.message.toUpperCase();

    return this.config.retryableErrors.some(
      (retryableError) =>
        errorCode === retryableError || errorMessage.includes(retryableError.toUpperCase())
    );
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number): number {
    const exponentialDelay =
      this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);

    const delayWithCap = Math.min(exponentialDelay, this.config.maxDelayMs);

    // Add jitter (±25%)
    const jitter = delayWithCap * 0.25 * (Math.random() * 2 - 1);

    return Math.max(0, delayWithCap + jitter);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Decorator for automatic retry
 */
export function Retry(config?: Partial<RetryConfig>): MethodDecorator {
  const retryHandler = new RetryHandler(config);

  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      return retryHandler.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
