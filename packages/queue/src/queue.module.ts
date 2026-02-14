import { HazelModule } from '@hazeljs/core';
import { QueueService } from './queue.service';
import { getQueueProcessorMetadata } from './queue.decorator';
import { Container } from '@hazeljs/core';
import logger from '@hazeljs/core';
import type { RedisConnectionOptions } from './queue.types';

/**
 * Queue module options
 */
export interface QueueModuleOptions {
  /**
   * Redis connection options for BullMQ
   * Passed to ioredis constructor
   */
  connection: RedisConnectionOptions;
  /**
   * Whether this is a global module
   * @default true
   */
  isGlobal?: boolean;
}

/**
 * Queue module for HazelJS
 * Provides Redis-backed job queues using BullMQ
 */
@HazelModule({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {
  /**
   * Configure queue module with Redis connection
   */
  static forRoot(options: QueueModuleOptions): {
    module: typeof QueueModule;
    providers: Array<{ provide: typeof QueueService; useFactory: () => QueueService }>;
    exports: Array<typeof QueueService>;
    global: boolean;
  } {
    const { connection, isGlobal = true } = options;

    logger.info('Configuring queue module with BullMQ...');

    const queueServiceProvider = {
      provide: QueueService,
      useFactory: (): QueueService => {
        const service = new QueueService();
        service.setConnection(connection);
        return service;
      },
    };

    return {
      module: QueueModule,
      providers: [queueServiceProvider],
      exports: [QueueService],
      global: isGlobal,
    };
  }

  /**
   * Register queue processors from a provider instance
   * Call this after the provider is instantiated and workers are ready
   *
   * Note: For BullMQ workers, you typically need to create Worker instances
   * that call into your processor methods. This helper retrieves metadata
   * for integration with worker setup.
   *
   * @example
   * ```typescript
   * const taskService = container.resolve(TaskService);
   * const metadata = QueueModule.getProcessorMetadata(taskService);
   * // Use metadata to set up BullMQ Workers
   * ```
   */
  static getProcessorMetadata(provider: object): Array<{
    queueName: string;
    methodName: string;
    options: Record<string, unknown>;
  }> {
    const metadata = getQueueProcessorMetadata(provider);
    return metadata.map((m) => ({
      queueName: m.queueName,
      methodName: m.methodName,
      options: m.options as Record<string, unknown>,
    }));
  }

  /**
   * Get QueueService from the container and ensure it has connection configured
   * Useful when using QueueModule without forRoot (e.g. manual connection setup)
   */
  static getQueueService(): QueueService {
    const container = Container.getInstance();
    const service = container.resolve(QueueService);
    if (!service) {
      throw new Error('QueueService not found. Ensure QueueModule is imported.');
    }
    return service;
  }
}
