import 'reflect-metadata';
import logger from '@hazeljs/core';
import type { PipelineStepMetadata } from '../data.types';

const TRANSFORM_METADATA_KEY = 'hazel:data:transform';

export interface TransformOptions {
  step: number;
  name: string;
}

/**
 * @Transform decorator - Data transformation with step ordering
 * Output from step N feeds as input to step N+1
 *
 * @example
 * ```typescript
 * @Transform({ step: 1, name: 'normalize' })
 * async normalize(data: any) {
 *   return { ...data, email: data.email.toLowerCase() };
 * }
 * ```
 */
export function Transform(options: TransformOptions): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const metadata: PipelineStepMetadata = {
      step: options.step,
      name: options.name,
      type: 'transform',
    };
    Reflect.defineMetadata(TRANSFORM_METADATA_KEY, metadata, target, propertyKey);
    logger.debug(
      `Transform decorator applied: ${target.constructor.name}.${String(propertyKey)} step=${options.step}`
    );
    return descriptor;
  };
}

export function getTransformMetadata(
  target: object,
  propertyKey: string | symbol
): PipelineStepMetadata | undefined {
  return Reflect.getMetadata(TRANSFORM_METADATA_KEY, target, propertyKey);
}
