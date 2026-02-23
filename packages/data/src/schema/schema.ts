/**
 * Schema builder for data validation - fluent API similar to Zod
 */

export interface SchemaValidationError {
  path: string;
  message: string;
}

export type SchemaValidator<T = unknown> = (
  value: unknown
) => { success: true; data: T } | { success: false; errors: SchemaValidationError[] };

// Base schema interface
export interface BaseSchema<T = unknown> {
  _type?: T;
  validate(
    value: unknown
  ): { success: true; data: T } | { success: false; errors: SchemaValidationError[] };
}

// String schema
export interface StringSchema extends BaseSchema<string> {
  email(): StringSchema;
  min(length: number): StringSchema;
  max(length: number): StringSchema;
  uuid(): StringSchema;
  oneOf(values: string[]): StringSchema;
}

// Number schema
export interface NumberSchema extends BaseSchema<number> {
  min(n: number): NumberSchema;
  max(n: number): NumberSchema;
}

// Date schema
export type DateSchema = BaseSchema<Date>;

// Object schema
export interface ObjectSchema<T = Record<string, unknown>> extends BaseSchema<T> {
  shape: Record<string, BaseSchema>;
}

// Schema factory
function createStringSchema(constraints: Array<(v: string) => string | null> = []): StringSchema {
  const validate = (
    value: unknown
  ): { success: true; data: string } | { success: false; errors: SchemaValidationError[] } => {
    if (typeof value !== 'string') {
      return { success: false, errors: [{ path: '', message: 'Expected string' }] };
    }
    for (const c of constraints) {
      const err = c(value);
      if (err) return { success: false, errors: [{ path: '', message: err }] };
    }
    return { success: true, data: value };
  };

  const schema: StringSchema = {
    _type: undefined as unknown as string,
    validate,
    email(): StringSchema {
      return createStringSchema([
        ...constraints,
        (v: string): string | null => {
          const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRe.test(v) ? null : 'Invalid email';
        },
      ]);
    },
    min(length: number): StringSchema {
      return createStringSchema([
        ...constraints,
        (v: string): string | null => (v.length >= length ? null : `Min length ${length}`),
      ]);
    },
    max(length: number): StringSchema {
      return createStringSchema([
        ...constraints,
        (v: string): string | null => (v.length <= length ? null : `Max length ${length}`),
      ]);
    },
    uuid(): StringSchema {
      return createStringSchema([
        ...constraints,
        (v: string): string | null => {
          const uuidRe =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          return uuidRe.test(v) ? null : 'Invalid UUID';
        },
      ]);
    },
    oneOf(values: string[]): StringSchema {
      return createStringSchema([
        ...constraints,
        (v: string): string | null =>
          values.includes(v) ? null : `Must be one of: ${values.join(', ')}`,
      ]);
    },
  };
  return schema;
}

function createNumberSchema(constraints: Array<(v: number) => string | null> = []): NumberSchema {
  const validate = (
    value: unknown
  ): { success: true; data: number } | { success: false; errors: SchemaValidationError[] } => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return { success: false, errors: [{ path: '', message: 'Expected number' }] };
    }
    for (const c of constraints) {
      const err = c(value);
      if (err) return { success: false, errors: [{ path: '', message: err }] };
    }
    return { success: true, data: value };
  };

  return {
    _type: undefined as unknown as number,
    validate,
    min(n: number): NumberSchema {
      return createNumberSchema([
        ...constraints,
        (v: number): string | null => (v >= n ? null : `Min ${n}`),
      ]);
    },
    max(n: number): NumberSchema {
      return createNumberSchema([
        ...constraints,
        (v: number): string | null => (v <= n ? null : `Max ${n}`),
      ]);
    },
  };
}

function createDateSchema(): DateSchema {
  return {
    _type: undefined as unknown as Date,
    validate(
      value: unknown
    ): { success: true; data: Date } | { success: false; errors: SchemaValidationError[] } {
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return { success: true, data: value };
      }
      if (typeof value === 'string' || typeof value === 'number') {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) return { success: true, data: d };
      }
      return { success: false, errors: [{ path: '', message: 'Expected date' }] };
    },
  };
}

function createObjectSchema(shape: Record<string, BaseSchema>): ObjectSchema {
  const validate = (
    value: unknown
  ):
    | { success: true; data: Record<string, unknown> }
    | { success: false; errors: SchemaValidationError[] } => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return { success: false, errors: [{ path: '', message: 'Expected object' }] };
    }
    const obj = value as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    const errors: SchemaValidationError[] = [];

    for (const [key, fieldSchema] of Object.entries(shape)) {
      const result = fieldSchema.validate(obj[key]);
      if (result.success) {
        data[key] = result.data;
      } else {
        errors.push(
          ...result.errors.map((e) => ({
            path: key + (e.path ? '.' + e.path : ''),
            message: e.message,
          }))
        );
      }
    }

    if (errors.length > 0) return { success: false, errors };
    return { success: true, data };
  };

  return {
    _type: undefined as unknown as Record<string, unknown>,
    shape,
    validate,
  };
}

export const Schema = {
  string(): StringSchema {
    return createStringSchema();
  },
  number(): NumberSchema {
    return createNumberSchema();
  },
  date(): DateSchema {
    return createDateSchema();
  },
  object<T extends Record<string, BaseSchema>>(shape: T): ObjectSchema {
    return createObjectSchema(shape);
  },
  array(itemSchema: BaseSchema): BaseSchema<unknown[]> {
    return {
      _type: undefined as unknown as unknown[],
      validate(
        value: unknown
      ): { success: true; data: unknown[] } | { success: false; errors: SchemaValidationError[] } {
        if (!Array.isArray(value)) {
          return { success: false, errors: [{ path: '', message: 'Expected array' }] };
        }
        const data: unknown[] = [];
        const errors: SchemaValidationError[] = [];
        for (let i = 0; i < value.length; i++) {
          const result = itemSchema.validate(value[i]);
          if (result.success) data.push(result.data);
          else
            errors.push(
              ...result.errors.map((e) => ({
                path: `[${i}]${e.path ? '.' + e.path : ''}`,
                message: e.message,
              }))
            );
        }
        if (errors.length > 0) return { success: false, errors };
        return { success: true, data };
      },
    };
  },
};
