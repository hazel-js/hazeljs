import { HazelModule } from '@hazeljs/core';
import logger from '@hazeljs/core';
import { GrpcClientService } from './grpc.client';
import type { GrpcClientModuleConfig } from './grpc.client.types';

/**
 * gRPC Client module for HazelJS
 * Provides gRPC client support for calling remote gRPC services
 *
 * @example
 * ```typescript
 * // Static URL
 * @HazelModule({
 *   imports: [
 *     GrpcClientModule.forRoot({
 *       protoPath: join(__dirname, 'product.proto'),
 *       package: 'catalog',
 *       defaultUrl: 'localhost:50051',
 *     }),
 *   ],
 *   providers: [OrderService],
 * })
 * export class AppModule {}
 *
 * // With Discovery
 * GrpcClientModule.forRoot({
 *   protoPath: join(__dirname, 'product.proto'),
 *   package: 'catalog',
 *   discovery: {
 *     client: discoveryClient,
 *     serviceName: 'product-service',
 *     loadBalancingStrategy: 'round-robin',
 *     filter: { metadata: { protocol: 'grpc' } },
 *   },
 * });
 * ```
 */
@HazelModule({
  providers: [],
  exports: [],
})
export class GrpcClientModule {
  /**
   * Configure gRPC client module with options
   */
  static forRoot(options: GrpcClientModuleConfig): {
    module: typeof GrpcClientModule;
    providers: Array<{
      provide: typeof GrpcClientService;
      useFactory: () => GrpcClientService;
    }>;
    exports: Array<typeof GrpcClientService>;
    global: boolean;
  } {
    const { isGlobal = true, ...clientOptions } = options;

    logger.info('Configuring gRPC client module...');

    const grpcClientProvider = {
      provide: GrpcClientService,
      useFactory: (): GrpcClientService => {
        const client = new GrpcClientService();
        client.configure(clientOptions);
        return client;
      },
    };

    return {
      module: GrpcClientModule,
      providers: [grpcClientProvider],
      exports: [GrpcClientService],
      global: isGlobal,
    };
  }

  /**
   * Configure gRPC client module asynchronously
   */
  static forRootAsync(options: {
    useFactory: (...args: unknown[]) => Promise<GrpcClientModuleConfig> | GrpcClientModuleConfig;
    inject?: unknown[];
  }): {
    module: typeof GrpcClientModule;
    providers: Array<{
      provide: string | typeof GrpcClientService;
      useFactory: unknown;
      inject?: unknown[];
    }>;
    exports: Array<typeof GrpcClientService>;
    global: boolean;
  } {
    return {
      module: GrpcClientModule,
      providers: [
        {
          provide: 'GRPC_CLIENT_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: GrpcClientService,
          useFactory: (clientOptions: GrpcClientModuleConfig): GrpcClientService => {
            const client = new GrpcClientService();
            client.configure(clientOptions);
            return client;
          },
          inject: ['GRPC_CLIENT_OPTIONS'],
        },
      ],
      exports: [GrpcClientService],
      global: true,
    };
  }
}
