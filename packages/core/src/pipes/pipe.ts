import { RequestContext } from '../request-context';
import logger from '../logger';

export interface PipeTransform<T = unknown, R = unknown> {
  transform(value: T, context: RequestContext): R | Promise<R>;
}

export interface PipeMetadata {
  type: Type<PipeTransform>;
  options?: unknown;
}

export interface ValidationPipeOptions {
  whitelist?: boolean;
  forbidNonWhitelisted?: boolean;
  transform?: boolean;
  validateCustomDecorators?: boolean;
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: Array<{
      property: string;
      constraints: Record<string, string>;
      value?: unknown;
    }>
  ) {
    super(message);
    this.name = 'ValidationError';
  }

  toJSON(): {
    message: string;
    errors: Array<{
      field: string;
      messages: string[];
      value: unknown;
    }>;
  } {
    return {
      message: this.message,
      errors: this.errors.map((error) => ({
        field: error.property,
        messages: Object.values(error.constraints),
        value: error.value,
      })),
    };
  }
}

export class ParseIntPipe implements PipeTransform<string, number> {
  transform(value: string, context: RequestContext): number {
    logger.debug(`ParseIntPipe received value: ${value}`);
    if (!value) {
      throw new ValidationError('Value is required', [
        {
          value,
          property: context.params?.id ? 'id' : 'value',
          constraints: { isNotEmpty: 'value must not be empty' },
        },
      ]);
    }
    const parsed = parseInt(value, 10);
    logger.debug(`ParseIntPipe parsed value: ${parsed}`);
    if (isNaN(parsed)) {
      throw new ValidationError('Invalid integer value', [
        {
          value,
          property: context.params?.id ? 'id' : 'value',
          constraints: { isInt: 'value must be an integer' },
        },
      ]);
    }
    return parsed;
  }
}

export class ParseFloatPipe implements PipeTransform<string, number> {
  transform(value: string, context: RequestContext): number {
    logger.debug('Parsing float:', value);
    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      throw new ValidationError('Invalid float value', [
        {
          value,
          property: context.params?.id ? 'id' : 'value',
          constraints: { isFloat: 'value must be a float' },
        },
      ]);
    }
    return parsed;
  }
}

export class ParseBoolPipe implements PipeTransform<string, boolean> {
  transform(value: string, context: RequestContext): boolean {
    logger.debug('Parsing boolean:', value);
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new ValidationError('Invalid boolean value', [
      {
        value,
        property: context.params?.id ? 'id' : 'value',
        constraints: { isBoolean: 'value must be a boolean' },
      },
    ]);
  }
}

export class DefaultValuePipe<T = unknown> implements PipeTransform<T | undefined, T> {
  constructor(private defaultValue: T) {}

  transform(value: T | undefined): T {
    logger.debug('Applying default value:', { value, defaultValue: this.defaultValue });
    return value === undefined ? this.defaultValue : value;
  }
}

export type Type<T = unknown> = new (...args: unknown[]) => T;
