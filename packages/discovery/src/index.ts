/**
 * @hazeljs/discovery
 * Service Discovery and Registry for HazelJS Microservices
 */

// Types
export * from './types';

// Registry
export * from './registry/service-registry';

// Client
export * from './client/discovery-client';
export * from './client/service-client';

// Load Balancer
export * from './load-balancer/strategies';

// Backends
export { RegistryBackend } from './backends/registry-backend';
export { MemoryRegistryBackend } from './backends/memory-backend';
export { RedisRegistryBackend, RedisBackendConfig } from './backends/redis-backend';
export {
  ConsulRegistryBackend,
  ConsulBackendConfig,
  ConsulClient,
} from './backends/consul-backend';
export { KubernetesRegistryBackend, KubernetesBackendConfig } from './backends/kubernetes-backend';

// Decorators
export { ServiceRegistry as ServiceRegistryDecorator } from './decorators/service-registry.decorator';
export { getServiceRegistryMetadata } from './decorators/service-registry.decorator';
export * from './decorators/inject-service-client.decorator';

// Utilities
export { applyServiceFilter } from './utils/filter';
export { DiscoveryLogger, Logger } from './utils/logger';
export { ConfigValidationError } from './utils/validation';
