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
export declare class RetryError extends Error {
    readonly attempts: number;
    readonly lastError: Error;
    constructor(message: string, attempts: number, lastError: Error);
}
export declare class RetryHandler {
    private config;
    constructor(config?: Partial<RetryConfig>);
    /**
     * Execute a function with retry logic
     */
    execute<T>(fn: () => Promise<T>): Promise<T>;
    /**
     * Check if an error is retryable
     */
    private isRetryable;
    /**
     * Calculate delay with exponential backoff and jitter
     */
    private calculateDelay;
    /**
     * Sleep utility
     */
    private sleep;
}
/**
 * Decorator for automatic retry
 */
export declare function Retry(config?: Partial<RetryConfig>): MethodDecorator;
//# sourceMappingURL=retry.d.ts.map