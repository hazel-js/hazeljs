/**
 * @hazeljs/resilience - Type Definitions
 */

// ─── Circuit Breaker ───

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface SlidingWindowConfig {
  /** 'count' uses last N calls; 'time' uses a rolling time window */
  type: 'count' | 'time';
  /** For 'count': number of calls. For 'time': window duration in ms */
  size: number;
}

export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  /** Number of successes in HALF_OPEN before closing */
  successThreshold: number;
  /** Max time a single call may take before being considered failed (ms) */
  timeout: number;
  /** Time to wait in OPEN before transitioning to HALF_OPEN (ms) */
  resetTimeout: number;
  /** Sliding window configuration for failure rate calculation */
  slidingWindow?: SlidingWindowConfig;
  /** Custom predicate to determine if an error should count as a failure */
  failurePredicate?: (error: unknown) => boolean;
  /** Name of the fallback method on the same class */
  fallback?: string;
  /** Callback when state changes */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

export interface CircuitBreakerMetrics {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  failureRate: number;
  state: CircuitState;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  averageResponseTime: number;
  p99ResponseTime: number;
}

// ─── Retry ───

export type BackoffStrategy = 'fixed' | 'exponential' | 'linear';

export interface RetryConfig {
  /** Maximum number of retry attempts (not counting the initial call) */
  maxAttempts: number;
  /** Backoff strategy between retries */
  backoff: BackoffStrategy;
  /** Base delay in ms */
  baseDelay: number;
  /** Maximum delay between retries in ms */
  maxDelay?: number;
  /** Whether to add jitter to delay to avoid thundering herd */
  jitter?: boolean;
  /** Custom predicate to decide if an error is retryable */
  retryPredicate?: (error: unknown) => boolean;
  /** Called before each retry attempt */
  onRetry?: (error: unknown, attempt: number) => void;
}

// ─── Timeout ───

export interface TimeoutConfig {
  /** Timeout duration in ms */
  duration: number;
  /** Custom error message */
  message?: string;
}

// ─── Bulkhead ───

export interface BulkheadConfig {
  /** Maximum concurrent executions */
  maxConcurrent: number;
  /** Maximum number of calls waiting in queue */
  maxQueue: number;
  /** Time a call can wait in the queue before being rejected (ms) */
  queueTimeout?: number;
}

export interface BulkheadMetrics {
  activeCalls: number;
  queueLength: number;
  maxConcurrent: number;
  maxQueue: number;
  rejectedCount: number;
}

// ─── Rate Limiter ───

export type RateLimiterStrategy = 'token-bucket' | 'sliding-window';

export interface RateLimiterConfig {
  /** Strategy to use */
  strategy: RateLimiterStrategy;
  /** Maximum number of requests allowed in the window */
  max: number;
  /** Time window in ms (e.g. 60000 for 1 minute) */
  window: number;
  /** For token-bucket: refill rate (tokens per second). Defaults to max/window. */
  refillRate?: number;
}

// ─── Metrics ───

export interface MetricsSnapshot {
  totalCalls: number;
  successCalls: number;
  failureCalls: number;
  failureRate: number;
  averageResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  lastCallTime?: number;
}

export interface MetricsEntry {
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
}

// ─── Common ───

export class ResilienceError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'ResilienceError';
  }
}

export class CircuitBreakerError extends ResilienceError {
  constructor(
    message: string,
    public readonly state: CircuitState
  ) {
    super(message, 'CIRCUIT_OPEN');
    this.name = 'CircuitBreakerError';
  }
}

export class TimeoutError extends ResilienceError {
  constructor(message: string = 'Operation timed out') {
    super(message, 'TIMEOUT');
    this.name = 'TimeoutError';
  }
}

export class BulkheadError extends ResilienceError {
  constructor(message: string = 'Bulkhead capacity exceeded') {
    super(message, 'BULKHEAD_FULL');
    this.name = 'BulkheadError';
  }
}

export class RateLimitError extends ResilienceError {
  constructor(
    message: string = 'Rate limit exceeded',
    public readonly retryAfterMs?: number
  ) {
    super(message, 'RATE_LIMITED');
    this.name = 'RateLimitError';
  }
}

export class RetryExhaustedError extends ResilienceError {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: unknown
  ) {
    super(message, 'RETRY_EXHAUSTED');
    this.name = 'RetryExhaustedError';
  }
}
