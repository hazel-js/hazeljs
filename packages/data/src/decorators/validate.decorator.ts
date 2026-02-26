import 'reflect-metadata';
import logger from '@hazeljs/core';
import type { PipelineStepMetadata } from '../data.types';
import type { BaseSchema } from '../schema/schema';

const VALIDATE_METADATA_KEY = 'hazel:data:validate';

export interface ValidateOptions {
  step: number;
  name: string;
  schema: BaseSchema;
}

/**
 * @Validate decorator - Schema validation with step ordering
 * Validates data before passing to next step
 *
 * @example
 * ```typescript
 * @Validate({
 *   step: 2,
 *   name: 'validate',
 *   schema: Schema.object({
 *     email: Schema.string().email(),
 *     age: Schema.number().min(0).max(120),
 *   })
 * })
 * async validate(data: any) {
 *   return data; // Validation happens automatically
 * }
 * ```
 */
export function Validate(options: ValidateOptions): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const metadata: PipelineStepMetadata = {
      step: options.step,
      name: options.name,
      type: 'validate',
      schema: options.schema,
    };
    Reflect.defineMetadata(VALIDATE_METADATA_KEY, metadata, target, propertyKey);
    logger.debug(
      `Validate decorator applied: ${target.constructor.name}.${String(propertyKey)} step=${options.step}`
    );
    return descriptor;
  };
}

export function getValidateMetadata(
  target: object,
  propertyKey: string | symbol
): PipelineStepMetadata | undefined {
  return Reflect.getMetadata(VALIDATE_METADATA_KEY, target, propertyKey);
}
