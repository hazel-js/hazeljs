import { Injectable } from '@hazeljs/core';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import type { PackageDefinition } from '@grpc/proto-loader';
import logger from '@hazeljs/core';
import type { GrpcModuleOptions } from './grpc.types';
import { getGrpcMethodMetadata } from './decorators/grpc-method.decorator';
import { Container } from '@hazeljs/core';

type UnaryHandler = (
  call: grpc.ServerUnaryCall<unknown, unknown>,
  callback: grpc.sendUnaryData<unknown>
) => void;

/**
 * gRPC Server service - manages gRPC server lifecycle and RPC handler registration
 */
@Injectable()
export class GrpcServer {
  private server: grpc.Server | null = null;
  private packageDefinition: PackageDefinition | null = null;
  private protoDescriptor: Record<string, unknown> | null = null;
  private options: GrpcModuleOptions | null = null;
  private handlerMap: Map<string, Map<string, (data: unknown) => Promise<unknown> | unknown>> =
    new Map();

  /**
   * Configure the server with proto path and options
   */
  configure(options: GrpcModuleOptions): void {
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
    logger.info('gRPC server configured', {
      package: options.package,
      url: options.url ?? '0.0.0.0:50051',
    });
  }

  /**
   * Register RPC handlers from a provider instance (with @GrpcMethod decorators)
   */
  registerHandlersFromProvider(provider: object): void {
    const metadataList = getGrpcMethodMetadata(provider);

    for (const meta of metadataList) {
      const instance = provider as Record<string, (data: unknown) => Promise<unknown> | unknown>;
      const callback = instance[meta.methodName];

      if (typeof callback !== 'function') {
        logger.warn(
          `@GrpcMethod: method "${meta.methodName}" not found on ${provider.constructor?.name}`
        );
        continue;
      }

      const boundCallback = callback.bind(provider);
      const handler = (data: unknown): Promise<unknown> | unknown => boundCallback(data);

      let serviceMap = this.handlerMap.get(meta.service);
      if (!serviceMap) {
        serviceMap = new Map();
        this.handlerMap.set(meta.service, serviceMap);
      }
      serviceMap.set(meta.method, handler);
      logger.debug(`Registered gRPC handler: ${meta.service}/${meta.method}`);
    }
  }

  /**
   * Register handlers from multiple provider classes (resolved from DI container)
   */
  registerHandlersFromProviders(providerClasses: (new (...args: unknown[]) => object)[]): void {
    const container = Container.getInstance();
    for (const Cls of providerClasses) {
      const instance = container.resolve(Cls);
      if (instance) {
        this.registerHandlersFromProvider(instance);
      } else {
        logger.warn(`Provider ${Cls.name} not found in DI container`);
      }
    }
  }

  /**
   * Start the gRPC server and bind to the configured URL
   */
  async start(): Promise<void> {
    if (!this.options || !this.protoDescriptor) {
      throw new Error(
        'GrpcServer not configured. Call configure() or use GrpcModule.forRoot() first.'
      );
    }

    const pkg = this.options.package;
    const pkgObj = this.protoDescriptor[pkg] as
      | Record<string, { service: grpc.ServiceDefinition }>
      | undefined;

    if (!pkgObj) {
      throw new Error(
        `Package "${pkg}" not found in proto descriptor. Check your proto file and package name.`
      );
    }

    this.server = new grpc.Server();

    for (const [serviceName, serviceMap] of this.handlerMap) {
      const serviceDef = pkgObj[serviceName];
      if (!serviceDef?.service) {
        logger.warn(`Service "${serviceName}" not found in proto. Skipping.`);
        continue;
      }

      const implementation: Record<string, UnaryHandler> = {};
      for (const [methodName, handler] of serviceMap) {
        implementation[methodName] = (
          call: grpc.ServerUnaryCall<unknown, unknown>,
          callback: grpc.sendUnaryData<unknown>
        ): void => {
          const request = call.request;
          try {
            const result = handler(request);
            if (result instanceof Promise) {
              result
                .then((r) => callback(null, r))
                .catch((err) => callback(err as grpc.ServiceError, null));
            } else {
              callback(null, result);
            }
          } catch (err) {
            callback(err as grpc.ServiceError, null);
          }
        };
      }

      this.server.addService(serviceDef.service, implementation);
      logger.info(`Added gRPC service: ${serviceName}`);
    }

    const url = this.options.url ?? '0.0.0.0:50051';

    return new Promise((resolve, reject) => {
      this.server!.bindAsync(url, grpc.ServerCredentials.createInsecure(), (err: Error | null) => {
        if (err) {
          logger.error('gRPC server bind failed:', err);
          reject(err);
          return;
        }
        logger.info(`gRPC server listening on ${url}`);
        resolve();
      });
    });
  }

  /**
   * Shutdown the gRPC server gracefully
   */
  async close(): Promise<void> {
    if (!this.server) return;

    return new Promise((resolve) => {
      this.server!.tryShutdown((err) => {
        if (err) {
          logger.warn('gRPC server graceful shutdown failed, forcing:', err);
          this.server!.forceShutdown();
        }
        this.server = null;
        this.packageDefinition = null;
        this.protoDescriptor = null;
        this.handlerMap.clear();
        logger.info('gRPC server closed');
        resolve();
      });
    });
  }

  /**
   * Get the underlying gRPC Server instance (for advanced use)
   */
  getServer(): grpc.Server | null {
    return this.server;
  }
}
