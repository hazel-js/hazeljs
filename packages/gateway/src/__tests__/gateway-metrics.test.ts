import { GatewayMetrics } from '../metrics/gateway-metrics';

describe('GatewayMetrics', () => {
  let metrics: GatewayMetrics;

  beforeEach(() => {
    metrics = new GatewayMetrics(60_000);
  });

  describe('recordSuccess / recordFailure', () => {
    it('should record success for a route', () => {
      metrics.recordSuccess('/api/users', 50);
      metrics.recordSuccess('/api/users', 100);

      const snapshot = metrics.getRouteMetrics('/api/users');
      expect(snapshot).toBeDefined();
      expect(snapshot!.totalCalls).toBe(2);
      expect(snapshot!.successCalls).toBe(2);
      expect(snapshot!.failureCalls).toBe(0);
    });

    it('should record failure for a route', () => {
      metrics.recordFailure('/api/orders', 30, 'Timeout');
      metrics.recordFailure('/api/orders', 50, '502');

      const snapshot = metrics.getRouteMetrics('/api/orders');
      expect(snapshot).toBeDefined();
      expect(snapshot!.totalCalls).toBe(2);
      expect(snapshot!.failureCalls).toBe(2);
    });

    it('should record success with version', () => {
      metrics.recordSuccess('/api/users', 50, 'v1');
      metrics.recordSuccess('/api/users', 80, 'v2');

      const v1 = metrics.getVersionMetrics('/api/users', 'v1');
      const v2 = metrics.getVersionMetrics('/api/users', 'v2');
      expect(v1?.successCalls).toBe(1);
      expect(v2?.successCalls).toBe(1);
    });

    it('should record failure with version', () => {
      metrics.recordFailure('/api/users', 100, 'Error', 'v1');
      const v1 = metrics.getVersionMetrics('/api/users', 'v1');
      expect(v1?.failureCalls).toBe(1);
    });
  });

  describe('getVersionErrorRate', () => {
    it('should return 0 for non-existent version', () => {
      expect(metrics.getVersionErrorRate('/api/x', 'v1')).toBe(0);
    });

    it('should return error rate for version with failures', () => {
      metrics.recordSuccess('/api/x', 10, 'v1');
      metrics.recordFailure('/api/x', 10, 'err', 'v1');
      const rate = metrics.getVersionErrorRate('/api/x', 'v1');
      expect(rate).toBe(50);
    });
  });

  describe('getSnapshot', () => {
    it('should return full snapshot with aggregated metrics', () => {
      metrics.recordSuccess('/a', 50);
      metrics.recordSuccess('/b', 100);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.totalRoutes).toBe(2);
      expect(snapshot.routes).toHaveLength(2);
      expect(snapshot.aggregated.totalCalls).toBe(2);
      expect(snapshot.aggregated.successCalls).toBe(2);
    });

    it('should return empty aggregated when no routes', () => {
      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalRoutes).toBe(0);
      expect(snapshot.routes).toHaveLength(0);
      expect(snapshot.aggregated.totalCalls).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset all metrics to zero', () => {
      metrics.recordSuccess('/a', 50);
      metrics.recordSuccess('/a', 100, 'v1');
      metrics.reset();

      const routeSnapshot = metrics.getRouteMetrics('/a');
      const versionSnapshot = metrics.getVersionMetrics('/a', 'v1');
      expect(routeSnapshot?.totalCalls).toBe(0);
      expect(routeSnapshot?.successCalls).toBe(0);
      expect(versionSnapshot?.totalCalls).toBe(0);
    });
  });
});
