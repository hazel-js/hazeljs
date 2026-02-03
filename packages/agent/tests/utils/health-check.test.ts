import { HealthChecker, HealthStatus } from '../../src/utils/health-check';
import { LLMProvider } from '../../src/types/llm.types';
import { RAGService } from '../../src/types/rag.types';

describe('HealthChecker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('check', () => {
    it('should return healthy status when all components are healthy', async () => {
      const checker = new HealthChecker();
      const llmProvider: LLMProvider = {
        isAvailable: jest.fn().mockResolvedValue(true),
      } as unknown as LLMProvider;
      const ragService: RAGService = {
        isAvailable: jest.fn().mockResolvedValue(true),
      } as unknown as RAGService;

      const result = await checker.check(llmProvider, ragService);

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.components.llmProvider?.status).toBe(HealthStatus.HEALTHY);
      expect(result.components.ragService?.status).toBe(HealthStatus.HEALTHY);
      expect(result.components.memory?.status).toBe(HealthStatus.HEALTHY);
    });

    it('should return unhealthy when LLM provider fails', async () => {
      const checker = new HealthChecker();
      const llmProvider: LLMProvider = {
        isAvailable: jest.fn().mockResolvedValue(false),
      } as unknown as LLMProvider;

      const result = await checker.check(llmProvider);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.components.llmProvider?.status).toBe(HealthStatus.UNHEALTHY);
    });

    it('should return unhealthy when RAG service fails', async () => {
      const checker = new HealthChecker();
      const ragService: RAGService = {
        isAvailable: jest.fn().mockResolvedValue(false),
      } as unknown as RAGService;

      const result = await checker.check(undefined, ragService);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.components.ragService?.status).toBe(HealthStatus.UNHEALTHY);
    });

    it('should return degraded when one component is degraded', async () => {
      const checker = new HealthChecker();
      const llmProvider: LLMProvider = {
        isAvailable: jest.fn().mockResolvedValue(true),
      } as unknown as LLMProvider;
      const ragService: LLMProvider = {
        isAvailable: jest.fn().mockResolvedValue(false),
      } as unknown as LLMProvider;

      const result = await checker.check(llmProvider, ragService as unknown as RAGService);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
    });

    it('should handle LLM provider without isAvailable method', async () => {
      const checker = new HealthChecker();
      const llmProvider = {} as LLMProvider;

      const result = await checker.check(llmProvider);

      expect(result.components.llmProvider?.status).toBe(HealthStatus.HEALTHY);
    });

    it('should handle RAG service without isAvailable method', async () => {
      const checker = new HealthChecker();
      const ragService = {} as RAGService;

      const result = await checker.check(undefined, ragService);

      expect(result.components.ragService?.status).toBe(HealthStatus.HEALTHY);
    });

    it('should handle timeout', async () => {
      const checker = new HealthChecker({ timeoutMs: 100 });
      const llmProvider: LLMProvider = {
        isAvailable: jest.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve(true), 200))
        ),
      } as unknown as LLMProvider;

      const promise = checker.check(llmProvider);
      jest.advanceTimersByTime(200);
      const result = await promise;

      expect(result.components.llmProvider?.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.components.llmProvider?.message).toContain('timeout');
    });

    it('should handle errors in health check', async () => {
      const checker = new HealthChecker();
      const llmProvider: LLMProvider = {
        isAvailable: jest.fn().mockRejectedValue(new Error('Connection failed')),
      } as unknown as LLMProvider;

      const result = await checker.check(llmProvider);

      expect(result.components.llmProvider?.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.components.llmProvider?.message).toContain('Connection failed');
    });

    it('should include metrics in result', async () => {
      const checker = new HealthChecker();
      const metrics = {
        totalExecutions: 100,
        successRate: 0.95,
        averageLatency: 150,
      };

      const result = await checker.check(undefined, undefined, metrics);

      expect(result.metrics).toEqual(metrics);
    });

    it('should include uptime in result', async () => {
      const checker = new HealthChecker();
      jest.advanceTimersByTime(5000);

      const result = await checker.check();

      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should include timestamp in result', async () => {
      const checker = new HealthChecker();
      const before = Date.now();

      const result = await checker.check();

      expect(result.timestamp).toBeGreaterThanOrEqual(before);
    });

    it('should measure latency for components', async () => {
      const checker = new HealthChecker();
      const llmProvider: LLMProvider = {
        isAvailable: jest.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve(true), 50))
        ),
      } as unknown as LLMProvider;

      const promise = checker.check(llmProvider);
      jest.advanceTimersByTime(100);
      const result = await promise;

      expect(result.components.llmProvider?.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getLastCheck', () => {
    it('should return undefined before first check', () => {
      const checker = new HealthChecker();
      expect(checker.getLastCheck()).toBeUndefined();
    });

    it('should return last check result', async () => {
      const checker = new HealthChecker();
      const result = await checker.check();

      expect(checker.getLastCheck()).toEqual(result);
    });
  });

  describe('getUptime', () => {
    it('should return uptime in seconds', () => {
      const checker = new HealthChecker();
      jest.advanceTimersByTime(5000);

      const uptime = checker.getUptime();

      expect(uptime).toBeGreaterThanOrEqual(5);
    });
  });

  describe('formatResult', () => {
    it('should format health check result as string', async () => {
      const checker = new HealthChecker();
      const llmProvider: LLMProvider = {
        isAvailable: jest.fn().mockResolvedValue(true),
      } as unknown as LLMProvider;
      const result = await checker.check(llmProvider);

      const formatted = checker.formatResult(result);

      expect(formatted).toContain('Health Check Report');
      expect(formatted).toContain('Status:');
      expect(formatted).toContain('Components:');
      expect(formatted).toContain('llmProvider');
    });

    it('should include metrics in formatted result', async () => {
      const checker = new HealthChecker();
      const metrics = {
        totalExecutions: 100,
        successRate: 0.95,
        averageLatency: 150,
      };
      const result = await checker.check(undefined, undefined, metrics);

      const formatted = checker.formatResult(result);

      expect(formatted).toContain('Metrics:');
      expect(formatted).toContain('Total Executions: 100');
      expect(formatted).toContain('Success Rate: 95.00%');
    });
  });

  describe('determineOverallStatus', () => {
    it('should return HEALTHY when all components are healthy', async () => {
      const checker = new HealthChecker();
      const llmProvider: LLMProvider = {
        isAvailable: jest.fn().mockResolvedValue(true),
      } as unknown as LLMProvider;
      const ragService: RAGService = {
        isAvailable: jest.fn().mockResolvedValue(true),
      } as unknown as RAGService;

      const result = await checker.check(llmProvider, ragService);

      expect(result.status).toBe(HealthStatus.HEALTHY);
    });

    it('should return UNHEALTHY when any component is unhealthy', async () => {
      const checker = new HealthChecker();
      const llmProvider: LLMProvider = {
        isAvailable: jest.fn().mockResolvedValue(false),
      } as unknown as LLMProvider;

      const result = await checker.check(llmProvider);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
    });
  });
});

