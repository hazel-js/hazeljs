import 'reflect-metadata';

/**
 * Metadata key for queue processors
 */
export const QUEUE_PROCESSOR_METADATA_KEY = Symbol('queue:processors');

/**
 * Options for the @Queue decorator
 */
export interface QueueDecoratorOptions {
  /** Queue name (defaults to class.methodName) */
  name?: string;
}

/**
 * Decorator to mark a method as a queue job processor
 * The method will be invoked when jobs are processed from the named queue
 *
 * @param queueName - Name of the queue this processor handles
 * @param options - Optional processor configuration
 */
export function Queue(queueName: string, options?: QueueDecoratorOptions): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    const existing = Reflect.getMetadata(QUEUE_PROCESSOR_METADATA_KEY, target.constructor) || [];

    const metadata = {
      queueName,
      methodName: propertyKey.toString(),
      target,
      options: options || {},
    };

    existing.push(metadata);
    Reflect.defineMetadata(QUEUE_PROCESSOR_METADATA_KEY, existing, target.constructor);
  };
}

/**
 * Get queue processor metadata from a class
 */
export function getQueueProcessorMetadata(target: object): Array<{
  queueName: string;
  methodName: string;
  target: object;
  options: QueueDecoratorOptions;
}> {
  return Reflect.getMetadata(QUEUE_PROCESSOR_METADATA_KEY, target.constructor) || [];
}
