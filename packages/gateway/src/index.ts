/**
 * @hazeljs/gateway
 * Intelligent API Gateway for HazelJS
 *
 * Provides version-based routing, canary deployments, circuit breaking,
 * traffic management, and automatic rollback — all via decorators or
 * programmatic API.
 */

// Types
export {
  GatewayConfig,
  GatewayFullConfig,
  GatewayResilienceDefaults,
  GatewayMetricsConfig,
  GatewayMiddlewareConfig,
  CorsConfig,
  RouteConfig,
  ServiceRouteConfig,
  VersionResolutionStrategy,
  VersionRouteConfig,
  VersionRouteEntry,
  CanaryConfig,
  CanaryVersionConfig,
  CanaryPromotionConfig,
  CanaryMetrics,
  CanaryVersionMetrics,
  CanaryDecision,
  CanaryState,
  TrafficPolicyConfig,
  TrafficMirrorConfig,
  TrafficTransformConfig,
  ProxyRequest,
  ProxyResponse,
  GatewayRouteDefinition,
  GatewayEvent,
  GatewayEventType,
} from './types';

// Gateway Server
export { GatewayServer } from './gateway';

// Gateway Module (config integration)
export { GatewayModule, GatewayModuleOptions } from './gateway.module';

// Service Proxy
export { ServiceProxy, ServiceProxyConfig } from './proxy/service-proxy';

// Routing
export { VersionRouter, VersionResolution } from './routing/version-router';
export { matchRoute, sortRoutesBySpecificity, RouteMatch } from './routing/route-matcher';

// Canary Engine
export { CanaryEngine, CanaryStatus, parseInterval } from './canary/canary-engine';

// Metrics
export {
  GatewayMetrics,
  GatewayMetricsSnapshot,
  RouteMetricsSnapshot,
} from './metrics/gateway-metrics';

// Traffic Mirror
export { TrafficMirror } from './middleware/traffic-mirror';

// HazelJS Core Integration
export { createGatewayHandler } from './hazel-integration';

// Decorators
export {
  Gateway,
  Route,
  ServiceRoute,
  VersionRoute,
  Canary,
  TrafficPolicy,
  GatewayCircuitBreaker,
  GatewayRateLimit,
  // Metadata readers
  getGatewayConfig,
  getRouteConfig,
  getServiceRouteConfig,
  getVersionRouteConfig,
  getCanaryConfig,
  getTrafficPolicyConfig,
  getCircuitBreakerConfig,
  getRateLimitConfig,
  collectRouteDefinitions,
} from './decorators';
