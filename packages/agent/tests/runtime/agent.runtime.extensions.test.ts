import { AgentRuntimeExtensions } from '../../src/runtime/agent.runtime.extensions';
import { AgentRuntime, AgentRuntimeConfig } from '../../src/runtime/agent.runtime';
import { LogLevel } from '../../src/utils/logger';

describe('AgentRuntimeExtensions', () => {
  let runtime: AgentRuntime;

  beforeEach(() => {
    runtime = new AgentRuntime();
  });

  describe('getHealthCheck', () => {
    it('should return health check result', async () => {
      const result = await AgentRuntimeExtensions.getHealthCheck(runtime);

      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should include metrics when enabled', async () => {
      const config: AgentRuntimeConfig = {
        enableMetrics: true,
      };
      const runtimeWithMetrics = new AgentRuntime(config);

      const result = await AgentRuntimeExtensions.getHealthCheck(runtimeWithMetrics);

      expect(result).toBeDefined();
    });
  });

  describe('getMetrics', () => {
    it('should return null when metrics not enabled', () => {
      const runtimeWithoutMetrics = new AgentRuntime({ enableMetrics: false });
      const metrics = AgentRuntimeExtensions.getMetrics(runtimeWithoutMetrics);
      expect(metrics).toBeNull();
    });

    it('should return metrics when enabled', () => {
      const config: AgentRuntimeConfig = {
        enableMetrics: true,
      };
      const runtimeWithMetrics = new AgentRuntime(config);

      const metrics = AgentRuntimeExtensions.getMetrics(runtimeWithMetrics);

      expect(metrics).toBeDefined();
      expect(metrics?.executions).toBeDefined();
      expect(metrics?.performance).toBeDefined();
    });
  });

  describe('getMetricsSummary', () => {
    it('should return default message when metrics not enabled', () => {
      const runtimeWithoutMetrics = new AgentRuntime({ enableMetrics: false });
      const summary = AgentRuntimeExtensions.getMetricsSummary(runtimeWithoutMetrics);
      expect(summary).toBe('Metrics not enabled');
    });

    it('should return metrics summary when enabled', () => {
      const config: AgentRuntimeConfig = {
        enableMetrics: true,
      };
      const runtimeWithMetrics = new AgentRuntime(config);

      const summary = AgentRuntimeExtensions.getMetricsSummary(runtimeWithMetrics);

      expect(summary).toContain('Agent Metrics Summary');
      expect(summary).toContain('Uptime:');
    });
  });

  describe('resetMetrics', () => {
    it('should reset metrics when enabled', () => {
      const config: AgentRuntimeConfig = {
        enableMetrics: true,
      };
      const runtimeWithMetrics = new AgentRuntime(config);

      // Should not throw
      expect(() => AgentRuntimeExtensions.resetMetrics(runtimeWithMetrics)).not.toThrow();
    });

    it('should not throw when metrics not enabled', () => {
      expect(() => AgentRuntimeExtensions.resetMetrics(runtime)).not.toThrow();
    });
  });

  describe('getRateLimiterStatus', () => {
    it('should return disabled status when rate limiter not configured', () => {
      const status = AgentRuntimeExtensions.getRateLimiterStatus(runtime);

      expect(status.enabled).toBe(false);
      expect(status.availableTokens).toBeUndefined();
    });

    it('should return enabled status when rate limiter configured', () => {
      const config: AgentRuntimeConfig = {
        rateLimitPerMinute: 100,
      };
      const runtimeWithLimiter = new AgentRuntime(config);

      const status = AgentRuntimeExtensions.getRateLimiterStatus(runtimeWithLimiter);

      expect(status.enabled).toBe(true);
      expect(status.availableTokens).toBeDefined();
    });
  });

  describe('getCircuitBreakerStatus', () => {
    it('should return disabled status when circuit breaker not enabled', () => {
      const runtimeWithoutBreaker = new AgentRuntime({ enableCircuitBreaker: false });
      const status = AgentRuntimeExtensions.getCircuitBreakerStatus(runtimeWithoutBreaker);

      expect(status.enabled).toBe(false);
      expect(status.state).toBeUndefined();
    });

    it('should return enabled status when circuit breaker enabled', () => {
      const config: AgentRuntimeConfig = {
        enableCircuitBreaker: true,
      };
      const runtimeWithBreaker = new AgentRuntime(config);

      const status = AgentRuntimeExtensions.getCircuitBreakerStatus(runtimeWithBreaker);

      expect(status.enabled).toBe(true);
      expect(status.state).toBeDefined();
      expect(status.failureCount).toBeDefined();
      expect(status.successCount).toBeDefined();
    });
  });

  describe('resetCircuitBreaker', () => {
    it('should reset circuit breaker when enabled', () => {
      const runtimeWithBreaker = new AgentRuntime({ enableCircuitBreaker: true });

      // Should not throw
      expect(() => AgentRuntimeExtensions.resetCircuitBreaker(runtimeWithBreaker)).not.toThrow();
    });

    it('should not throw when circuit breaker not enabled', () => {
      const runtimeWithoutBreaker = new AgentRuntime({ enableCircuitBreaker: false });
      expect(() => AgentRuntimeExtensions.resetCircuitBreaker(runtimeWithoutBreaker)).not.toThrow();
    });
  });
});

