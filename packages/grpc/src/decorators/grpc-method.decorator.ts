import 'reflect-metadata';
import type { GrpcMethodMetadata } from '../grpc.types';

/**
 * Metadata key for gRPC method handlers
 */
export const GRPC_METHOD_METADATA_KEY = Symbol('grpc:method');

/**
 * Decorator to mark a method as a gRPC RPC handler
 *
 * @param serviceName - Service name as defined in the .proto file (e.g. 'HeroService')
 * @param methodName - Method name as defined in the .proto file. Defaults to the decorated method name.
 *
 * @example
 * ```typescript
 * @GrpcMethod('HeroService', 'FindOne')
 * findOne(data: { id: number }) {
 *   return { id: data.id, name: 'Hero' };
 * }
 *
 * // Method name defaults to decorated method name
 * @GrpcMethod('HeroService')
 * findOne(data: { id: number }) {
 *   return { id: data.id, name: 'Hero' };
 * }
 * ```
 */
export function GrpcMethod(serviceName: string, methodName?: string): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    const existing: GrpcMethodMetadata[] =
      Reflect.getMetadata(GRPC_METHOD_METADATA_KEY, target.constructor) || [];

    existing.push({
      service: serviceName,
      method: methodName ?? propertyKey.toString(),
      methodName: propertyKey.toString(),
    });

    Reflect.defineMetadata(GRPC_METHOD_METADATA_KEY, existing, target.constructor);
  };
}

/**
 * Get @GrpcMethod metadata from a class
 */
export function getGrpcMethodMetadata(target: object): GrpcMethodMetadata[] {
  return Reflect.getMetadata(GRPC_METHOD_METADATA_KEY, target.constructor) || [];
}
