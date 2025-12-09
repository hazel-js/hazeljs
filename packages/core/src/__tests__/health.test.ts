import { HealthCheckManager, BuiltInHealthChecks, HealthCheck } from '../health';

describe('HealthCheckManager', () => {
  let healthManager: HealthCheckManager;

  beforeEach(() => {
    healthManager = new HealthCheckManager();
  });

  describe('registerCheck', () => {
    it('should register a health check', () => {
      const check: HealthCheck = {
        name: 'test-check',
        check: async () => ({ status: 'healthy' }),
      };

      healthManager.registerCheck(check);
      expect(healthManager).toBeDefined();
    });
  });

  describe('runChecks', () => {
    it('should return healthy status when all checks pass', async () => {
      healthManager.registerCheck({
        name: 'check-1',
        check: async () => ({ status: 'healthy' }),
      });

      healthManager.registerCheck({
        name: 'check-2',
        check: async () => ({ status: 'healthy' }),
      });

      const result = await healthManager.runChecks();

      expect(result.status).toBe('healthy');
      expect(result.checks['check-1'].status).toBe('healthy');
      expect(result.checks['check-2'].status).toBe('healthy');
    });

    it('should return degraded status when non-critical check fails', async () => {
      healthManager.registerCheck({
        name: 'critical-check',
        check: async () => ({ status: 'healthy' }),
        critical: true,
      });

      healthManager.registerCheck({
        name: 'non-critical-check',
        check: async () => ({ status: 'degraded' }),
        critical: false,
      });

      const result = await healthManager.runChecks();

      expect(result.status).toBe('degraded');
    });

    it('should return unhealthy status when critical check fails', async () => {
      healthManager.registerCheck({
        name: 'critical-check',
        check: async () => ({ status: 'unhealthy' }),
        critical: true,
      });

      const result = await healthManager.runChecks();

      expect(result.status).toBe('unhealthy');
    });

    it('should handle check timeouts', async () => {
      healthManager.registerCheck({
        name: 'slow-check',
        check: async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return { status: 'healthy' };
        },
        timeout: 50,
      });

      const result = await healthManager.runChecks();

      expect(result.checks['slow-check'].status).toBe('unhealthy');
    });

    it('should include response time in results', async () => {
      healthManager.registerCheck({
        name: 'fast-check',
        check: async () => ({ status: 'healthy' }),
      });

      const result = await healthManager.runChecks();

      expect(result.checks['fast-check'].responseTime).toBeDefined();
      expect(typeof result.checks['fast-check'].responseTime).toBe('number');
    });

    it('should include timestamp and uptime', async () => {
      const result = await healthManager.runChecks();

      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeDefined();
      expect(typeof result.uptime).toBe('number');
    });
  });

  describe('getLiveness', () => {
    it('should return alive status', async () => {
      const result = await healthManager.getLiveness();

      expect(result.status).toBe('alive');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('getReadiness', () => {
    it('should run all checks', async () => {
      healthManager.registerCheck({
        name: 'test-check',
        check: async () => ({ status: 'healthy' }),
      });

      const result = await healthManager.getReadiness();

      expect(result.checks['test-check']).toBeDefined();
    });
  });

  describe('getStartup', () => {
    it('should return startup status', async () => {
      const result = await healthManager.getStartup();

      expect(result.status).toBe('started');
      expect(result.uptime).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });
  });
});

describe('BuiltInHealthChecks', () => {
  describe('memoryCheck', () => {
    it('should return healthy when memory usage is below threshold', async () => {
      const check = BuiltInHealthChecks.memoryCheck(10000); // 10GB threshold
      const result = await check.check();

      expect(result.status).toBe('healthy');
      expect(result.details).toBeDefined();
    });

    it('should return degraded when memory usage is above threshold', async () => {
      const check = BuiltInHealthChecks.memoryCheck(1); // 1MB threshold (very low)
      const result = await check.check();

      expect(result.status).toBe('degraded');
      expect(result.message).toContain('High memory usage');
    });

    it('should include memory details', async () => {
      const check = BuiltInHealthChecks.memoryCheck();
      const result = await check.check();

      expect(result.details).toBeDefined();
      expect(result.details?.heapUsed).toBeDefined();
      expect(result.details?.heapTotal).toBeDefined();
    });
  });

  describe('eventLoopCheck', () => {
    it('should return healthy when event loop lag is low', async () => {
      const check = BuiltInHealthChecks.eventLoopCheck(1000); // 1 second threshold
      const result = await check.check();

      expect(result.status).toBe('healthy');
      expect(result.details).toBeDefined();
    });

    it('should include lag details', async () => {
      const check = BuiltInHealthChecks.eventLoopCheck();
      const result = await check.check();

      expect(result.details).toBeDefined();
      expect(result.details?.lag).toBeDefined();
    });
  });
});
