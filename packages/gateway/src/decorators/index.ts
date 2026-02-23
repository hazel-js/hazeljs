/**
 * Gateway Decorators
 * Declarative API for defining gateway routes and policies.
 */

import 'reflect-metadata';
import {
  GatewayConfig,
  RouteConfig,
  ServiceRouteConfig,
  VersionRouteConfig,
  CanaryConfig,
  TrafficPolicyConfig,
} from '../types';
import { CircuitBreakerConfig, RateLimiterConfig } from '@hazeljs/resilience';

// Metadata keys
const GATEWAY_CONFIG_KEY = Symbol('gateway:config');
const GATEWAY_PROPERTIES_KEY = Symbol('gateway:properties');
const ROUTE_KEY = Symbol('gateway:route');
const SERVICE_ROUTE_KEY = Symbol('gateway:serviceRoute');
const VERSION_ROUTE_KEY = Symbol('gateway:versionRoute');
const CANARY_KEY = Symbol('gateway:canary');
const TRAFFIC_POLICY_KEY = Symbol('gateway:trafficPolicy');
const CIRCUIT_BREAKER_KEY = Symbol('gateway:circuitBreaker');
const RATE_LIMIT_KEY = Symbol('gateway:rateLimit');

/**
 * Track a property as a gateway-decorated property.
 * This is needed because TypeScript class property declarations don't appear
 * on the prototype, so we can't discover them via Object.getOwnPropertyNames.
 */
function trackProperty(target: object, propertyKey: string | symbol): void {
  const existing: Set<string> =
    Reflect.getMetadata(GATEWAY_PROPERTIES_KEY, target) || new Set<string>();
  existing.add(String(propertyKey));
  Reflect.defineMetadata(GATEWAY_PROPERTIES_KEY, existing, target);
}

type Constructor = new (...args: unknown[]) => unknown;

/**
 * @Gateway class decorator
 * Marks a class as a gateway definition with global configuration.
 */
export function Gateway(config: GatewayConfig): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- ClassDecorator requires Function
  return function (target: Function) {
    Reflect.defineMetadata(GATEWAY_CONFIG_KEY, config, target);
  };
}

/**
 * @Route property/method decorator
 * Defines a URL pattern this route handles.
 */
export function Route(pathOrConfig: string | RouteConfig): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    const config: RouteConfig =
      typeof pathOrConfig === 'string' ? { path: pathOrConfig } : pathOrConfig;
    Reflect.defineMetadata(ROUTE_KEY, config, target, propertyKey);
    trackProperty(target, propertyKey);
  };
}

/**
 * @ServiceRoute property/method decorator
 * Maps this route to a service in the discovery registry.
 */
export function ServiceRoute(nameOrConfig: string | ServiceRouteConfig): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    const config: ServiceRouteConfig =
      typeof nameOrConfig === 'string' ? { serviceName: nameOrConfig } : nameOrConfig;
    Reflect.defineMetadata(SERVICE_ROUTE_KEY, config, target, propertyKey);
    trackProperty(target, propertyKey);
  };
}

/**
 * @VersionRoute property/method decorator
 * Enables version-based routing for this route.
 */
export function VersionRoute(config: VersionRouteConfig): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    Reflect.defineMetadata(VERSION_ROUTE_KEY, config, target, propertyKey);
  };
}

/**
 * @Canary property/method decorator
 * Enables canary deployment for this route.
 */
export function Canary(config: CanaryConfig): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    Reflect.defineMetadata(CANARY_KEY, config, target, propertyKey);
  };
}

/**
 * @TrafficPolicy property/method decorator
 * Defines traffic policies (mirroring, transformation, etc.)
 */
export function TrafficPolicy(config: TrafficPolicyConfig): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    Reflect.defineMetadata(TRAFFIC_POLICY_KEY, config, target, propertyKey);
  };
}

/**
 * @CircuitBreaker property decorator (gateway-specific)
 * Overrides circuit breaker configuration for this route.
 */
export function GatewayCircuitBreaker(config: Partial<CircuitBreakerConfig>): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    Reflect.defineMetadata(CIRCUIT_BREAKER_KEY, config, target, propertyKey);
  };
}

/**
 * @RateLimit property decorator (gateway-specific)
 * Overrides rate limit configuration for this route.
 */
export function GatewayRateLimit(config: Partial<RateLimiterConfig>): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    Reflect.defineMetadata(RATE_LIMIT_KEY, config, target, propertyKey);
  };
}

// ─── Metadata Readers ───

export function getGatewayConfig(target: Constructor): GatewayConfig | undefined {
  return Reflect.getMetadata(GATEWAY_CONFIG_KEY, target);
}

export function getRouteConfig(
  target: object,
  propertyKey: string | symbol
): RouteConfig | undefined {
  return Reflect.getMetadata(ROUTE_KEY, target, propertyKey);
}

export function getServiceRouteConfig(
  target: object,
  propertyKey: string | symbol
): ServiceRouteConfig | undefined {
  return Reflect.getMetadata(SERVICE_ROUTE_KEY, target, propertyKey);
}

export function getVersionRouteConfig(
  target: object,
  propertyKey: string | symbol
): VersionRouteConfig | undefined {
  return Reflect.getMetadata(VERSION_ROUTE_KEY, target, propertyKey);
}

export function getCanaryConfig(
  target: object,
  propertyKey: string | symbol
): CanaryConfig | undefined {
  return Reflect.getMetadata(CANARY_KEY, target, propertyKey);
}

export function getTrafficPolicyConfig(
  target: object,
  propertyKey: string | symbol
): TrafficPolicyConfig | undefined {
  return Reflect.getMetadata(TRAFFIC_POLICY_KEY, target, propertyKey);
}

export function getCircuitBreakerConfig(
  target: object,
  propertyKey: string | symbol
): Partial<CircuitBreakerConfig> | undefined {
  return Reflect.getMetadata(CIRCUIT_BREAKER_KEY, target, propertyKey);
}

export function getRateLimitConfig(
  target: object,
  propertyKey: string | symbol
): Partial<RateLimiterConfig> | undefined {
  return Reflect.getMetadata(RATE_LIMIT_KEY, target, propertyKey);
}

/**
 * Collect all route definitions from a gateway class instance
 */
export function collectRouteDefinitions(gatewayClass: Constructor): {
  config: GatewayConfig;
  routes: Array<{
    propertyKey: string;
    route?: RouteConfig;
    serviceRoute?: ServiceRouteConfig;
    versionRoute?: VersionRouteConfig;
    canary?: CanaryConfig;
    trafficPolicy?: TrafficPolicyConfig;
    circuitBreaker?: Partial<CircuitBreakerConfig>;
    rateLimit?: Partial<RateLimiterConfig>;
  }>;
} {
  const config = getGatewayConfig(gatewayClass) || {};
  const prototype = gatewayClass.prototype;

  // Get tracked gateway properties (from decorators) + prototype methods
  const trackedProps: Set<string> =
    Reflect.getMetadata(GATEWAY_PROPERTIES_KEY, prototype) || new Set<string>();
  const protoMethods = Object.getOwnPropertyNames(prototype).filter((p) => p !== 'constructor');
  const allProperties = new Set([...trackedProps, ...protoMethods]);

  const routes = Array.from(allProperties)
    .map((propertyKey) => ({
      propertyKey,
      route: getRouteConfig(prototype, propertyKey),
      serviceRoute: getServiceRouteConfig(prototype, propertyKey),
      versionRoute: getVersionRouteConfig(prototype, propertyKey),
      canary: getCanaryConfig(prototype, propertyKey),
      trafficPolicy: getTrafficPolicyConfig(prototype, propertyKey),
      circuitBreaker: getCircuitBreakerConfig(prototype, propertyKey),
      rateLimit: getRateLimitConfig(prototype, propertyKey),
    }))
    .filter((r) => r.route || r.serviceRoute);

  return { config, routes };
}
