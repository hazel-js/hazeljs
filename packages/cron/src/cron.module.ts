import { HazelModule } from '@hazeljs/core';
import { CronService } from './cron.service';
import { getCronMetadata } from './cron.decorator';
import { Container } from '@hazeljs/core';
import logger from '@hazeljs/core';

/**
 * Cron module options
 */
export interface CronModuleOptions {
  /**
   * Whether this is a global module
   * @default true
   */
  isGlobal?: boolean;
}

/**
 * Cron module for HazelJS
 * Provides scheduled job execution using cron expressions
 */
@HazelModule({
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {
  /**
   * Configure cron module
   */
  static forRoot(options: CronModuleOptions = {}): {
    module: typeof CronModule;
    providers: Array<typeof CronService>;
    exports: Array<typeof CronService>;
    global: boolean;
  } {
    const { isGlobal = true } = options;

    logger.info('Configuring cron module...');

    return {
      module: CronModule,
      providers: [CronService],
      exports: [CronService],
      global: isGlobal,
    };
  }

  /**
   * Manually register cron jobs from a provider instance
   * Call this method after the provider has been instantiated
   *
   * @example
   * ```typescript
   * const taskService = container.resolve(TaskService);
   * CronModule.registerJobsFromProvider(taskService);
   * ```
   */
  static registerJobsFromProvider(provider: object): void {
    try {
      const container = Container.getInstance();
      const cronService = container.resolve(CronService);

      if (!cronService) {
        logger.warn('CronService not found in DI container');
        return;
      }

      const metadata = getCronMetadata(provider);

      if (metadata && metadata.length > 0) {
        for (const job of metadata) {
          const instance = provider as Record<string, () => void | Promise<void>>;
          const callback = instance[job.methodName];

          if (typeof callback === 'function') {
            cronService.registerJob(
              job.options.name || job.methodName,
              job.options.cronTime,
              callback.bind(instance),
              job.options
            );
            logger.info(`Registered cron job: ${job.options.name || job.methodName}`);
          }
        }
      }
    } catch (error) {
      logger.error('Error registering cron jobs from provider:', error);
    }
  }
}
