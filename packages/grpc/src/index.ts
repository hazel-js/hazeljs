/**
 * @hazeljs/grpc - gRPC module for HazelJS
 *
 * RPC server support with decorator-based handlers.
 * Built on @grpc/grpc-js and @grpc/proto-loader.
 */

export { GrpcModule } from './grpc.module';
export { GrpcServer } from './grpc.server';
export { GrpcMethod, getGrpcMethodMetadata } from './decorators/grpc-method.decorator';
export type {
  GrpcModuleOptions,
  GrpcModuleConfig,
  GrpcMethodMetadata,
  ProtoLoaderOptions,
  GrpcPackageDefinition,
} from './grpc.types';
