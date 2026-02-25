/**
 * Circuit Breaker
 * Prevents cascading failures by stopping calls to failing services.
 *
 * States:
 *   CLOSED  -> normal operation, calls pass through
 *   OPEN    -> calls are rejected immediately
 *   HALF_OPEN -> a limited number of trial calls are allowed through
 *
 * Enhanced with sliding window metrics, failure predicates,
 * event emitter, and fallback support.
 */

import { EventEmitter } from 'events';
import {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerError,
  CircuitBreakerMetrics,
  TimeoutError,
} from '../types';
import { SlidingWindow, createSlidingWindow } from './sliding-window';
import { MetricsCollector } from '../metrics/metrics-collector';

const DEFAULT_CONFIG: Required<
  Omit<CircuitBreakerConfig, 'fallback' | 'onStateChange' | 'failurePredicate'>
> & {
  fallback?: string;
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  failurePredicate?: (error: unknown) => boolean;
} = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60_000,
  resetTimeout: 30_000,
  slidingWindow: { type: 'count', size: 20 },
  fallback: undefined,
  onStateChange: undefined,
  failurePredicate: undefined,
};

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private nextAttempt = 0;
  private halfOpenSuccessCount = 0;
  private slidingWindow: SlidingWindow;
  private metrics: MetricsCollector;
  private config: typeof DEFAULT_CONFIG;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    const swCfg = this.config.slidingWindow!;
    this.slidingWindow = createSlidingWindow(swCfg.type, swCfg.size);
    this.metrics = new MetricsCollector(swCfg.type === 'time' ? swCfg.size : 60_000);
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // If OPEN, check if it's time to try again
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new CircuitBreakerError('Circuit breaker is OPEN - service unavailable', this.state);
      }
      this.transitionTo(CircuitState.HALF_OPEN);
    }

    const startTime = Date.now();
    let timeoutId: NodeJS.Timeout | undefined;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new TimeoutError('Circuit breaker timeout')),
          this.config.timeout
        );
      });

      const result = await Promise.race([fn(), timeoutPromise]);
      const duration = Date.now() - startTime;

      this.onSuccess(duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Check if this error should count as a failure
      if (this.config.failurePredicate && !this.config.failurePredicate(error)) {
        // Error does not count as failure — still record as success for metrics
        this.metrics.recordSuccess(duration);
        throw error;
      }

      this.onFailure(duration, error);
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  // ─── State Queries ───

  getState(): CircuitState {
    return this.state;
  }

  isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  isClosed(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  isHalfOpen(): boolean {
    return this.state === CircuitState.HALF_OPEN;
  }

  getMetrics(): CircuitBreakerMetrics {
    const snapshot = this.metrics.getSnapshot();
    return {
      totalRequests: snapshot.totalCalls,
      successCount: snapshot.successCalls,
      failureCount: snapshot.failureCalls,
      failureRate: snapshot.failureRate,
      state: this.state,
      lastFailureTime: snapshot.failureCalls > 0 ? snapshot.lastCallTime : undefined,
      lastSuccessTime: snapshot.successCalls > 0 ? snapshot.lastCallTime : undefined,
      averageResponseTime: snapshot.averageResponseTime,
      p99ResponseTime: snapshot.p99ResponseTime,
    };
  }

  /**
   * Get the failure count within the current sliding window
   */
  getFailureCount(): number {
    return this.slidingWindow.getResult().failureCount;
  }

  /**
   * Get the success count within the current sliding window
   */
  getSuccessCount(): number {
    const result = this.slidingWindow.getResult();
    return result.totalCalls - result.failureCount;
  }

  getMetricsCollector(): MetricsCollector {
    return this.metrics;
  }

  getTimeUntilNextAttempt(): number {
    if (this.state !== CircuitState.OPEN) return 0;
    return Math.max(0, this.nextAttempt - Date.now());
  }

  /**
   * Manually reset the circuit to CLOSED
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.slidingWindow.reset();
    this.metrics.reset();
  }

  // ─── Internal ───

  private onSuccess(duration: number): void {
    this.slidingWindow.record(true);
    this.metrics.recordSuccess(duration);
    this.emit('success', { duration });

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenSuccessCount++;
      if (this.halfOpenSuccessCount >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }
  }

  private onFailure(duration: number, error: unknown): void {
    this.slidingWindow.record(false);
    this.metrics.recordFailure(duration, String(error));
    this.emit('failure', { duration, error });

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in HALF_OPEN immediately opens the circuit
      this.transitionTo(CircuitState.OPEN);
      return;
    }

    // Check sliding window failure rate / count
    const result = this.slidingWindow.getResult();
    if (result.failureCount >= this.config.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;

    const previousState = this.state;
    this.state = newState;

    if (newState === CircuitState.OPEN) {
      this.nextAttempt = Date.now() + this.config.resetTimeout;
    } else if (newState === CircuitState.CLOSED) {
      this.halfOpenSuccessCount = 0;
      this.slidingWindow.reset();
    } else if (newState === CircuitState.HALF_OPEN) {
      this.halfOpenSuccessCount = 0;
    }

    this.emit('stateChange', previousState, newState);
    this.config.onStateChange?.(previousState, newState);
  }
}
