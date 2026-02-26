/**
 * Options for @grpc/proto-loader
 * @see https://www.npmjs.com/package/@grpc/proto-loader
 */
export interface ProtoLoaderOptions {
  keepCase?: boolean;
  longs?: string | number;
  enums?: string;
  bytes?: string | string[];
  defaults?: boolean;
  arrays?: boolean;
  objects?: boolean;
  oneofs?: boolean;
  json?: boolean;
  includeDirs?: string[];
}

/**
 * gRPC module configuration options
 */
export interface GrpcModuleOptions {
  /**
   * Path to .proto file(s). Can be a single path or array of paths.
   */
  protoPath: string | string[];

  /**
   * Package name as defined in the .proto file (e.g. 'hero', 'math')
   */
  package: string;

  /**
   * Address to bind the gRPC server (e.g. '0.0.0.0:50051')
   * @default '0.0.0.0:50051'
   */
  url?: string;

  /**
   * Options passed to @grpc/proto-loader
   */
  loader?: ProtoLoaderOptions;
}

/**
 * Extended options for GrpcModule.forRoot
 */
export interface GrpcModuleConfig extends GrpcModuleOptions {
  /**
   * Whether this is a global module
   * @default true
   */
  isGlobal?: boolean;
}

/**
 * Metadata for @GrpcMethod decorator
 */
export interface GrpcMethodMetadata {
  service: string;
  method: string;
  methodName: string;
}

/**
 * Loaded package definition from proto files (from loadPackageDefinition)
 */
export type GrpcPackageDefinition = Record<string, unknown>;
