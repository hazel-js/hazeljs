import type { ProtoLoaderOptions } from './grpc.types';
import type { ChannelCredentials } from '@grpc/grpc-js';

/**
 * Service instance shape returned by Discovery (matches @hazeljs/discovery ServiceInstance)
 */
export interface GrpcServiceInstanceLike {
  host: string;
  port: number;
  protocol?: 'http' | 'https' | 'grpc';
}

/**
 * Discovery client interface for optional Discovery integration.
 * Matches @hazeljs/discovery DiscoveryClient API.
 */
export interface GrpcDiscoveryClientLike {
  getInstance(
    serviceName: string,
    strategy?: string,
    filter?: {
      zone?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
      status?: unknown;
    }
  ): Promise<GrpcServiceInstanceLike | null>;
}

/**
 * Discovery configuration for GrpcClientService.
 * Used when resolving gRPC service URLs via service discovery.
 */
export interface GrpcClientDiscoveryConfig {
  /** Discovery client instance (from @hazeljs/discovery) */
  client: GrpcDiscoveryClientLike;
  /** Service name to resolve (e.g. 'product-service') */
  serviceName: string;
  /** Load balancing strategy. @default 'round-robin' */
  loadBalancingStrategy?: string;
  /** Optional filter for service instances (e.g. filter by protocol: 'grpc') */
  filter?: {
    zone?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
    status?: unknown;
  };
}

/**
 * gRPC client configuration options
 */
export interface GrpcClientOptions {
  /** Path to .proto file(s). Can be a single path or array of paths. */
  protoPath: string | string[];
  /** Package name as defined in the .proto file (e.g. 'hero', 'catalog') */
  package: string;
  /** Default URL for gRPC services when not using Discovery (e.g. 'localhost:50051') */
  defaultUrl?: string;
  /** Options passed to @grpc/proto-loader */
  loader?: ProtoLoaderOptions;
  /** Channel credentials (default: createInsecure) */
  credentials?: ChannelCredentials;
  /** Optional Discovery config for dynamic service resolution */
  discovery?: GrpcClientDiscoveryConfig;
}

/**
 * Extended options for GrpcClientModule.forRoot
 */
export interface GrpcClientModuleConfig extends GrpcClientOptions {
  /** Whether this is a global module. @default true */
  isGlobal?: boolean;
}
