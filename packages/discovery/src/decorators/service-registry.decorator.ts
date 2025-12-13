/**
 * Service Registry Decorator
 * Automatically registers a service on module initialization
 */

import 'reflect-metadata';
import { ServiceRegistryConfig } from '../types';

type NewableFunction = new (...args: unknown[]) => unknown;

const SERVICE_REGISTRY_METADATA = 'hazeljs:service-registry';

export function ServiceRegistry(config: ServiceRegistryConfig): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  return function <TFunction extends Function>(target: TFunction) {
    Reflect.defineMetadata(SERVICE_REGISTRY_METADATA, config, target);
    return target;
  };
}

export function getServiceRegistryMetadata(
  target: NewableFunction
): ServiceRegistryConfig | undefined {
  return Reflect.getMetadata(SERVICE_REGISTRY_METADATA, target);
}
