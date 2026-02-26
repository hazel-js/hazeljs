import 'reflect-metadata';
import {
  Gateway,
  Route,
  ServiceRoute,
  Canary,
  VersionRoute,
  TrafficPolicy,
  GatewayCircuitBreaker,
  GatewayRateLimit,
  collectRouteDefinitions,
} from '../decorators';

describe('Gateway Decorators', () => {
  it('should collect gateway config from class', () => {
    @Gateway({
      discovery: { cacheEnabled: true },
      metrics: { enabled: true },
    })
    class TestGateway {}

    const { config } = collectRouteDefinitions(TestGateway);
    expect(config.discovery?.cacheEnabled).toBe(true);
    expect(config.metrics?.enabled).toBe(true);
  });

  it('should collect route definitions from properties', () => {
    @Gateway({})
    class TestGateway {
      @Route('/api/users/**')
      @ServiceRoute('user-service')
      userService: unknown;
    }

    const { routes } = collectRouteDefinitions(TestGateway);
    expect(routes).toHaveLength(1);
    expect(routes[0].route?.path).toBe('/api/users/**');
    expect(routes[0].serviceRoute?.serviceName).toBe('user-service');
  });

  it('should collect canary config', () => {
    @Gateway({})
    class TestGateway {
      @Route('/api/orders/**')
      @ServiceRoute('order-service')
      @Canary({
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
      })
      orderService: unknown;
    }

    const { routes } = collectRouteDefinitions(TestGateway);
    expect(routes[0].canary).toBeDefined();
    expect(routes[0].canary!.stable.version).toBe('v1');
    expect(routes[0].canary!.canary.version).toBe('v2');
    expect(routes[0].canary!.promotion.steps).toEqual([10, 25, 50, 75, 100]);
  });

  it('should collect version route config', () => {
    @Gateway({})
    class TestGateway {
      @Route('/api/payments/**')
      @ServiceRoute('payment-service')
      @VersionRoute({
        header: 'X-API-Version',
        routes: {
          v1: { weight: 100 },
          v2: { weight: 0, allowExplicit: true },
        },
      })
      paymentService: unknown;
    }

    const { routes } = collectRouteDefinitions(TestGateway);
    expect(routes[0].versionRoute).toBeDefined();
    expect(routes[0].versionRoute!.header).toBe('X-API-Version');
    expect(routes[0].versionRoute!.routes['v1'].weight).toBe(100);
    expect(routes[0].versionRoute!.routes['v2'].allowExplicit).toBe(true);
  });

  it('should collect traffic policy', () => {
    @Gateway({})
    class TestGateway {
      @Route('/api/search/**')
      @ServiceRoute('search-service')
      @TrafficPolicy({
        mirror: { service: 'search-v2', percentage: 10 },
        timeout: 3000,
      })
      searchService: unknown;
    }

    const { routes } = collectRouteDefinitions(TestGateway);
    expect(routes[0].trafficPolicy).toBeDefined();
    expect(routes[0].trafficPolicy!.mirror?.service).toBe('search-v2');
    expect(routes[0].trafficPolicy!.mirror?.percentage).toBe(10);
    expect(routes[0].trafficPolicy!.timeout).toBe(3000);
  });

  it('should collect circuit breaker and rate limit overrides', () => {
    @Gateway({})
    class TestGateway {
      @Route('/api/critical/**')
      @ServiceRoute('critical-service')
      @GatewayCircuitBreaker({ failureThreshold: 3 })
      @GatewayRateLimit({ strategy: 'sliding-window', max: 50, window: 60000 })
      criticalService: unknown;
    }

    const { routes } = collectRouteDefinitions(TestGateway);
    expect(routes[0].circuitBreaker?.failureThreshold).toBe(3);
    expect(routes[0].rateLimit?.max).toBe(50);
  });

  it('should handle multiple routes', () => {
    @Gateway({})
    class TestGateway {
      @Route('/api/a/**')
      @ServiceRoute('service-a')
      serviceA: unknown;

      @Route('/api/b/**')
      @ServiceRoute('service-b')
      serviceB: unknown;

      @Route('/api/c/**')
      @ServiceRoute('service-c')
      serviceC: unknown;
    }

    const { routes } = collectRouteDefinitions(TestGateway);
    expect(routes).toHaveLength(3);
  });

  it('should accept string shorthand for ServiceRoute', () => {
    @Gateway({})
    class TestGateway {
      @Route('/api/simple/**')
      @ServiceRoute('simple-service')
      simpleService: unknown;
    }

    const { routes } = collectRouteDefinitions(TestGateway);
    expect(routes[0].serviceRoute?.serviceName).toBe('simple-service');
  });
});
