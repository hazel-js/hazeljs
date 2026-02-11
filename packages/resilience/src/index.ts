/**
 * @hazeljs/resilience
 * Fault-tolerance and resilience patterns for HazelJS
 *
 * Provides circuit breaker, retry, timeout, bulkhead, rate limiter,
 * and metrics collection — all usable via decorators or programmatic API.
 */

// Types & Errors
export {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  CircuitBreakerError,
  SlidingWindowConfig,
  RetryConfig,
  BackoffStrategy,
  RetryExhaustedError,
  TimeoutConfig,
  TimeoutError,
  BulkheadConfig,
  BulkheadMetrics,
  BulkheadError,
  RateLimiterConfig,
  RateLimiterStrategy,
  RateLimitError,
  MetricsSnapshot,
  MetricsEntry,
  ResilienceError,
} from './types';

// Circuit Breaker
export { CircuitBreaker } from './circuit-breaker/circuit-breaker';
export { CircuitBreakerRegistry } from './circuit-breaker/circuit-breaker-registry';
export {
  SlidingWindow,
  CountBasedSlidingWindow,
  TimeBasedSlidingWindow,
  createSlidingWindow,
} from './circuit-breaker/sliding-window';

// Retry
export { RetryPolicy } from './retry/retry-policy';

// Timeout
export { Timeout, withTimeout } from './timeout/timeout';

// Bulkhead
export { Bulkhead } from './bulkhead/bulkhead';

// Rate Limiter
export {
  RateLimiter,
  TokenBucketLimiter,
  SlidingWindowLimiter,
} from './rate-limiter/rate-limiter';

// Metrics
export { MetricsCollector, MetricsRegistry } from './metrics/metrics-collector';

// Decorators (re-exported with decorator-friendly names)
export {
  CircuitBreaker as WithCircuitBreaker,
  Retry as WithRetry,
  Timeout as WithTimeout,
  Bulkhead as WithBulkhead,
  Fallback,
  RateLimit as WithRateLimit,
} from './decorators';
