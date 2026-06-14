/**
 * @deprecated Use TokenBucketLimiter from @hazeljs/resilience directly.
 * Adapter preserving tokensPerMinute / waitForToken API used by AgentRuntime.
 */

import { TokenBucketLimiter } from '@hazeljs/resilience';

export interface RateLimiterConfig {
  tokensPerMinute: number;
  burstSize?: number;
}

export class RateLimiter {
  private limiter: TokenBucketLimiter;
  private readonly maxTokens: number;
  private readonly refillRatePerSecond: number;

  constructor(config: RateLimiterConfig) {
    this.maxTokens = config.burstSize ?? config.tokensPerMinute;
    this.refillRatePerSecond = config.tokensPerMinute / 60;
    this.limiter = new TokenBucketLimiter(this.maxTokens, this.refillRatePerSecond);
  }

  tryConsume(): boolean {
    return this.limiter.tryAcquire();
  }

  async waitForToken(timeoutMs: number = 30000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.limiter.tryAcquire()) {
        return true;
      }
      const waitMs = Math.min(
        this.limiter.getRetryAfterMs(),
        1000,
        timeoutMs - (Date.now() - start)
      );
      if (waitMs <= 0) {
        await sleep(50);
        continue;
      }
      await sleep(waitMs);
    }
    return false;
  }

  /** Approximate peek: 1 when a token is available, 0 otherwise. */
  getAvailableTokens(): number {
    return this.limiter.getRetryAfterMs() === 0 ? 1 : 0;
  }

  reset(): void {
    this.limiter = new TokenBucketLimiter(this.maxTokens, this.refillRatePerSecond);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
