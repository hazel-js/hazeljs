import { Injectable } from '@hazeljs/core';
import type { BaseSchema } from '../schema/schema';
import type { SchemaValidationError } from '../schema/schema';

export class SchemaValidationException extends Error {
  constructor(
    message: string,
    public readonly errors: SchemaValidationError[]
  ) {
    super(message);
    this.name = 'SchemaValidationException';
  }
}

/**
 * Schema Validator - Validates data against schemas
 */
@Injectable()
export class SchemaValidator {
  validate<T>(schema: BaseSchema<T>, value: unknown): T {
    const result = schema.validate(value);
    if (result.success) {
      return result.data;
    }
    throw new SchemaValidationException(
      `Validation failed: ${result.errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`,
      result.errors
    );
  }

  validateOrThrow<T>(schema: BaseSchema<T>, value: unknown): T {
    return this.validate(schema, value);
  }

  safeValidate<T>(
    schema: BaseSchema<T>,
    value: unknown
  ): { success: true; data: T } | { success: false; errors: SchemaValidationError[] } {
    return schema.validate(value) as
      | { success: true; data: T }
      | { success: false; errors: SchemaValidationError[] };
  }
}
