"use strict";
/**
 * Retry Logic with Exponential Backoff
 * Handles transient failures with configurable retry strategies
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryHandler = exports.RetryError = void 0;
exports.Retry = Retry;
class RetryError extends Error {
    constructor(message, attempts, lastError) {
        super(message);
        this.attempts = attempts;
        this.lastError = lastError;
        this.name = 'RetryError';
    }
}
exports.RetryError = RetryError;
class RetryHandler {
    constructor(config = {}) {
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
            onRetry: config.onRetry ?? (() => { }),
        };
    }
    /**
     * Execute a function with retry logic
     */
    async execute(fn) {
        let lastError;
        let attempt = 0;
        while (attempt <= this.config.maxRetries) {
            try {
                return await fn();
            }
            catch (error) {
                lastError = error;
                attempt++;
                if (attempt > this.config.maxRetries) {
                    throw new RetryError(`Failed after ${attempt} attempts: ${lastError.message}`, attempt, lastError);
                }
                if (!this.isRetryable(lastError)) {
                    throw lastError;
                }
                const delay = this.calculateDelay(attempt);
                this.config.onRetry(attempt, lastError);
                await this.sleep(delay);
            }
        }
        throw new RetryError(`Failed after ${attempt} attempts: ${lastError.message}`, attempt, lastError);
    }
    /**
     * Check if an error is retryable
     */
    isRetryable(error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errorCode = error.code || error.name;
        const errorMessage = error.message.toUpperCase();
        return this.config.retryableErrors.some((retryableError) => errorCode === retryableError || errorMessage.includes(retryableError.toUpperCase()));
    }
    /**
     * Calculate delay with exponential backoff and jitter
     */
    calculateDelay(attempt) {
        const exponentialDelay = this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
        const delayWithCap = Math.min(exponentialDelay, this.config.maxDelayMs);
        // Add jitter (±25%)
        const jitter = delayWithCap * 0.25 * (Math.random() * 2 - 1);
        return Math.max(0, delayWithCap + jitter);
    }
    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.RetryHandler = RetryHandler;
/**
 * Decorator for automatic retry
 */
function Retry(config) {
    const retryHandler = new RetryHandler(config);
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            return retryHandler.execute(() => originalMethod.apply(this, args));
        };
        return descriptor;
    };
}
