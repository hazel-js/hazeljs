import 'reflect-metadata';
import logger from '@hazeljs/core';

const TRAIN_METADATA_KEY = 'hazel:ml:train';

export interface TrainOptions {
  pipeline?: string;
  batchSize?: number;
  epochs?: number;
}

/**
 * @Train decorator - Mark a method as the training pipeline
 *
 * @example
 * ```typescript
 * @Train({ pipeline: 'default', epochs: 10 })
 * async train(data: TrainingData) {
 *   return { accuracy: 0.95, loss: 0.05 };
 * }
 * ```
 */
export function Train(options: TrainOptions = {}): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const metadata: TrainOptions = {
      pipeline: 'default',
      batchSize: 32,
      epochs: 10,
      ...options,
    };

    Reflect.defineMetadata(TRAIN_METADATA_KEY, metadata, target, propertyKey);
    logger.debug(`Train decorator applied to ${target.constructor.name}.${String(propertyKey)}`);

    return descriptor;
  };
}

export function getTrainMetadata(
  target: object,
  propertyKey: string | symbol
): TrainOptions | undefined {
  return Reflect.getMetadata(TRAIN_METADATA_KEY, target, propertyKey);
}

export function hasTrainMetadata(target: object, propertyKey: string | symbol): boolean {
  return Reflect.hasMetadata(TRAIN_METADATA_KEY, target, propertyKey);
}
