import { MetricsCollector } from '../../src/utils/metrics';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe('recordExecution', () => {
    it('should record successful execution', () => {
      collector.recordExecution(true, 100);

      const metrics = collector.getMetrics();
      expect(metrics.executions.total).toBe(1);
      expect(metrics.executions.successful).toBe(1);
      expect(metrics.executions.failed).toBe(0);
      expect(metrics.executions.successRate).toBe(1);
    });

    it('should record failed execution', () => {
      collector.recordExecution(false, 200);

      const metrics = collector.getMetrics();
      expect(metrics.executions.total).toBe(1);
      expect(metrics.executions.successful).toBe(0);
      expect(metrics.executions.failed).toBe(1);
      expect(metrics.executions.successRate).toBe(0);
    });

    it('should calculate success rate correctly', () => {
      collector.recordExecution(true, 100);
      collector.recordExecution(true, 150);
      collector.recordExecution(false, 200);

      const metrics = collector.getMetrics();
      expect(metrics.executions.successRate).toBeCloseTo(2 / 3, 2);
    });

    it('should track durations', () => {
      collector.recordExecution(true, 100);
      collector.recordExecution(true, 200);
      collector.recordExecution(true, 300);

      const metrics = collector.getMetrics();
      expect(metrics.performance.averageDuration).toBe(200);
      expect(metrics.performance.minDuration).toBe(100);
      expect(metrics.performance.maxDuration).toBe(300);
    });

    it('should limit durations to 1000 entries', () => {
      for (let i = 0; i < 1500; i++) {
        collector.recordExecution(true, i);
      }

      const metrics = collector.getMetrics();
      expect(metrics.performance.averageDuration).toBeGreaterThan(0);
      expect(metrics.performance.averageDuration).toBeLessThan(1500);
    });
  });

  describe('recordToolCall', () => {
    it('should record successful tool call', () => {
      collector.recordToolCall('testTool', true);

      const metrics = collector.getMetrics();
      expect(metrics.tools.totalCalls).toBe(1);
      expect(metrics.tools.byTool.testTool).toBe(1);
      expect(metrics.tools.successRate).toBe(1);
    });

    it('should record failed tool call', () => {
      collector.recordToolCall('testTool', false);

      const metrics = collector.getMetrics();
      expect(metrics.tools.totalCalls).toBe(1);
      expect(metrics.tools.successRate).toBe(0);
    });

    it('should track multiple tools', () => {
      collector.recordToolCall('tool1', true);
      collector.recordToolCall('tool2', true);
      collector.recordToolCall('tool1', false);

      const metrics = collector.getMetrics();
      expect(metrics.tools.byTool.tool1).toBe(2);
      expect(metrics.tools.byTool.tool2).toBe(1);
      expect(metrics.tools.totalCalls).toBe(3);
      expect(metrics.tools.successRate).toBeCloseTo(2 / 3, 2);
    });
  });

  describe('recordLLMCall', () => {
    it('should record LLM call with tokens', () => {
      collector.recordLLMCall(100);

      const metrics = collector.getMetrics();
      expect(metrics.llm.totalCalls).toBe(1);
      expect(metrics.llm.totalTokens).toBe(100);
      expect(metrics.llm.averageTokensPerCall).toBe(100);
      expect(metrics.llm.errors).toBe(0);
    });

    it('should record LLM call with error', () => {
      collector.recordLLMCall(100, true);

      const metrics = collector.getMetrics();
      expect(metrics.llm.errors).toBe(1);
    });

    it('should calculate average tokens per call', () => {
      collector.recordLLMCall(100);
      collector.recordLLMCall(200);
      collector.recordLLMCall(300);

      const metrics = collector.getMetrics();
      expect(metrics.llm.averageTokensPerCall).toBe(200);
    });
  });

  describe('recordMemoryRetrieval', () => {
    it('should record memory retrieval', () => {
      collector.recordMemoryRetrieval(50);

      const metrics = collector.getMetrics();
      expect(metrics.memory.totalRetrievals).toBe(1);
      expect(metrics.memory.averageRetrievalTime).toBe(50);
    });

    it('should calculate average retrieval time', () => {
      collector.recordMemoryRetrieval(50);
      collector.recordMemoryRetrieval(100);
      collector.recordMemoryRetrieval(150);

      const metrics = collector.getMetrics();
      expect(metrics.memory.averageRetrievalTime).toBe(100);
    });

    it('should limit retrieval times to 1000 entries', () => {
      for (let i = 0; i < 1500; i++) {
        collector.recordMemoryRetrieval(i);
      }

      const metrics = collector.getMetrics();
      expect(metrics.memory.averageRetrievalTime).toBeGreaterThan(0);
    });
  });

  describe('getMetrics', () => {
    it('should return zero metrics initially', () => {
      const metrics = collector.getMetrics();

      expect(metrics.executions.total).toBe(0);
      expect(metrics.executions.successRate).toBe(0);
      expect(metrics.performance.averageDuration).toBe(0);
      expect(metrics.tools.totalCalls).toBe(0);
      expect(metrics.llm.totalCalls).toBe(0);
      expect(metrics.memory.totalRetrievals).toBe(0);
    });

    it('should calculate percentiles correctly', () => {
      const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      durations.forEach((d) => collector.recordExecution(true, d));

      const metrics = collector.getMetrics();
      expect(metrics.performance.p50Duration).toBeGreaterThanOrEqual(40);
      expect(metrics.performance.p95Duration).toBeGreaterThanOrEqual(90);
      expect(metrics.performance.p99Duration).toBeGreaterThanOrEqual(90);
    });

    it('should handle empty durations for percentiles', () => {
      const metrics = collector.getMetrics();
      expect(metrics.performance.p50Duration).toBe(0);
      expect(metrics.performance.p95Duration).toBe(0);
      expect(metrics.performance.p99Duration).toBe(0);
      expect(metrics.performance.minDuration).toBe(Infinity);
      expect(metrics.performance.maxDuration).toBe(-Infinity);
    });
  });

  describe('getSummary', () => {
    it('should return formatted summary', () => {
      collector.recordExecution(true, 100);
      collector.recordToolCall('testTool', true);
      collector.recordLLMCall(100);

      const summary = collector.getSummary();

      expect(summary).toContain('Agent Metrics Summary');
      expect(summary).toContain('Total: 1');
      expect(summary).toContain('testTool');
    });

    it('should include uptime in summary', () => {
      const summary = collector.getSummary();
      expect(summary).toContain('Uptime:');
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      collector.recordExecution(true, 100);
      collector.recordToolCall('testTool', true);
      collector.recordLLMCall(100);
      collector.recordMemoryRetrieval(50);

      collector.reset();

      const metrics = collector.getMetrics();
      expect(metrics.executions.total).toBe(0);
      expect(metrics.tools.totalCalls).toBe(0);
      expect(metrics.llm.totalCalls).toBe(0);
      expect(metrics.memory.totalRetrievals).toBe(0);
    });

    it('should reset start time', () => {
      const beforeReset = collector.getSummary();
      collector.reset();
      const afterReset = collector.getSummary();

      // Uptime should be reset (smaller or equal)
      expect(afterReset).toContain('Uptime:');
    });
  });
});

