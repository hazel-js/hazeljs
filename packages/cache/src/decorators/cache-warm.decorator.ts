import 'reflect-metadata';
import * as cron from 'node-cron';
import { CacheWarmOptions } from '../cache.types';
import logger from '@hazeljs/core';

const CACHE_WARM_METADATA_KEY = 'hazel:cache:warm';

/**
 * Cache warming manager for handling scheduled warming
 */
class CacheWarmingManager {
  private static instance: CacheWarmingManager;
  private scheduledTasks = new Map<string, cron.ScheduledTask>();
  private warmingJobs = new Map<string, CacheWarmOptions & { instance: unknown }>();

  static getInstance(): CacheWarmingManager {
    if (!CacheWarmingManager.instance) {
      CacheWarmingManager.instance = new CacheWarmingManager();
    }
    return CacheWarmingManager.instance;
  }

  addJob(id: string, options: CacheWarmOptions, instance: unknown): void {
    this.warmingJobs.set(id, { ...options, instance });

    if (options.schedule) {
      this.scheduleJob(id, options, instance);
    }
  }

  private scheduleJob(id: string, options: CacheWarmOptions, instance: unknown): void {
    if (options.schedule && !cron.validate(options.schedule)) {
      logger.error(`Invalid cron schedule: ${options.schedule}`);
      return;
    }

    if (options.schedule) {
      const task = cron.schedule(
        options.schedule,
        async () => {
          await this.executeWarmUp(id, options, instance);
        },
        {
          scheduled: false,
        }
      );

      this.scheduledTasks.set(id, task);
      task.start();

      logger.info(`Cache warming scheduled: ${id} with schedule '${options.schedule}'`);
    }
  }

  async executeWarmUp(id: string, options: CacheWarmOptions, instance: unknown): Promise<void> {
    try {
      // Check condition if provided
      if (options.condition && !(await this.checkCondition(options.condition, instance))) {
        logger.debug(`Cache warming condition not met: ${id}`);
        return;
      }

      logger.info(`Starting cache warming: ${id} (${options.keys.length} keys)`);

      const cacheService = getCacheService(instance);
      if (!cacheService) {
        logger.warn(`Cache service not found for warming job: ${id}`);
        return;
      }

      if (options.parallel) {
        // Warm up in parallel
        const promises = options.keys.map(async (key) => {
          try {
            const data = await options.fetcher!.call(instance, key);
            if (data !== null && data !== undefined) {
              await cacheService.set(key, data, options.ttl);
              logger.debug(`Warmed cache key: ${key}`);
            }
          } catch (error) {
            logger.error(`Failed to warm cache key ${key}:`, error);
          }
        });

        await Promise.all(promises);
      } else {
        // Warm up sequentially
        for (const key of options.keys) {
          try {
            const data = await options.fetcher!.call(instance, key);
            if (data !== null && data !== undefined) {
              await cacheService.set(key, data, options.ttl);
              logger.debug(`Warmed cache key: ${key}`);
            }
          } catch (error) {
            logger.error(`Failed to warm cache key ${key}:`, error);
          }
        }
      }

      logger.info(`Cache warming completed: ${id}`);
    } catch (error) {
      logger.error(`Cache warming failed for ${id}:`, error);
    }
  }

  private async checkCondition(condition: string, _instance: unknown): Promise<boolean> {
    // Simple condition checks - can be extended
    switch (condition) {
      case 'low-traffic': {
        // Check if current time is during low traffic hours (e.g., 2 AM - 4 AM)
        const hour = new Date().getHours();
        return hour >= 2 && hour <= 4;
      }

      case 'development':
        return process.env.NODE_ENV === 'development';

      case 'production':
        return process.env.NODE_ENV === 'production';

      default:
        logger.warn(`Unknown warming condition: ${condition}`);
        return true;
    }
  }

  async warmUpNow(id: string): Promise<void> {
    const job = this.warmingJobs.get(id);
    if (!job) {
      throw new Error(`Warming job not found: ${id}`);
    }

    await this.executeWarmUp(id, job, job.instance);
  }

  removeJob(id: string): void {
    const task = this.scheduledTasks.get(id);
    if (task) {
      task.stop();
      this.scheduledTasks.delete(id);
    }

    this.warmingJobs.delete(id);
    logger.info(`Cache warming job removed: ${id}`);
  }

  listJobs(): string[] {
    return Array.from(this.warmingJobs.keys());
  }

  destroy(): void {
    // Stop all scheduled tasks
    for (const task of this.scheduledTasks.values()) {
      task.stop();
    }
    this.scheduledTasks.clear();
    this.warmingJobs.clear();
  }
}

/**
 * Cache Warm decorator for automatic cache warming
 */
// Uses a widened return type to support both legacy and standard decorators.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CacheWarm(options: CacheWarmOptions): any {
  type WrappedMethod = (this: unknown, ...args: unknown[]) => unknown | Promise<unknown>;

  const defaults: CacheWarmOptions = {
    ttl: 3600,
    parallel: true,
    ...options,
  };

  const createWrappedMethod = (
    method: WrappedMethod,
    ownerName: string,
    propertyKey: string | symbol
  ): WrappedMethod => {
    return async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const jobId = `${ownerName}.${String(propertyKey)}`;
      const warmingManager = CacheWarmingManager.getInstance();
      warmingManager.addJob(jobId, defaults, this);
      return await method.apply(this, args);
    };
  };

  return function (...decoratorArgs: unknown[]): unknown {
    // Legacy decorators: (target, propertyKey, descriptor)
    if (decoratorArgs.length === 3) {
      const [target, propertyKey, descriptor] = decoratorArgs as [
        object,
        string | symbol,
        PropertyDescriptor,
      ];
      const ownerName = target?.constructor?.name ?? 'UnknownClass';

      Reflect.defineMetadata(CACHE_WARM_METADATA_KEY, defaults, target, propertyKey);
      logger.debug(`CacheWarm decorator applied to ${ownerName}.${String(propertyKey)}`);

      const originalMethod = descriptor?.value;
      if (typeof originalMethod === 'function') {
        descriptor.value = createWrappedMethod(originalMethod, ownerName, propertyKey);
      }

      return descriptor;
    }

    // Standard decorators: (value, context)
    if (decoratorArgs.length === 2) {
      const [value, context] = decoratorArgs as [WrappedMethod, ClassMethodDecoratorContext];
      if (context.kind !== 'method') {
        return value;
      }

      return createWrappedMethod(value, 'UnknownClass', context.name);
    }

    return undefined;
  };
}

/**
 * Get cache warm metadata from a method
 */
export function getCacheWarmMetadata(
  target: object,
  propertyKey: string | symbol
): CacheWarmOptions | undefined {
  return Reflect.getMetadata(CACHE_WARM_METADATA_KEY, target, propertyKey);
}

/**
 * Check if a method has cache warm metadata
 */
export function hasCacheWarmMetadata(target: object, propertyKey: string | symbol): boolean {
  return Reflect.hasMetadata(CACHE_WARM_METADATA_KEY, target, propertyKey);
}

/**
 * Get cache service from instance
 */
function getCacheService(instance: unknown): {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown, ttl?: number) => Promise<unknown>;
} | null {
  // Try common cache service property names
  const maybeInstance = instance as {
    cacheService?: unknown;
    cache?: unknown;
    _cacheService?: unknown;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cacheService: any =
    maybeInstance.cacheService || maybeInstance.cache || maybeInstance._cacheService;

  if (
    cacheService &&
    typeof cacheService.get === 'function' &&
    typeof cacheService.set === 'function'
  ) {
    return cacheService as {
      get: (key: string) => Promise<unknown>;
      set: (key: string, value: unknown, ttl?: number) => Promise<unknown>;
    };
  }

  return null;
}

/**
 * Cache warming utility functions
 */
export class CacheWarmingUtils {
  /**
   * Warm up cache keys immediately
   */
  static async warmUp(jobId: string): Promise<void> {
    const manager = CacheWarmingManager.getInstance();
    await manager.warmUpNow(jobId);
  }

  /**
   * List all warming jobs
   */
  static listJobs(): string[] {
    const manager = CacheWarmingManager.getInstance();
    return manager.listJobs();
  }

  /**
   * Remove a warming job
   */
  static removeJob(jobId: string): void {
    const manager = CacheWarmingManager.getInstance();
    manager.removeJob(jobId);
  }

  /**
   * Destroy all warming jobs
   */
  static destroy(): void {
    const manager = CacheWarmingManager.getInstance();
    manager.destroy();
  }
}

/**
 * CacheWarm decorator factory for easier usage
 */
export function CacheWarmBuilder(
  options: Partial<CacheWarmOptions> & {
    keys: string[];
    fetcher: (key: string) => Promise<unknown>;
  }
) {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor | void {
    return CacheWarm({ ...options })(target, propertyKey, descriptor);
  };
}
