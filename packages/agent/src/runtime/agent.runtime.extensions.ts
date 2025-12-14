/**
 * Agent Runtime Extensions
 * Additional methods for health checks, metrics, and monitoring
 */

import { AgentRuntime } from './agent.runtime';
import { HealthCheckResult } from '../utils/health-check';
import { AgentMetrics } from '../utils/metrics';

/**
 * Extended methods for AgentRuntime
 */
export class AgentRuntimeExtensions {
  /**
   * Get health check status
   */
  static async getHealthCheck(runtime: AgentRuntime): Promise<HealthCheckResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const healthChecker = (runtime as any).healthChecker;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metrics = (runtime as any).metrics;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = (runtime as any).config;

    const metricsData = metrics
      ? {
          totalExecutions: metrics.getMetrics().executions.total,
          successRate: metrics.getMetrics().executions.successRate,
          averageLatency: metrics.getMetrics().performance.averageDuration,
        }
      : undefined;

    return healthChecker.check(config.llmProvider, config.ragService, metricsData);
  }

  /**
   * Get metrics summary
   */
  static getMetrics(runtime: AgentRuntime): AgentMetrics | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metrics = (runtime as any).metrics;
    return metrics ? metrics.getMetrics() : null;
  }

  /**
   * Get metrics summary as string
   */
  static getMetricsSummary(runtime: AgentRuntime): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metrics = (runtime as any).metrics;
    return metrics ? metrics.getSummary() : 'Metrics not enabled';
  }

  /**
   * Reset metrics
   */
  static resetMetrics(runtime: AgentRuntime): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metrics = (runtime as any).metrics;
    if (metrics) {
      metrics.reset();
    }
  }

  /**
   * Get rate limiter status
   */
  static getRateLimiterStatus(runtime: AgentRuntime): {
    enabled: boolean;
    availableTokens?: number;
  } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rateLimiter = (runtime as any).rateLimiter;
    return {
      enabled: !!rateLimiter,
      availableTokens: rateLimiter?.getAvailableTokens(),
    };
  }

  /**
   * Get circuit breaker status
   */
  static getCircuitBreakerStatus(runtime: AgentRuntime): {
    enabled: boolean;
    state?: string;
    failureCount?: number;
    successCount?: number;
  } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const circuitBreaker = (runtime as any).circuitBreaker;
    return {
      enabled: !!circuitBreaker,
      state: circuitBreaker?.getState(),
      failureCount: circuitBreaker?.getFailureCount(),
      successCount: circuitBreaker?.getSuccessCount(),
    };
  }

  /**
   * Reset circuit breaker
   */
  static resetCircuitBreaker(runtime: AgentRuntime): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const circuitBreaker = (runtime as any).circuitBreaker;
    if (circuitBreaker) {
      circuitBreaker.reset();
    }
  }
}
