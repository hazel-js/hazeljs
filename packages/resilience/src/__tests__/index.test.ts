/**
 * Index exports test - verifies all public API is exported correctly
 */
import {
  CircuitBreaker,
  CircuitBreakerRegistry,
  CountBasedSlidingWindow,
  TimeBasedSlidingWindow,
  createSlidingWindow,
  RetryPolicy,
  Timeout,
  withTimeout,
  Bulkhead,
  RateLimiter,
  TokenBucketLimiter,
  SlidingWindowLimiter,
  MetricsCollector,
  MetricsRegistry,
  WithCircuitBreaker,
  WithRetry,
  WithTimeout,
  WithBulkhead,
  Fallback,
  WithRateLimit,
  CircuitState,
  CircuitBreakerError,
  RetryExhaustedError,
  TimeoutError,
  BulkheadError,
  RateLimitError,
} from '../index';

describe('resilience index exports', () => {
  it('should export circuit breaker components', () => {
    expect(CircuitBreaker).toBeDefined();
    expect(CircuitBreakerRegistry).toBeDefined();
    expect(CountBasedSlidingWindow).toBeDefined();
    expect(TimeBasedSlidingWindow).toBeDefined();
    expect(createSlidingWindow).toBeDefined();
  });

  it('should export retry policy', () => {
    expect(RetryPolicy).toBeDefined();
  });

  it('should export timeout', () => {
    expect(Timeout).toBeDefined();
    expect(withTimeout).toBeDefined();
  });

  it('should export bulkhead', () => {
    expect(Bulkhead).toBeDefined();
  });

  it('should export rate limiter', () => {
    expect(RateLimiter).toBeDefined();
    expect(TokenBucketLimiter).toBeDefined();
    expect(SlidingWindowLimiter).toBeDefined();
  });

  it('should export metrics', () => {
    expect(MetricsCollector).toBeDefined();
    expect(MetricsRegistry).toBeDefined();
  });

  it('should export decorators', () => {
    expect(WithCircuitBreaker).toBeDefined();
    expect(WithRetry).toBeDefined();
    expect(WithTimeout).toBeDefined();
    expect(WithBulkhead).toBeDefined();
    expect(Fallback).toBeDefined();
    expect(WithRateLimit).toBeDefined();
  });

  it('should export types and errors', () => {
    expect(CircuitState).toBeDefined();
    expect(CircuitBreakerError).toBeDefined();
    expect(RetryExhaustedError).toBeDefined();
    expect(TimeoutError).toBeDefined();
    expect(BulkheadError).toBeDefined();
    expect(RateLimitError).toBeDefined();
  });
});
