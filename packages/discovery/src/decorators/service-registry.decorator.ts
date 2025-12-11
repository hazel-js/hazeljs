/**
 * Service Registry Decorator
 * Automatically registers a service on module initialization
 */

import 'reflect-metadata';
import { ServiceRegistryConfig } from '../types';

const SERVICE_REGISTRY_METADATA = 'hazeljs:service-registry';

export function ServiceRegistry(config: ServiceRegistryConfig) {
  return function (target: any) {
    Reflect.defineMetadata(SERVICE_REGISTRY_METADATA, config, target);
    return target;
  };
}

export function getServiceRegistryMetadata(target: any): ServiceRegistryConfig | undefined {
  return Reflect.getMetadata(SERVICE_REGISTRY_METADATA, target);
}
