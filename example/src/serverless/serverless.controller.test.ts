import { Test } from '@hazeljs/core';
import { ServerlessController } from './serverless.controller';
import { ServerlessService } from './serverless.service';

describe('ServerlessController', () => {
  let controller: ServerlessController;
  let service: ServerlessService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ServerlessController],
      providers: [ServerlessService],
    }).compile();

    controller = module.get(ServerlessController);
    service = module.get(ServerlessService);

    // Reset service state
    service.reset();
  });

  describe('hello', () => {
    it('should return hello message', async () => {
      const result = await controller.hello();

      expect(result).toBeDefined();
      expect(result.message).toBe('Hello from HazelJS Serverless!');
      expect(result.timestamp).toBeDefined();
      expect(result.coldStart).toBe(true);
    });

    it('should detect cold start on first request', async () => {
      const result1 = await controller.hello();
      expect(result1.coldStart).toBe(true);

      const result2 = await controller.hello();
      expect(result2.coldStart).toBe(false);
    });
  });

  describe('optimized', () => {
    it('should return optimized endpoint response', async () => {
      const result = await controller.optimized();

      expect(result).toBeDefined();
      expect(result.message).toBe('Optimized serverless endpoint');
      expect(result.stats).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should include stats in response', async () => {
      const result = await controller.optimized();

      expect(result.stats.requestCount).toBeGreaterThan(0);
      expect(result.stats.uptime).toBeGreaterThanOrEqual(0);
      expect(result.stats.isWarm).toBeDefined();
    });
  });

  describe('processData', () => {
    it('should process data successfully', async () => {
      const inputData = { test: 'data', value: 123 };
      const result = await controller.processData(inputData);

      expect(result).toBeDefined();
      expect(result.message).toBe('Data processed successfully');
      expect(result.result).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should return processed data with input', async () => {
      const inputData = { name: 'test' };
      const result = await controller.processData(inputData);

      expect(result.result.processed).toBe(true);
      expect(result.result.input).toEqual(inputData);
      expect(result.result.processedAt).toBeDefined();
    });

    it('should increment request count', async () => {
      await controller.processData({ test: 1 });
      await controller.processData({ test: 2 });

      const metrics = await controller.getMetrics();
      expect(metrics.metrics.totalRequests).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics', async () => {
      const result = await controller.getMetrics();

      expect(result).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should include all metric fields', async () => {
      const result = await controller.getMetrics();

      expect(result.metrics.totalRequests).toBeDefined();
      expect(result.metrics.uptimeMs).toBeGreaterThanOrEqual(0);
      expect(result.metrics.averageRequestTime).toBeGreaterThanOrEqual(0);
      expect(result.metrics.memoryUsage).toBeDefined();
      expect(result.metrics.isWarm).toBeDefined();
    });

    it('should track request count', async () => {
      // Create a fresh service instance to ensure clean state
      const freshService = new ServerlessService();
      const freshController = new ServerlessController(freshService);

      // Make requests that increment the count
      await freshController.processData({ test: 1 });
      await freshController.processData({ test: 2 });

      // Check the count
      const result = await freshController.getMetrics();
      expect(result.metrics.totalRequests).toBeGreaterThanOrEqual(2);
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const result = await controller.healthCheck();

      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      expect(['healthy', 'unhealthy']).toContain(result.status);
      expect(result.timestamp).toBeDefined();
    });

    it('should include health details', async () => {
      const result = await controller.healthCheck();

      expect(result.healthy).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.requestCount).toBeGreaterThanOrEqual(0);
      expect(result.memoryUsage).toBeDefined();
      expect(result.isWarm).toBeDefined();
    });

    it('should report status based on memory usage', async () => {
      const result = await controller.healthCheck();

      // Status should be either healthy or unhealthy
      expect(['healthy', 'unhealthy']).toContain(result.status);
      expect(typeof result.healthy).toBe('boolean');

      // If healthy, status should match
      if (result.healthy) {
        expect(result.status).toBe('healthy');
      } else {
        expect(result.status).toBe('unhealthy');
      }
    });

    it('should include memory usage details', async () => {
      const result = await controller.healthCheck();

      expect(result.memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(result.memoryUsage.heapTotal).toBeGreaterThan(0);
      expect(result.memoryUsage.heapUsedPercent).toBeGreaterThanOrEqual(0);
      expect(result.memoryUsage.heapUsedPercent).toBeLessThanOrEqual(100);
    });
  });
});

describe('ServerlessService', () => {
  let service: ServerlessService;

  beforeEach(() => {
    service = new ServerlessService();
    service.reset();
  });

  describe('isColdStart', () => {
    it('should return true on first call', () => {
      expect(service.isColdStart()).toBe(true);
    });

    it('should return false on subsequent calls', () => {
      service.isColdStart();
      expect(service.isColdStart()).toBe(false);
      expect(service.isColdStart()).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      const stats = service.getStats();

      expect(stats).toBeDefined();
      expect(stats.requestCount).toBe(1);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
      expect(stats.isWarm).toBeDefined();
    });

    it('should increment request count', () => {
      service.getStats();
      service.getStats();
      const stats = service.getStats();

      expect(stats.requestCount).toBe(3);
    });
  });

  describe('processData', () => {
    it('should process data', async () => {
      const input = { test: 'value' };
      const result = await service.processData(input);

      expect(result).toBeDefined();
      expect(result.processed).toBe(true);
      expect(result.input).toEqual(input);
      expect(result.processedAt).toBeDefined();
      expect(result.requestNumber).toBe(1);
    });

    it('should track request numbers', async () => {
      await service.processData({ a: 1 });
      await service.processData({ b: 2 });
      const result = await service.processData({ c: 3 });

      expect(result.requestNumber).toBe(3);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics', () => {
      const metrics = service.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.totalRequests).toBeDefined();
      expect(metrics.uptimeMs).toBeGreaterThanOrEqual(0);
      expect(metrics.averageRequestTime).toBeGreaterThanOrEqual(0);
      expect(metrics.memoryUsage).toBeDefined();
    });
  });

  describe('checkHealth', () => {
    it('should return health status', () => {
      const health = service.checkHealth();

      expect(health).toBeDefined();
      expect(typeof health.healthy).toBe('boolean');
      expect(health.uptime).toBeGreaterThanOrEqual(0);
      expect(health.requestCount).toBeGreaterThanOrEqual(0);
      expect(health.memoryUsage).toBeDefined();
      expect(health.memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(health.memoryUsage.heapTotal).toBeGreaterThan(0);
      expect(health.memoryUsage.heapUsedPercent).toBeGreaterThanOrEqual(0);
    });
  });

  describe('reset', () => {
    it('should reset statistics', () => {
      service.getStats();
      service.getStats();

      service.reset();

      expect(service.isColdStart()).toBe(true);
      const stats = service.getStats();
      expect(stats.requestCount).toBe(1);
    });
  });
});
