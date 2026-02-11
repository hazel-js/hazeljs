/**
 * Retry Policy
 * Configurable retry with exponential backoff, jitter, and retryable-error predicates.
 */

import { RetryConfig, RetryExhaustedError, BackoffStrategy } from '../types';

const DEFAULT_CONFIG: Required<Omit<RetryConfig, 'retryPredicate' | 'onRetry'>> & {
  retryPredicate?: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number) => void;
} = {
  maxAttempts: 3,
  backoff: 'exponential',
  baseDelay: 1000,
  maxDelay: 30_000,
  jitter: true,
  retryPredicate: undefined,
  onRetry: undefined,
};

/**
 * Calculate delay based on backoff strategy
 */
function calculateDelay(
  strategy: BackoffStrategy,
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  jitter: boolean
): number {
  let delay: number;

  switch (strategy) {
    case 'fixed':
      delay = baseDelay;
      break;
    case 'linear':
      delay = baseDelay * attempt;
      break;
    case 'exponential':
      delay = baseDelay * Math.pow(2, attempt - 1);
      break;
    default:
      delay = baseDelay;
  }

  // Cap at max delay
  delay = Math.min(delay, maxDelay);

  // Add jitter (random value between 0 and delay)
  if (jitter) {
    delay = delay * (0.5 + Math.random() * 0.5);
  }

  return Math.floor(delay);
}

export class RetryPolicy {
  private config: typeof DEFAULT_CONFIG;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    // Attempt 0 is the initial call, attempts 1..maxAttempts are retries
    for (let attempt = 0; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check if this error is retryable
        if (this.config.retryPredicate && !this.config.retryPredicate(error)) {
          throw error;
        }

        // If we've exhausted all retries, throw
        if (attempt >= this.config.maxAttempts) {
          break;
        }

        // Notify retry listener
        this.config.onRetry?.(error, attempt + 1);

        // Wait before next attempt
        const delay = calculateDelay(
          this.config.backoff,
          attempt + 1,
          this.config.baseDelay,
          this.config.maxDelay!,
          this.config.jitter!
        );

        await this.sleep(delay);
      }
    }

    throw new RetryExhaustedError(
      `Retry exhausted after ${this.config.maxAttempts} attempts`,
      this.config.maxAttempts,
      lastError
    );
  }

  /**
   * Get the configured max attempts
   */
  getMaxAttempts(): number {
    return this.config.maxAttempts;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
