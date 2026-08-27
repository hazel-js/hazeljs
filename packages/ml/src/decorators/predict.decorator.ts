import 'reflect-metadata';
import logger from '@hazeljs/core';

const PREDICT_METADATA_KEY = 'hazel:ml:predict';

export interface PredictOptions {
  batch?: boolean;
  endpoint?: string;
}

/**
 * @Predict decorator - Mark a method as the inference endpoint
 *
 * @example
 * ```typescript
 * @Predict({ endpoint: '/predict' })
 * async predict(text: string) {
 *   return { sentiment: 'positive', confidence: 0.92 };
 * }
 * ```
 */
export function Predict(options: PredictOptions = {}): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const metadata: PredictOptions = {
      batch: false,
      endpoint: '/predict',
      ...options,
    };

    Reflect.defineMetadata(PREDICT_METADATA_KEY, metadata, target, propertyKey);
    logger.debug(`Predict decorator applied to ${target.constructor.name}.${String(propertyKey)}`);

    return descriptor;
  };
}

export function getPredictMetadata(
  target: object,
  propertyKey: string | symbol
): PredictOptions | undefined {
  return Reflect.getMetadata(PREDICT_METADATA_KEY, target, propertyKey);
}

export function hasPredictMetadata(target: object, propertyKey: string | symbol): boolean {
  return Reflect.hasMetadata(PREDICT_METADATA_KEY, target, propertyKey);
}
