import { InspectorRuntime } from '../runtime/inspector-runtime';

describe('InspectorRuntime', () => {
  beforeEach(() => {
    InspectorRuntime.reset();
  });

  describe('registerGateway / getGateway', () => {
    it('registers and returns gateway', () => {
      const gw = { getRoutes: () => ['/a', '/b'] };
      InspectorRuntime.registerGateway(gw);
      expect(InspectorRuntime.getGateway()).toBe(gw);
    });
  });

  describe('registerDiscovery / getDiscovery', () => {
    it('registers and returns discovery client', () => {
      const disc = {
        getAllServices: async () => ['svc1'],
        getInstances: async () => [],
      };
      InspectorRuntime.registerDiscovery(disc);
      expect(InspectorRuntime.getDiscovery()).toBe(disc);
    });
  });

  describe('getGatewayOverview', () => {
    it('returns null when no gateway', async () => {
      expect(await InspectorRuntime.getGatewayOverview()).toBeNull();
    });

    it('returns overview with routes when gateway has getRoutes', async () => {
      InspectorRuntime.registerGateway({
        getRoutes: () => ['/health', '/api'],
      });
      const overview = await InspectorRuntime.getGatewayOverview();
      expect(overview).not.toBeNull();
      expect(overview!.routes).toEqual(['/health', '/api']);
      expect(overview!.totalRoutes).toBe(2);
    });

    it('includes metrics when gateway has getMetrics', async () => {
      InspectorRuntime.registerGateway({
        getRoutes: () => ['/a'],
        getMetrics: () => ({
          getSnapshot: () => ({
            aggregated: {
              totalCalls: 100,
              successCalls: 95,
              failureCalls: 5,
              failureRate: 0.05,
              averageResponseTime: 50,
            },
          }),
        }),
      });
      const overview = await InspectorRuntime.getGatewayOverview();
      expect(overview!.metrics).toEqual({
        totalCalls: 100,
        successCalls: 95,
        failureCalls: 5,
        failureRate: 0.05,
        averageResponseTime: 50,
      });
    });

    it('returns null when getRoutes throws', async () => {
      InspectorRuntime.registerGateway({
        getRoutes: () => {
          throw new Error('fail');
        },
      });
      expect(await InspectorRuntime.getGatewayOverview()).toBeNull();
    });
  });

  describe('getDiscoveryOverview', () => {
    it('returns null when no discovery', async () => {
      expect(await InspectorRuntime.getDiscoveryOverview()).toBeNull();
    });

    it('returns overview with services and instances', async () => {
      InspectorRuntime.registerDiscovery({
        getAllServices: async () => ['user', 'order'],
        getInstances: async (svc) => (svc === 'user' ? [{ id: 1 }] : [{ id: 1 }, { id: 2 }]),
      });
      const overview = await InspectorRuntime.getDiscoveryOverview();
      expect(overview).not.toBeNull();
      expect(overview!.services).toEqual(['user', 'order']);
      expect(overview!.totalServices).toBe(2);
      expect(overview!.totalInstances).toBe(3);
      expect(overview!.instancesByService).toEqual({ user: 1, order: 2 });
    });

    it('returns null when getAllServices throws', async () => {
      InspectorRuntime.registerDiscovery({
        getAllServices: async () => {
          throw new Error('fail');
        },
        getInstances: async () => [],
      });
      expect(await InspectorRuntime.getDiscoveryOverview()).toBeNull();
    });
  });

  describe('getResilienceOverview', () => {
    it('returns overview with circuitBreakers and circuitBreakerStates', async () => {
      const overview = await InspectorRuntime.getResilienceOverview();
      expect(overview).toBeDefined();
      expect(overview).toHaveProperty('circuitBreakers');
      expect(overview).toHaveProperty('circuitBreakerStates');
      expect(Array.isArray(overview!.circuitBreakerStates)).toBe(true);
    });
  });
});
