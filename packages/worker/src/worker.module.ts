import { HazelModule, Inject, Injectable } from '@hazeljs/core';
import type { DynamicModule } from '@hazeljs/core';
import path from 'path';
import { WorkerRegistry } from './worker.registry';
import { WorkerExecutor } from './worker.executor';
import { WorkerPoolManager, getDefaultPoolSize } from './worker.pool';
import { WorkerTaskDiscovery } from './worker.discovery';
import type { WorkerModuleOptions } from './worker.types';
import logger from '@hazeljs/core';

export const WORKER_MODULE_OPTIONS = Symbol('WORKER_MODULE_OPTIONS');

/**
 * Bootstrap service that coordinates registry population and pool startup.
 * Ensures discovery runs before pool starts.
 */
@Injectable()
class WorkerBootstrapService {
  constructor(
    @Inject(WORKER_MODULE_OPTIONS) private readonly options: WorkerModuleOptions,
    private readonly registry: WorkerRegistry,
    private readonly discovery: WorkerTaskDiscovery,
    private readonly pool: WorkerPoolManager
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.discovery.onApplicationBootstrap({} as never, this.options);

    const taskNames = this.registry.getTaskNames();
    if (taskNames.length === 0) {
      logger.warn(
        'WorkerModule: No tasks registered. Provide taskRegistry or taskDirectory and add @WorkerTask classes as providers.'
      );
    }

    await this.pool.start();
  }
}

/**
 * Worker module for HazelJS - CPU-intensive task offloading via worker threads.
 *
 * @example
 * ```ts
 * @HazelModule({
 *   imports: [
 *     WorkerModule.forRoot({
 *       taskRegistry: {
 *         'generate-embeddings': join(__dirname, 'dist/tasks/generate-embeddings.task.js'),
 *       },
 *       poolSize: 4,
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@HazelModule({
  providers: [WorkerRegistry, WorkerTaskDiscovery],
  exports: [WorkerExecutor, WorkerRegistry],
})
export class WorkerModule {
  /**
   * Configure worker module with options
   */
  static forRoot(options: WorkerModuleOptions = {}): DynamicModule {
    const {
      poolSize = getDefaultPoolSize(),
      timeout = 30000,
      isGlobal = true,
      gracefulShutdownTimeout = 10000,
    } = options;

    logger.info('Configuring worker module...');

    const bootstrapPath = path.join(__dirname, 'worker-bootstrap.js');

    const poolOptions = {
      poolSize,
      defaultTimeout: timeout,
      bootstrapPath,
      gracefulShutdownTimeout,
    };

    const optionsProvider = {
      provide: WORKER_MODULE_OPTIONS,
      useValue: options,
    };

    const registryProvider = {
      provide: WorkerRegistry,
      useFactory: (): WorkerRegistry => {
        const registry = new WorkerRegistry();
        if (options.taskRegistry && Object.keys(options.taskRegistry).length > 0) {
          registry.registerFromMap(options.taskRegistry, { timeout: options.timeout });
        }
        return registry;
      },
    };

    return {
      module: WorkerModule,
      providers: [
        registryProvider,
        WorkerTaskDiscovery,
        optionsProvider,
        {
          provide: WorkerPoolManager,
          useFactory: (registry: WorkerRegistry): WorkerPoolManager => {
            return new WorkerPoolManager(registry, poolOptions);
          },
          inject: [WorkerRegistry],
        },
        WorkerExecutor,
        WorkerBootstrapService,
      ],
      exports: [WorkerExecutor, WorkerRegistry],
      global: isGlobal,
    };
  }

  /**
   * Async configuration (for ConfigService integration, etc.)
   */
  static async forRootAsync(
    optionsFactory: () => Promise<WorkerModuleOptions> | WorkerModuleOptions
  ): Promise<DynamicModule> {
    const options = await Promise.resolve(
      typeof optionsFactory === 'function' ? optionsFactory() : optionsFactory
    );
    return WorkerModule.forRoot(options);
  }
}
