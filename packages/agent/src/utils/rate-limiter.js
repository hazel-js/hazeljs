"use strict";
/**
 * Rate Limiter
 * Token bucket algorithm for rate limiting agent executions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
class RateLimiter {
    constructor(config) {
        this.tokensPerMinute = config.tokensPerMinute;
        this.burstSize = config.burstSize || config.tokensPerMinute;
        this.tokens = this.burstSize;
        this.lastRefill = Date.now();
        this.refillRate = this.tokensPerMinute / 60000; // tokens per millisecond
    }
    /**
     * Try to consume a token
     * @returns true if token was consumed, false if rate limit exceeded
     */
    tryConsume() {
        this.refill();
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return true;
        }
        return false;
    }
    /**
     * Wait until a token is available
     * @param timeoutMs Maximum time to wait in milliseconds
     * @returns true if token was acquired, false if timeout
     */
    async waitForToken(timeoutMs = 30000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            if (this.tryConsume()) {
                return true;
            }
            // Calculate wait time until next token
            const tokensNeeded = 1 - this.tokens;
            const waitMs = Math.ceil(tokensNeeded / this.refillRate);
            const remainingTimeout = timeoutMs - (Date.now() - startTime);
            const actualWaitMs = Math.min(waitMs, remainingTimeout, 1000);
            if (actualWaitMs > 0) {
                await this.sleep(actualWaitMs);
            }
        }
        return false;
    }
    /**
     * Get current token count
     */
    getAvailableTokens() {
        this.refill();
        return Math.floor(this.tokens);
    }
    /**
     * Reset the rate limiter
     */
    reset() {
        this.tokens = this.burstSize;
        this.lastRefill = Date.now();
    }
    /**
     * Refill tokens based on elapsed time
     */
    refill() {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        const tokensToAdd = elapsed * this.refillRate;
        this.tokens = Math.min(this.burstSize, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }
    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.RateLimiter = RateLimiter;
