import { HazelModule } from '@hazeljs/core';
import { Container } from '@hazeljs/core';
import logger from '@hazeljs/core';
import { GrpcServer } from './grpc.server';
import type { GrpcModuleConfig, GrpcModuleOptions } from './grpc.types';

/**
 * gRPC module for HazelJS
 * Provides gRPC server support with decorator-based RPC handlers
 *
 * @example
 * ```typescript
 * // app.module.ts
 * @HazelModule({
 *   imports: [
 *     GrpcModule.forRoot({
 *       protoPath: join(__dirname, 'hero.proto'),
 *       package: 'hero',
 *       url: '0.0.0.0:50051',
 *     })
 *   ],
 *   providers: [HeroGrpcController],
 * })
 * export class AppModule {}
 * ```
 */
@HazelModule({
  providers: [],
  exports: [],
})
export class GrpcModule {
  /**
   * Configure gRPC module with options
   */
  static forRoot(options: GrpcModuleConfig): {
    module: typeof GrpcModule;
    providers: Array<{
      provide: typeof GrpcServer;
      useFactory: () => GrpcServer;
    }>;
    exports: Array<typeof GrpcServer>;
    global: boolean;
  } {
    const { isGlobal = true, ...grpcOptions } = options;

    logger.info('Configuring gRPC module...');

    const grpcServerProvider = {
      provide: GrpcServer,
      useFactory: (): GrpcServer => {
        const server = new GrpcServer();
        server.configure(grpcOptions);
        return server;
      },
    };

    return {
      module: GrpcModule,
      providers: [grpcServerProvider],
      exports: [GrpcServer],
      global: isGlobal,
    };
  }

  /**
   * Configure gRPC module asynchronously
   */
  static forRootAsync(options: {
    useFactory: (...args: unknown[]) => Promise<GrpcModuleOptions> | GrpcModuleOptions;
    inject?: unknown[];
  }): {
    module: typeof GrpcModule;
    providers: Array<{
      provide: string | typeof GrpcServer;
      useFactory: unknown;
      inject?: unknown[];
    }>;
    exports: Array<typeof GrpcServer>;
    global: boolean;
  } {
    return {
      module: GrpcModule,
      providers: [
        {
          provide: 'GRPC_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: GrpcServer,
          useFactory: (grpcOptions: GrpcModuleOptions): GrpcServer => {
            const server = new GrpcServer();
            server.configure(grpcOptions);
            return server;
          },
          inject: ['GRPC_OPTIONS'],
        },
      ],
      exports: [GrpcServer],
      global: true,
    };
  }

  /**
   * Register gRPC handlers from a provider instance (with @GrpcMethod decorators)
   *
   * @example
   * ```typescript
   * const heroController = container.resolve(HeroGrpcController);
   * GrpcModule.registerHandlersFromProvider(heroController);
   * ```
   */
  static registerHandlersFromProvider(provider: object): void {
    try {
      const container = Container.getInstance();
      const grpcServer = container.resolve(GrpcServer);

      if (!grpcServer) {
        logger.warn('GrpcServer not found in DI container');
        return;
      }

      grpcServer.registerHandlersFromProvider(provider);
    } catch (error) {
      logger.error('Error registering gRPC handlers from provider:', error);
    }
  }

  /**
   * Register gRPC handlers from multiple provider classes
   * Resolves each from the container and registers their @GrpcMethod handlers
   *
   * @example
   * ```typescript
   * GrpcModule.registerHandlersFromProviders([HeroGrpcController, UserGrpcController]);
   * ```
   */
  static registerHandlersFromProviders(
    providerClasses: (new (...args: unknown[]) => object)[]
  ): void {
    const container = Container.getInstance();
    const grpcServer = container.resolve(GrpcServer);

    if (!grpcServer) {
      logger.warn('GrpcServer not found in DI container');
      return;
    }

    grpcServer.registerHandlersFromProviders(providerClasses);
  }
}
