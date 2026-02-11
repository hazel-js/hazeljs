/**
 * Gateway
 * The main orchestrator that ties together routing, versioning, canary,
 * resilience, and traffic policies into a unified request handling pipeline.
 *
 * Can be used declaratively via decorators or programmatically via config.
 */

import { EventEmitter } from 'events';
import { DiscoveryClient, RegistryBackend } from '@hazeljs/discovery';
import { CircuitBreakerRegistry } from '@hazeljs/resilience';
import {
  GatewayConfig,
  GatewayFullConfig,
  GatewayRouteDefinition,
  ProxyRequest,
  ProxyResponse,
  CanaryConfig,
  VersionRouteConfig,
  TrafficMirrorConfig,
  GatewayEventType,
} from './types';
import { ServiceProxy, ServiceProxyConfig } from './proxy/service-proxy';
import { VersionRouter } from './routing/version-router';
import { CanaryEngine } from './canary/canary-engine';
import { GatewayMetrics } from './metrics/gateway-metrics';
import { TrafficMirror } from './middleware/traffic-mirror';
import { matchRoute, sortRoutesBySpecificity } from './routing/route-matcher';
import { collectRouteDefinitions } from './decorators';

interface RouteHandler {
  definition: GatewayRouteDefinition;
  proxy: ServiceProxy;
  versionRouter?: VersionRouter;
  canaryEngine?: CanaryEngine;
  trafficMirror?: TrafficMirror;
}

export class GatewayServer extends EventEmitter {
  private discoveryClient: DiscoveryClient;
  private routes = new Map<string, RouteHandler>();
  private sortedPatterns: string[] = [];
  private metrics: GatewayMetrics;
  private config: GatewayConfig;

  constructor(config: GatewayConfig, backend?: RegistryBackend) {
    super();
    this.config = config;
    this.metrics = new GatewayMetrics(config.metrics?.windowSize ?? 60_000);

    this.discoveryClient = new DiscoveryClient(
      config.discovery ?? {},
      backend
    );
  }

  /**
   * Create a gateway from a plain configuration object.
   * This is the production-recommended approach — config values come from
   * env vars / config files via @hazeljs/config instead of hardcoded decorators.
   */
  static fromConfig(config: GatewayFullConfig, backend?: RegistryBackend): GatewayServer {
    const gateway = new GatewayServer(config, backend);
    for (const route of config.routes) {
      gateway.addRoute(route);
    }
    return gateway;
  }

  /**
   * Create a gateway from a decorated class
   */
  static fromClass(gatewayClass: Function, backend?: RegistryBackend): GatewayServer {
    const { config, routes } = collectRouteDefinitions(gatewayClass);
    const gateway = new GatewayServer(config, backend);

    for (const routeDef of routes) {
      if (!routeDef.route || !routeDef.serviceRoute) continue;

      gateway.addRoute({
        path: routeDef.route.path,
        serviceName: routeDef.serviceRoute.serviceName,
        serviceConfig: routeDef.serviceRoute,
        versionRoute: routeDef.versionRoute,
        canary: routeDef.canary,
        trafficPolicy: routeDef.trafficPolicy,
        circuitBreaker: routeDef.circuitBreaker,
        rateLimit: routeDef.rateLimit,
        methods: routeDef.route.methods,
      });
    }

    return gateway;
  }

  /**
   * Add a route definition to the gateway
   */
  addRoute(definition: GatewayRouteDefinition): void {
    const proxyConfig: ServiceProxyConfig = {
      serviceName: definition.serviceName,
      loadBalancingStrategy: definition.serviceConfig?.loadBalancingStrategy,
      filter: definition.serviceConfig?.filter,
      stripPrefix: definition.serviceConfig?.stripPrefix,
      addPrefix: definition.serviceConfig?.addPrefix,
      timeout: definition.trafficPolicy?.timeout ?? this.config.resilience?.defaultTimeout,
      retry: definition.trafficPolicy?.retry ?? this.config.resilience?.defaultRetry,
      circuitBreaker:
        definition.circuitBreaker ??
        definition.trafficPolicy?.circuitBreaker ??
        this.config.resilience?.defaultCircuitBreaker,
      rateLimit: definition.rateLimit ?? definition.trafficPolicy?.rateLimit,
      transform: definition.trafficPolicy?.transform,
    };

    const proxy = new ServiceProxy(this.discoveryClient, proxyConfig);

    const handler: RouteHandler = {
      definition,
      proxy,
    };

    // Set up version routing
    if (definition.versionRoute) {
      handler.versionRouter = new VersionRouter(definition.versionRoute);
    }

    // Set up canary deployment
    if (definition.canary) {
      handler.canaryEngine = this.createCanaryEngine(definition.canary, definition.path);
    }

    // Set up traffic mirroring
    if (definition.trafficPolicy?.mirror) {
      handler.trafficMirror = new TrafficMirror(
        definition.trafficPolicy.mirror,
        this.discoveryClient
      );
    }

    this.routes.set(definition.path, handler);
    this.sortedPatterns = sortRoutesBySpecificity(
      Array.from(this.routes.keys())
    );
  }

  /**
   * Handle an incoming request through the gateway pipeline
   */
  async handleRequest(request: ProxyRequest): Promise<ProxyResponse> {
    const startTime = Date.now();

    // 1. Match the route
    const handler = this.findHandler(request);
    if (!handler) {
      return {
        status: 404,
        headers: {},
        body: { error: 'No matching gateway route', path: request.path },
      };
    }

    // Check method
    if (
      handler.definition.methods &&
      handler.definition.methods.length > 0 &&
      !handler.definition.methods.includes(request.method.toUpperCase())
    ) {
      return {
        status: 405,
        headers: {},
        body: { error: 'Method not allowed' },
      };
    }

    try {
      let response: ProxyResponse;

      // 2. Canary routing takes priority
      if (handler.canaryEngine) {
        response = await this.handleCanaryRequest(handler, request);
      }
      // 3. Version routing
      else if (handler.versionRouter) {
        response = await this.handleVersionedRequest(handler, request);
      }
      // 4. Direct proxy
      else {
        response = await handler.proxy.forward(request);
      }

      // 5. Mirror traffic (fire and forget)
      if (handler.trafficMirror) {
        handler.trafficMirror.mirror(request);
      }

      // 6. Record metrics
      const duration = Date.now() - startTime;
      const isError = response.status >= 500;
      if (isError) {
        this.metrics.recordFailure(
          handler.definition.path,
          duration,
          `HTTP ${response.status}`
        );
      } else {
        this.metrics.recordSuccess(handler.definition.path, duration);
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.recordFailure(
        handler.definition.path,
        duration,
        String(error)
      );

      this.emit('route:error' as GatewayEventType, {
        route: handler.definition.path,
        service: handler.definition.serviceName,
        error: String(error),
      });

      return {
        status: 502,
        headers: {},
        body: {
          error: 'Bad Gateway',
          message: error instanceof Error ? error.message : String(error),
          service: handler.definition.serviceName,
        },
      };
    }
  }

  /**
   * Start all canary engines
   */
  startCanaries(): void {
    for (const handler of this.routes.values()) {
      if (handler.canaryEngine) {
        handler.canaryEngine.start();
      }
    }
  }

  /**
   * Stop all canary engines and clean up
   */
  stop(): void {
    for (const handler of this.routes.values()) {
      if (handler.canaryEngine) {
        handler.canaryEngine.stop();
      }
    }
    this.discoveryClient.close();
  }

  /**
   * Get the gateway metrics
   */
  getMetrics(): GatewayMetrics {
    return this.metrics;
  }

  /**
   * Get the canary engine for a specific route
   */
  getCanaryEngine(routePath: string): CanaryEngine | undefined {
    return this.routes.get(routePath)?.canaryEngine;
  }

  /**
   * Get all route paths
   */
  getRoutes(): string[] {
    return Array.from(this.routes.keys());
  }

  /**
   * Get the discovery client
   */
  getDiscoveryClient(): DiscoveryClient {
    return this.discoveryClient;
  }

  // ─── Internal ───

  private findHandler(request: ProxyRequest): RouteHandler | undefined {
    for (const pattern of this.sortedPatterns) {
      const match = matchRoute(pattern, request.path);
      if (match.matched) {
        return this.routes.get(pattern);
      }
    }
    return undefined;
  }

  private async handleCanaryRequest(
    handler: RouteHandler,
    request: ProxyRequest
  ): Promise<ProxyResponse> {
    const engine = handler.canaryEngine!;
    const target = engine.selectVersion(request);
    const version = engine.getVersion(target);

    const startTime = Date.now();
    try {
      const response = await handler.proxy.forwardToVersion(request, version);
      const duration = Date.now() - startTime;

      const isError = response.status >= 500;
      if (isError) {
        engine.recordFailure(target, duration, `HTTP ${response.status}`);
        this.metrics.recordFailure(
          handler.definition.path,
          duration,
          `HTTP ${response.status}`,
          version
        );
      } else {
        engine.recordSuccess(target, duration);
        this.metrics.recordSuccess(handler.definition.path, duration, version);
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      engine.recordFailure(target, duration, String(error));
      this.metrics.recordFailure(
        handler.definition.path,
        duration,
        String(error),
        version
      );
      throw error;
    }
  }

  private async handleVersionedRequest(
    handler: RouteHandler,
    request: ProxyRequest
  ): Promise<ProxyResponse> {
    const router = handler.versionRouter!;
    const resolution = router.resolve(request);

    const startTime = Date.now();
    try {
      const entry = router.getVersionEntry(resolution.version);
      const response = await handler.proxy.forwardToVersion(
        request,
        resolution.version,
        entry?.filter
      );

      const duration = Date.now() - startTime;
      this.metrics.recordSuccess(
        handler.definition.path,
        duration,
        resolution.version
      );

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.recordFailure(
        handler.definition.path,
        duration,
        String(error),
        resolution.version
      );
      throw error;
    }
  }

  private createCanaryEngine(config: CanaryConfig, routePath: string): CanaryEngine {
    const engine = new CanaryEngine(config);

    // Forward canary events to the gateway
    engine.on('canary:promote', (data) => {
      this.emit('canary:promote' as GatewayEventType, {
        route: routePath,
        ...data,
      });
    });

    engine.on('canary:rollback', (data) => {
      this.emit('canary:rollback' as GatewayEventType, {
        route: routePath,
        ...data,
      });
    });

    engine.on('canary:complete', (data) => {
      this.emit('canary:complete' as GatewayEventType, {
        route: routePath,
        ...data,
      });
    });

    return engine;
  }
}
