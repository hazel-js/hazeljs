/**
 * InjectServiceClient Decorator
 * Injects a service client for a specific service
 */

import 'reflect-metadata';

const INJECT_SERVICE_CLIENT_METADATA = 'hazeljs:inject-service-client';

export interface InjectServiceClientOptions {
  serviceName: string;
  loadBalancingStrategy?: string;
  timeout?: number;
  retries?: number;
}

export function InjectServiceClient(
  serviceName: string,
  options?: Omit<InjectServiceClientOptions, 'serviceName'>
) {
  return function (target: any, propertyKey: string | symbol, parameterIndex: number) {
    const config: InjectServiceClientOptions = {
      serviceName,
      ...options,
    };

    const existingParams: InjectServiceClientOptions[] =
      Reflect.getMetadata(INJECT_SERVICE_CLIENT_METADATA, target) || [];

    existingParams[parameterIndex] = config;

    Reflect.defineMetadata(INJECT_SERVICE_CLIENT_METADATA, existingParams, target);
  };
}

export function getInjectServiceClientMetadata(
  target: any
): InjectServiceClientOptions[] | undefined {
  return Reflect.getMetadata(INJECT_SERVICE_CLIENT_METADATA, target);
}
