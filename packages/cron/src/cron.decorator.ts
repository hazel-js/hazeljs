import 'reflect-metadata';
import { CronOptions } from './cron.types';

/**
 * Metadata key for cron jobs
 */
export const CRON_METADATA_KEY = Symbol('cron:jobs');

/**
 * Decorator to mark a method as a cron job
 * @param options - Cron job options
 */
export function Cron(options: CronOptions): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    // Get existing cron jobs or initialize empty array
    const existingJobs = Reflect.getMetadata(CRON_METADATA_KEY, target.constructor) || [];

    // Add this job to the list
    const jobMetadata = {
      target,
      methodName: propertyKey.toString(),
      options: {
        name: options.name || `${target.constructor.name}.${propertyKey.toString()}`,
        ...options,
      },
    };

    existingJobs.push(jobMetadata);

    // Store metadata
    Reflect.defineMetadata(CRON_METADATA_KEY, existingJobs, target.constructor);
  };
}

/**
 * Get cron job metadata from a class
 */
export function getCronMetadata(target: object): Array<{
  target: object;
  methodName: string;
  options: CronOptions;
}> {
  return Reflect.getMetadata(CRON_METADATA_KEY, target.constructor) || [];
}
