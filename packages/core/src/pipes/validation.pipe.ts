import { PipeTransform, ValidationError } from './pipe';
import logger from '../logger';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { RequestContext } from '../request-context';

function isConstructor(f: unknown): f is new () => object {
  return typeof f === 'function';
}

export class ValidationPipe implements PipeTransform {
  async transform(value: unknown, context: RequestContext): Promise<unknown> {
    logger.debug('ValidationPipe.transform - Input value:', value);
    logger.debug('ValidationPipe.transform - Context:', context);

    // Get DTO type from context
    const dtoType = context.dtoType;
    logger.debug('ValidationPipe.transform - DTO type:', (dtoType as { name?: string })?.name);

    if (!isConstructor(dtoType)) {
      logger.debug('ValidationPipe.transform - No valid DTO type provided, returning value as is');
      return value;
    }

    try {
      // Ensure value is an object before transformation
      if (typeof value !== 'object' || value === null) {
        throw new ValidationError('Invalid input: expected an object', [
          {
            property: 'body',
            constraints: { isObject: 'Input must be an object' },
            value,
          },
        ]);
      }

      // Transform plain object to class instance
      const instance = plainToClass(dtoType, value as object);
      logger.debug('ValidationPipe.transform - Transformed instance:', instance);

      // Validate instance
      const errors = await validate(instance as object);
      if (errors.length > 0) {
        logger.error('ValidationPipe.transform - Validation failed:', errors);
        const formattedErrors = errors.map((error) => ({
          property: error.property,
          constraints: error.constraints || {},
          value: error.value,
        }));
        const validationError = new ValidationError('Validation failed', formattedErrors);
        logger.error('ValidationPipe.transform - Throwing validation error:', validationError);
        throw validationError;
      }

      logger.debug('ValidationPipe.transform - Validation successful');
      return instance;
    } catch (error) {
      logger.error('ValidationPipe.transform - Error during transformation:', error);
      throw error;
    }
  }
}
