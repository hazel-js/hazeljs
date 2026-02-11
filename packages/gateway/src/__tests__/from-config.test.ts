import { GatewayServer } from '../gateway';
import { GatewayFullConfig } from '../types';

describe('GatewayServer.fromConfig', () => {
  const config: GatewayFullConfig = {
    discovery: { cacheEnabled: false },
    resilience: {
      defaultTimeout: 5000,
      defaultCircuitBreaker: { failureThreshold: 5, resetTimeout: 30000 },
    },
    routes: [
      {
        path: '/api/users/**',
        serviceName: 'user-service',
        serviceConfig: {
          serviceName: 'user-service',
          stripPrefix: '/api/users',
          addPrefix: '/users',
        },
        circuitBreaker: { failureThreshold: 10 },
        rateLimit: { strategy: 'sliding-window' as const, max: 100, window: 60000 },
      },
      {
        path: '/api/orders/**',
        serviceName: 'order-service',
        canary: {
          stable: { version: 'v1', weight: 90 },
          canary: { version: 'v2', weight: 10 },
          promotion: {
            strategy: 'error-rate',
            errorThreshold: 5,
            evaluationWindow: '5m',
            autoPromote: true,
            autoRollback: true,
            steps: [10, 25, 50, 75, 100],
            stepInterval: '10m',
          },
        },
      },
    ],
  };

  it('should create a gateway with all routes from config', () => {
    const gateway = GatewayServer.fromConfig(config);

    const routes = gateway.getRoutes();
    expect(routes).toContain('/api/users/**');
    expect(routes).toContain('/api/orders/**');
    expect(routes).toHaveLength(2);
  });

  it('should set up canary engine for routes with canary config', () => {
    const gateway = GatewayServer.fromConfig(config);

    const canaryEngine = gateway.getCanaryEngine('/api/orders/**');
    expect(canaryEngine).toBeDefined();

    // No canary for users route
    const noCanary = gateway.getCanaryEngine('/api/users/**');
    expect(noCanary).toBeUndefined();
  });

  it('should create a working gateway with empty routes', () => {
    const emptyConfig: GatewayFullConfig = {
      routes: [],
    };

    const gateway = GatewayServer.fromConfig(emptyConfig);
    expect(gateway.getRoutes()).toHaveLength(0);
  });

  afterEach(() => {
    // Clean up to avoid state leaks between tests
  });
});
