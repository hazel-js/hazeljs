/**
 * Runtime validation utilities for discovery configuration objects
 */

import { ServiceRegistryConfig, DiscoveryClientConfig } from '../types';
import { RedisBackendConfig } from '../backends/redis-backend';
import { ConsulBackendConfig } from '../backends/consul-backend';
import { KubernetesBackendConfig } from '../backends/kubernetes-backend';
import { ServiceClientConfig } from '../client/service-client';

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Validate ServiceRegistryConfig at runtime
 */
export function validateServiceRegistryConfig(config: ServiceRegistryConfig): void {
  if (!config.name || typeof config.name !== 'string' || config.name.trim().length === 0) {
    throw new ConfigValidationError(
      'ServiceRegistryConfig: "name" is required and must be a non-empty string'
    );
  }

  if (
    config.port == null ||
    typeof config.port !== 'number' ||
    config.port < 0 ||
    config.port > 65535
  ) {
    throw new ConfigValidationError(
      'ServiceRegistryConfig: "port" is required and must be a number between 0 and 65535'
    );
  }

  if (
    config.healthCheckInterval != null &&
    (typeof config.healthCheckInterval !== 'number' || config.healthCheckInterval <= 0)
  ) {
    throw new ConfigValidationError(
      'ServiceRegistryConfig: "healthCheckInterval" must be a positive number (ms)'
    );
  }

  if (config.protocol && !['http', 'https', 'grpc'].includes(config.protocol)) {
    throw new ConfigValidationError(
      'ServiceRegistryConfig: "protocol" must be one of "http", "https", "grpc"'
    );
  }
}

/**
 * Validate DiscoveryClientConfig at runtime
 */
export function validateDiscoveryClientConfig(config: DiscoveryClientConfig): void {
  if (config.cacheTTL != null && (typeof config.cacheTTL !== 'number' || config.cacheTTL <= 0)) {
    throw new ConfigValidationError(
      'DiscoveryClientConfig: "cacheTTL" must be a positive number (ms)'
    );
  }

  if (
    config.refreshInterval != null &&
    (typeof config.refreshInterval !== 'number' || config.refreshInterval <= 0)
  ) {
    throw new ConfigValidationError(
      'DiscoveryClientConfig: "refreshInterval" must be a positive number (ms)'
    );
  }
}

/**
 * Validate ServiceClientConfig at runtime
 */
export function validateServiceClientConfig(config: ServiceClientConfig): void {
  if (
    !config.serviceName ||
    typeof config.serviceName !== 'string' ||
    config.serviceName.trim().length === 0
  ) {
    throw new ConfigValidationError(
      'ServiceClientConfig: "serviceName" is required and must be a non-empty string'
    );
  }

  if (config.timeout != null && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
    throw new ConfigValidationError(
      'ServiceClientConfig: "timeout" must be a positive number (ms)'
    );
  }

  if (
    config.retries != null &&
    (typeof config.retries !== 'number' || config.retries < 0 || !Number.isInteger(config.retries))
  ) {
    throw new ConfigValidationError(
      'ServiceClientConfig: "retries" must be a non-negative integer'
    );
  }

  if (
    config.retryDelay != null &&
    (typeof config.retryDelay !== 'number' || config.retryDelay < 0)
  ) {
    throw new ConfigValidationError(
      'ServiceClientConfig: "retryDelay" must be a non-negative number (ms)'
    );
  }
}

/**
 * Validate RedisBackendConfig at runtime
 */
export function validateRedisBackendConfig(config: RedisBackendConfig): void {
  if (config.ttl != null && (typeof config.ttl !== 'number' || config.ttl <= 0)) {
    throw new ConfigValidationError(
      'RedisBackendConfig: "ttl" must be a positive number (seconds)'
    );
  }

  if (
    config.port != null &&
    (typeof config.port !== 'number' || config.port < 0 || config.port > 65535)
  ) {
    throw new ConfigValidationError(
      'RedisBackendConfig: "port" must be a number between 0 and 65535'
    );
  }
}

/**
 * Validate ConsulBackendConfig at runtime
 */
export function validateConsulBackendConfig(config: ConsulBackendConfig): void {
  if (config.ttl != null && typeof config.ttl === 'string') {
    const match = config.ttl.match(/^(\d+)([smh])$/);
    if (!match) {
      throw new ConfigValidationError(
        'ConsulBackendConfig: "ttl" must match format like "30s", "5m", or "1h"'
      );
    }
  }

  if (
    config.port != null &&
    (typeof config.port !== 'number' || config.port < 0 || config.port > 65535)
  ) {
    throw new ConfigValidationError(
      'ConsulBackendConfig: "port" must be a number between 0 and 65535'
    );
  }
}

/**
 * Validate KubernetesBackendConfig at runtime
 */
export function validateKubernetesBackendConfig(config: KubernetesBackendConfig): void {
  if (
    config.namespace != null &&
    (typeof config.namespace !== 'string' || config.namespace.trim().length === 0)
  ) {
    throw new ConfigValidationError(
      'KubernetesBackendConfig: "namespace" must be a non-empty string'
    );
  }
}
