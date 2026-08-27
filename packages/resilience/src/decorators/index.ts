/**
 * Resilience Decorators
 * Decorator-based API consistent with HazelJS philosophy.
 *
 * Decorators compose in the order they are declared (outermost first).
 * Example:
 *   @CircuitBreaker(...)   <-- outermost wrapper
 *   @Retry(...)            <-- wraps the timeout
 *   @Timeout(5000)         <-- wraps the bulkhead
 *   @Bulkhead(...)         <-- innermost wrapper around the original fn
 */

import 'reflect-metadata';
import { CircuitBreakerRegistry } from '../circuit-breaker/circuit-breaker-registry';
import { RetryPolicy } from '../retry/retry-policy';
import { Timeout as TimeoutInstance } from '../timeout/timeout';
import { Bulkhead as BulkheadInstance } from '../bulkhead/bulkhead';
import { RateLimiter as RateLimiterInstance } from '../rate-limiter/rate-limiter';
import { CircuitBreakerConfig, RetryConfig, BulkheadConfig, RateLimiterConfig } from '../types';

// Metadata keys
const FALLBACK_KEY = Symbol('resilience:fallback');

/**
 * @CircuitBreaker decorator
 * Wraps a method with circuit breaker protection.
 */
export function CircuitBreaker(config?: Partial<CircuitBreakerConfig>): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const breakerName = `${target.constructor.name}.${String(propertyKey)}`;

    descriptor.value = async function (
      this: Record<string, unknown>,
      ...args: unknown[]
    ): Promise<unknown> {
      const breaker = CircuitBreakerRegistry.getOrCreate(breakerName, config);

      try {
        return await breaker.execute(() => originalMethod.apply(this, args));
      } catch (error) {
        // If there's a fallback configured, try it
        if (config?.fallback) {
          const fallbackMethod = (this as Record<string, (...a: unknown[]) => unknown>)[
            config.fallback
          ];
          if (typeof fallbackMethod === 'function') {
            return fallbackMethod.apply(this, args);
          }
        }

        // Check for decorator-based fallback
        const fallbackName = Reflect.getMetadata(FALLBACK_KEY, target, propertyKey);
        if (fallbackName) {
          const fallbackMethod = (this as Record<string, (...a: unknown[]) => unknown>)[
            fallbackName
          ];
          if (typeof fallbackMethod === 'function') {
            return fallbackMethod.apply(this, args);
          }
        }

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * @Retry decorator
 * Wraps a method with retry logic.
 */
export function Retry(config?: Partial<RetryConfig>): MethodDecorator {
  return function (_target: object, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const retryPolicy = new RetryPolicy(config);

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      return retryPolicy.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * @Timeout decorator
 * Wraps a method with a timeout.
 */
export function Timeout(
  durationOrConfig: number | { duration: number; message?: string }
): MethodDecorator {
  return function (_target: object, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const timeout = new TimeoutInstance(
      typeof durationOrConfig === 'number' ? durationOrConfig : durationOrConfig
    );

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      return timeout.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * @Bulkhead decorator
 * Limits concurrent executions of a method.
 */
export function Bulkhead(config: BulkheadConfig): MethodDecorator {
  return function (_target: object, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const bulkhead = new BulkheadInstance(config);

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      return bulkhead.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * @Fallback decorator
 * Marks a method as the fallback for a specified primary method.
 *
 * Usage:
 *   @Fallback('processPayment')
 *   async processPaymentFallback(...) { }
 */
export function Fallback(primaryMethodName: string): MethodDecorator {
  return function (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    // Store the fallback mapping on the primary method
    Reflect.defineMetadata(FALLBACK_KEY, String(propertyKey), target, primaryMethodName);
    return descriptor;
  };
}

/**
 * @RateLimit decorator
 * Rate limits a method.
 */
export function RateLimit(config: RateLimiterConfig): MethodDecorator {
  return function (_target: object, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const limiter = new RateLimiterInstance(config);

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      return limiter.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
