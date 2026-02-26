import { Injectable } from '@hazeljs/core';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import type { PackageDefinition } from '@grpc/proto-loader';
import logger from '@hazeljs/core';
import type {
  GrpcClientOptions,
  GrpcClientDiscoveryConfig,
  GrpcDiscoveryClientLike,
} from './grpc.client.types';

type GrpcClientStub = Record<
  string,
  (req: unknown, cb: (err: Error | null, res: unknown) => void) => void
>;

/**
 * gRPC Client service - creates and caches gRPC client stubs for calling remote gRPC services
 */
@Injectable()
export class GrpcClientService {
  private packageDefinition: PackageDefinition | null = null;
  private protoDescriptor: Record<string, unknown> | null = null;
  private options: GrpcClientOptions | null = null;
  private stubCache = new Map<string, Map<string, GrpcClientStub>>();

  /**
   * Configure the client with proto path and options
   */
  configure(options: GrpcClientOptions): void {
    this.options = options;
    const protoPath = Array.isArray(options.protoPath) ? options.protoPath : [options.protoPath];
    const loaderOptions = {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      ...(options.loader ?? {}),
    } as protoLoader.Options;

    this.packageDefinition = protoLoader.loadSync(protoPath, loaderOptions);
    this.protoDescriptor = grpc.loadPackageDefinition(this.packageDefinition) as Record<
      string,
      unknown
    >;
    logger.info('gRPC client configured', {
      package: options.package,
      defaultUrl: options.defaultUrl,
      discovery: !!options.discovery,
    });
  }

  /**
   * Resolve URL from Discovery when configured
   */
  private async resolveUrl(serviceName: string): Promise<string> {
    const discovery = this.options?.discovery;
    if (!discovery) {
      const defaultUrl = this.options?.defaultUrl;
      if (!defaultUrl) {
        throw new Error(
          'No URL provided and no defaultUrl configured. Pass url to getClient() or set defaultUrl in GrpcClientModule.forRoot().'
        );
      }
      return defaultUrl;
    }

    const client = discovery.client as GrpcDiscoveryClientLike;
    const strategy = discovery.loadBalancingStrategy ?? 'round-robin';
    const filter = this.buildDiscoveryFilter(discovery);

    const instance = await client.getInstance(discovery.serviceName, strategy, filter);
    if (!instance) {
      throw new Error(`Discovery: no gRPC instance found for service "${discovery.serviceName}"`);
    }

    const url = `${instance.host}:${instance.port}`;
    logger.debug('Resolved gRPC URL from Discovery', { serviceName, url });
    return url;
  }

  /**
   * Build filter for Discovery.
   * Passes user filter; for protocol: 'grpc' use metadata: { protocol: 'grpc' }
   * since ServiceFilter filters by metadata.
   */
  private buildDiscoveryFilter(discovery: GrpcClientDiscoveryConfig): Record<string, unknown> {
    return discovery.filter ?? {};
  }

  /**
   * Get a gRPC client stub for the given service.
   * When Discovery is configured and url is omitted, resolves URL from Discovery.
   * Stubs are cached per (serviceName, url).
   *
   * @param serviceName - Service name as defined in proto (e.g. 'ProductService')
   * @param url - Optional URL (e.g. 'localhost:50051'). Required if not using Discovery and no defaultUrl.
   * @returns gRPC client stub with RPC methods
   */
  getClient(serviceName: string, url?: string): GrpcClientStub {
    if (!this.protoDescriptor || !this.options) {
      throw new Error('GrpcClientService not configured. Use GrpcClientModule.forRoot() first.');
    }

    const pkg = this.options.package;
    const pkgObj = this.protoDescriptor[pkg] as
      | Record<string, new (url: string, creds: grpc.ChannelCredentials) => GrpcClientStub>
      | undefined;

    if (!pkgObj) {
      throw new Error(
        `Package "${pkg}" not found in proto descriptor. Check your proto file and package name.`
      );
    }

    const ServiceConstructor = pkgObj[serviceName];
    if (!ServiceConstructor) {
      throw new Error(
        `Service "${serviceName}" not found in package "${pkg}". Check your proto file.`
      );
    }

    const resolveAndGetStub = (resolvedUrl: string): GrpcClientStub => {
      let urlMap = this.stubCache.get(serviceName);
      if (!urlMap) {
        urlMap = new Map();
        this.stubCache.set(serviceName, urlMap);
      }

      let stub = urlMap.get(resolvedUrl);
      if (!stub) {
        const credentials = this.options!.credentials ?? grpc.credentials.createInsecure();
        stub = new ServiceConstructor(resolvedUrl, credentials) as unknown as GrpcClientStub;
        urlMap.set(resolvedUrl, stub);
        logger.debug('Created gRPC client stub', { serviceName, url: resolvedUrl });
      }
      return stub;
    };

    if (url) {
      return resolveAndGetStub(url);
    }

    if (this.options.discovery) {
      throw new Error(
        'Discovery mode requires async getClientAsync(). Use getClientAsync(serviceName) when Discovery is configured.'
      );
    }

    const defaultUrl = this.options.defaultUrl;
    if (!defaultUrl) {
      throw new Error(
        'No URL provided. Pass url to getClient() or set defaultUrl in GrpcClientModule.forRoot().'
      );
    }
    return resolveAndGetStub(defaultUrl);
  }

  /**
   * Get a gRPC client stub asynchronously.
   * Use this when Discovery is configured, as URL resolution is async.
   *
   * @param serviceName - Service name as defined in proto (e.g. 'ProductService')
   * @param url - Optional URL. When omitted and Discovery is configured, resolves from Discovery.
   * @returns Promise resolving to gRPC client stub
   */
  async getClientAsync(serviceName: string, url?: string): Promise<GrpcClientStub> {
    const resolvedUrl = url ?? (await this.resolveUrl(serviceName));
    return this.getClient(serviceName, resolvedUrl);
  }

  /**
   * Close all cached client channels (for graceful shutdown)
   */
  close(): void {
    this.stubCache.clear();
    this.packageDefinition = null;
    this.protoDescriptor = null;
    this.options = null;
    logger.info('gRPC client closed');
  }
}
