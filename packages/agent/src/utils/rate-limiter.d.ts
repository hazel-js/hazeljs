/**
 * Rate Limiter
 * Token bucket algorithm for rate limiting agent executions
 */
export interface RateLimiterConfig {
    tokensPerMinute: number;
    burstSize?: number;
}
export declare class RateLimiter {
    private tokens;
    private lastRefill;
    private readonly tokensPerMinute;
    private readonly burstSize;
    private readonly refillRate;
    constructor(config: RateLimiterConfig);
    /**
     * Try to consume a token
     * @returns true if token was consumed, false if rate limit exceeded
     */
    tryConsume(): boolean;
    /**
     * Wait until a token is available
     * @param timeoutMs Maximum time to wait in milliseconds
     * @returns true if token was acquired, false if timeout
     */
    waitForToken(timeoutMs?: number): Promise<boolean>;
    /**
     * Get current token count
     */
    getAvailableTokens(): number;
    /**
     * Reset the rate limiter
     */
    reset(): void;
    /**
     * Refill tokens based on elapsed time
     */
    private refill;
    /**
     * Sleep utility
     */
    private sleep;
}
//# sourceMappingURL=rate-limiter.d.ts.map