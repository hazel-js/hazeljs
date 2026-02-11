/**
 * @hazeljs/gateway - Type Definitions
 */

import { CircuitBreakerConfig, RetryConfig, RateLimiterConfig } from '@hazeljs/resilience';
import { DiscoveryClientConfig, ServiceFilter } from '@hazeljs/discovery';

// ─── Gateway Configuration ───

export interface GatewayConfig {
  /** Discovery client configuration */
  discovery?: DiscoveryClientConfig;
  /** Default resilience settings applied to all routes */
  resilience?: GatewayResilienceDefaults;
  /** Metrics collection configuration */
  metrics?: GatewayMetricsConfig;
  /** Global middleware */
  middleware?: GatewayMiddlewareConfig;
}

export interface GatewayResilienceDefaults {
  /** Default circuit breaker config for all routes */
  defaultCircuitBreaker?: Partial<CircuitBreakerConfig>;
  /** Default retry config for all routes */
  defaultRetry?: Partial<RetryConfig>;
  /** Default timeout in ms for all routes */
  defaultTimeout?: number;
}

export interface GatewayMetricsConfig {
  /** Whether to collect metrics */
  enabled: boolean;
  /** How often to aggregate metrics (ms or string like '10s') */
  collectionInterval?: number | string;
  /** Metrics window size in ms */
  windowSize?: number;
}

export interface GatewayMiddlewareConfig {
  /** Enable CORS */
  cors?: boolean | CorsConfig;
  /** Enable request logging */
  logging?: boolean;
  /** Enable request ID generation */
  requestId?: boolean;
}

export interface CorsConfig {
  origin?: string | string[];
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
}

// ─── Route Configuration ───

export interface RouteConfig {
  /** URL pattern to match (supports ** glob, :param, *) */
  path: string;
  /** HTTP methods to match (default: all) */
  methods?: string[];
}

export interface ServiceRouteConfig {
  /** Name of the service in the discovery registry */
  serviceName: string;
  /** Load balancing strategy override */
  loadBalancingStrategy?: string;
  /** Filter for service instances */
  filter?: ServiceFilter;
  /** Path prefix to strip before forwarding */
  stripPrefix?: string;
  /** Path prefix to add when forwarding */
  addPrefix?: string;
}

// ─── Version Routing ───

export type VersionResolutionStrategy = 'header' | 'uri' | 'query';

export interface VersionRouteConfig {
  /** How to detect the requested version */
  strategy?: VersionResolutionStrategy;
  /** Header name for header-based routing (default: 'X-API-Version') */
  header?: string;
  /** Query parameter name for query-based routing */
  queryParam?: string;
  /** Route definitions per version */
  routes: Record<string, VersionRouteEntry>;
  /** Default version if none specified */
  defaultVersion?: string;
}

export interface VersionRouteEntry {
  /** Weight for weighted routing (0-100) */
  weight: number;
  /** Whether to route only when version is explicitly requested */
  allowExplicit?: boolean;
  /** Service filter override for this version */
  filter?: ServiceFilter;
}

// ─── Canary Deployment ───

export interface CanaryConfig {
  /** Stable version configuration */
  stable: CanaryVersionConfig;
  /** Canary version configuration */
  canary: CanaryVersionConfig;
  /** Promotion strategy configuration */
  promotion: CanaryPromotionConfig;
}

export interface CanaryVersionConfig {
  /** Version identifier (matches metadata.version on ServiceInstance) */
  version: string;
  /** Initial traffic weight (0-100, stable + canary should = 100) */
  weight: number;
  /** Optional service filter override */
  filter?: ServiceFilter;
}

export interface CanaryPromotionConfig {
  /** Strategy for evaluating promotion readiness */
  strategy: 'error-rate' | 'latency' | 'custom';
  /** Error rate threshold percentage (for 'error-rate' strategy) */
  errorThreshold?: number;
  /** Latency threshold in ms (for 'latency' strategy) */
  latencyThreshold?: number;
  /** Time window for evaluation (ms or string like '5m') */
  evaluationWindow: number | string;
  /** Whether to automatically promote through steps */
  autoPromote: boolean;
  /** Whether to automatically rollback on threshold breach */
  autoRollback: boolean;
  /** Weight progression steps (e.g. [10, 25, 50, 75, 100]) */
  steps: number[];
  /** Time between promotion steps (ms or string like '10m') */
  stepInterval: number | string;
  /** Custom evaluator function (for 'custom' strategy) */
  customEvaluator?: (metrics: CanaryMetrics) => CanaryDecision;
  /** Minimum number of requests before evaluation can happen */
  minRequests?: number;
}

export interface CanaryMetrics {
  stable: CanaryVersionMetrics;
  canary: CanaryVersionMetrics;
}

export interface CanaryVersionMetrics {
  totalRequests: number;
  errorCount: number;
  errorRate: number;
  averageLatency: number;
  p99Latency: number;
}

export type CanaryDecision = 'promote' | 'rollback' | 'hold';

export enum CanaryState {
  /** Canary is actively receiving traffic at current weight */
  ACTIVE = 'ACTIVE',
  /** Canary was promoted to 100% */
  PROMOTED = 'PROMOTED',
  /** Canary was rolled back, all traffic to stable */
  ROLLED_BACK = 'ROLLED_BACK',
  /** Canary is paused (manual intervention) */
  PAUSED = 'PAUSED',
}

// ─── Traffic Policy ───

export interface TrafficPolicyConfig {
  /** Mirror traffic to another service for shadow testing */
  mirror?: TrafficMirrorConfig;
  /** Request/response transformation */
  transform?: TrafficTransformConfig;
  /** Timeout override in ms */
  timeout?: number;
  /** Retry override */
  retry?: Partial<RetryConfig>;
  /** Circuit breaker override */
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  /** Rate limit override */
  rateLimit?: Partial<RateLimiterConfig>;
}

export interface TrafficMirrorConfig {
  /** Target service name for mirrored traffic */
  service: string;
  /** Percentage of traffic to mirror (0-100) */
  percentage: number;
  /** Whether to wait for mirror response */
  waitForResponse?: boolean;
}

export interface TrafficTransformConfig {
  /** Transform the outgoing request before forwarding */
  request?: (req: ProxyRequest) => ProxyRequest;
  /** Transform the response before returning to client */
  response?: (res: ProxyResponse) => ProxyResponse;
}

// ─── Proxy Types ───

export interface ProxyRequest {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string>;
}

export interface ProxyResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface GatewayRouteDefinition {
  /** Route path pattern */
  path: string;
  /** Target service name */
  serviceName: string;
  /** Full service route configuration */
  serviceConfig?: ServiceRouteConfig;
  /** Version routing configuration */
  versionRoute?: VersionRouteConfig;
  /** Canary deployment configuration */
  canary?: CanaryConfig;
  /** Traffic policy */
  trafficPolicy?: TrafficPolicyConfig;
  /** Rate limiter config */
  rateLimit?: Partial<RateLimiterConfig>;
  /** Circuit breaker config */
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  /** HTTP methods */
  methods?: string[];
}

// ─── Full Config (config-driven gateway) ───

export interface GatewayFullConfig extends GatewayConfig {
  /** Route definitions loaded from configuration */
  routes: GatewayRouteDefinition[];
}

// ─── Events ───

export interface GatewayEvent {
  type: string;
  timestamp: number;
  route?: string;
  service?: string;
  data?: Record<string, unknown>;
}

export type GatewayEventType =
  | 'canary:promote'
  | 'canary:rollback'
  | 'canary:complete'
  | 'canary:paused'
  | 'circuit:open'
  | 'circuit:close'
  | 'circuit:half-open'
  | 'rate-limit:exceeded'
  | 'route:error'
  | 'route:timeout';
