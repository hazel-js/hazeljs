/**
 * @hazeljs/grpc - gRPC module for HazelJS
 *
 * RPC server and client support with decorator-based handlers.
 * Built on @grpc/grpc-js and @grpc/proto-loader.
 */

export { GrpcModule } from './grpc.module';
export { GrpcServer } from './grpc.server';
export { GrpcClientModule } from './grpc.client.module';
export { GrpcClientService } from './grpc.client';
export { GrpcMethod, getGrpcMethodMetadata } from './decorators/grpc-method.decorator';
export type {
  GrpcModuleOptions,
  GrpcModuleConfig,
  GrpcMethodMetadata,
  ProtoLoaderOptions,
  GrpcPackageDefinition,
} from './grpc.types';
export type {
  GrpcClientOptions,
  GrpcClientModuleConfig,
  GrpcClientDiscoveryConfig,
  GrpcDiscoveryClientLike,
  GrpcServiceInstanceLike,
} from './grpc.client.types';
