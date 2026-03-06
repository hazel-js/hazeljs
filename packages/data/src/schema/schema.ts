/**
 * Schema builder for data validation - fluent API
 * Zero runtime dependencies. TypeScript-first with full type inference.
 *
 * Supported types: string, number, boolean, date, object, array, literal, union
 * Modifiers: optional, nullable, default, transform, refine, refineAsync
 * Utilities: toJsonSchema(), Infer<T>, validateAsync()
 */

export interface SchemaValidationError {
  path: string;
  message: string;
}

export type SchemaValidator<T = unknown> = (
  value: unknown
) => { success: true; data: T } | { success: false; errors: SchemaValidationError[] };

type SyncResult<T> =
  | { success: true; data: T }
  | { success: false; errors: SchemaValidationError[] };

type Refinement<T> = { fn: (v: T) => boolean; message: string };
type AsyncRefinement<T> = { fn: (v: T) => Promise<boolean>; message: string };

// ─── Base Schema Interface ────────────────────────────────────────────────────

export interface BaseSchema<T = unknown> {
  readonly _type: T;
  validate(value: unknown): SyncResult<T>;
  validateAsync(value: unknown): Promise<SyncResult<T>>;
  optional(): BaseSchema<T | undefined>;
  nullable(): BaseSchema<T | null>;
  default(value: NonNullable<T>): BaseSchema<T>;
  transform<U>(fn: (value: T) => U): BaseSchema<U>;
  refine(fn: (value: T) => boolean, message: string): BaseSchema<T>;
  refineAsync(fn: (value: T) => Promise<boolean>, message: string): BaseSchema<T>;
  toJsonSchema(): Record<string, unknown>;
}

/**
 * Infer the output TypeScript type from a schema.
 * @example
 * const UserSchema = Schema.object({ name: Schema.string(), age: Schema.number() });
 * type User = Infer<typeof UserSchema>; // { name: string; age: number }
 */
export type Infer<T extends BaseSchema<unknown>> = T extends BaseSchema<infer U> ? U : never;

// ─── String Schema ────────────────────────────────────────────────────────────

export interface StringSchema extends BaseSchema<string> {
  email(): StringSchema;
  url(): StringSchema;
  min(length: number): StringSchema;
  max(length: number): StringSchema;
  uuid(): StringSchema;
  oneOf(values: string[]): StringSchema;
  pattern(regex: RegExp, message?: string): StringSchema;
  required(): StringSchema;
  trim(): StringSchema;
  refine(fn: (value: string) => boolean, message: string): StringSchema;
  refineAsync(fn: (value: string) => Promise<boolean>, message: string): StringSchema;
  optional(): BaseSchema<string | undefined>;
  nullable(): BaseSchema<string | null>;
  default(value: string): StringSchema;
  transform<U>(fn: (value: string) => U): BaseSchema<U>;
}

// ─── Number Schema ────────────────────────────────────────────────────────────

export interface NumberSchema extends BaseSchema<number> {
  min(n: number): NumberSchema;
  max(n: number): NumberSchema;
  integer(): NumberSchema;
  positive(): NumberSchema;
  negative(): NumberSchema;
  multipleOf(n: number): NumberSchema;
  refine(fn: (value: number) => boolean, message: string): NumberSchema;
  refineAsync(fn: (value: number) => Promise<boolean>, message: string): NumberSchema;
  optional(): BaseSchema<number | undefined>;
  nullable(): BaseSchema<number | null>;
  default(value: number): NumberSchema;
  transform<U>(fn: (value: number) => U): BaseSchema<U>;
}

// ─── Boolean Schema ───────────────────────────────────────────────────────────

export interface BooleanSchema extends BaseSchema<boolean> {
  optional(): BaseSchema<boolean | undefined>;
  nullable(): BaseSchema<boolean | null>;
  default(value: boolean): BooleanSchema;
  transform<U>(fn: (value: boolean) => U): BaseSchema<U>;
}

// ─── Date Schema ──────────────────────────────────────────────────────────────

export interface DateSchema extends BaseSchema<Date> {
  min(date: Date): DateSchema;
  max(date: Date): DateSchema;
  optional(): BaseSchema<Date | undefined>;
  nullable(): BaseSchema<Date | null>;
  default(value: Date): DateSchema;
  transform<U>(fn: (value: Date) => U): BaseSchema<U>;
}

// ─── Object Schema ────────────────────────────────────────────────────────────

export interface ObjectSchema<T = Record<string, unknown>> extends BaseSchema<T> {
  shape: Record<string, BaseSchema>;
  strict(): ObjectSchema<T>;
  pick<K extends keyof T>(keys: K[]): ObjectSchema<Pick<T, K>>;
  omit<K extends keyof T>(keys: K[]): ObjectSchema<Omit<T, K>>;
  extend<E extends Record<string, BaseSchema>>(
    extra: E
  ): ObjectSchema<T & { [K in keyof E]: Infer<E[K]> }>;
  optional(): BaseSchema<T | undefined>;
  nullable(): BaseSchema<T | null>;
}

// ─── Array Schema ─────────────────────────────────────────────────────────────

export interface ArraySchema<T = unknown> extends BaseSchema<T[]> {
  min(length: number): ArraySchema<T>;
  max(length: number): ArraySchema<T>;
  nonempty(): ArraySchema<T>;
  optional(): BaseSchema<T[] | undefined>;
  nullable(): BaseSchema<T[] | null>;
}

// ─── Literal Schema ───────────────────────────────────────────────────────────

export interface LiteralSchema<T extends string | number | boolean> extends BaseSchema<T> {
  readonly value: T;
}

// ─── Union Schema ─────────────────────────────────────────────────────────────

export type UnionSchema<T> = BaseSchema<T>;

// ─── Core buildSchema helper ──────────────────────────────────────────────────

function buildSchema<T>(
  syncValidate: (value: unknown) => SyncResult<T>,
  jsonSchemaFn: () => Record<string, unknown>,
  refinements: Refinement<T>[] = [],
  asyncRefinements: AsyncRefinement<T>[] = []
): BaseSchema<T> {
  const validate = (value: unknown): SyncResult<T> => {
    const result = syncValidate(value);
    if (!result.success) return result;
    for (const r of refinements) {
      if (!r.fn(result.data)) {
        return { success: false, errors: [{ path: '', message: r.message }] };
      }
    }
    return result;
  };

  return {
    _type: undefined as unknown as T,

    validate,

    async validateAsync(value: unknown): Promise<SyncResult<T>> {
      const result = validate(value);
      if (!result.success) return result;
      for (const r of asyncRefinements) {
        const ok = await r.fn(result.data);
        if (!ok) {
          return { success: false, errors: [{ path: '', message: r.message }] };
        }
      }
      return result;
    },

    optional(): BaseSchema<T | undefined> {
      return buildSchema<T | undefined>(
        (v) =>
          v === undefined
            ? { success: true, data: undefined }
            : (validate(v) as SyncResult<T | undefined>),
        () => {
          const js = jsonSchemaFn();
          return { ...js, _optional: true };
        }
      );
    },

    nullable(): BaseSchema<T | null> {
      return buildSchema<T | null>(
        (v) => (v === null ? { success: true, data: null } : (validate(v) as SyncResult<T | null>)),
        () => {
          const js = jsonSchemaFn();
          const t = js['type'];
          return { ...js, type: t ? [t, 'null'] : ['null'] };
        }
      );
    },

    default(defaultValue: NonNullable<T>): BaseSchema<T> {
      return buildSchema<T>(
        (v) => (v === undefined ? { success: true, data: defaultValue as T } : validate(v)),
        () => ({ ...jsonSchemaFn(), default: defaultValue })
      );
    },

    transform<U>(fn: (value: T) => U): BaseSchema<U> {
      return buildSchema<U>((v) => {
        const result = validate(v);
        if (!result.success) return result as unknown as SyncResult<U>;
        try {
          return { success: true, data: fn(result.data) };
        } catch (e) {
          return {
            success: false,
            errors: [{ path: '', message: e instanceof Error ? e.message : 'Transform failed' }],
          };
        }
      }, jsonSchemaFn);
    },

    refine(fn: (v: T) => boolean, message: string): BaseSchema<T> {
      return buildSchema(
        syncValidate,
        jsonSchemaFn,
        [...refinements, { fn, message }],
        asyncRefinements
      );
    },

    refineAsync(fn: (v: T) => Promise<boolean>, message: string): BaseSchema<T> {
      return buildSchema(syncValidate, jsonSchemaFn, refinements, [
        ...asyncRefinements,
        { fn, message },
      ]);
    },

    toJsonSchema(): Record<string, unknown> {
      return jsonSchemaFn();
    },
  };
}

// ─── String Schema Factory ────────────────────────────────────────────────────

function createStringSchema(
  constraints: Array<(v: string) => string | null> = [],
  preprocessors: Array<(v: string) => string> = [],
  refinements: Refinement<string>[] = [],
  asyncRefinements: AsyncRefinement<string>[] = []
): StringSchema {
  const syncValidate = (value: unknown): SyncResult<string> => {
    if (typeof value !== 'string') {
      return { success: false, errors: [{ path: '', message: 'Expected string' }] };
    }
    let v = value;
    for (const pre of preprocessors) v = pre(v);
    for (const c of constraints) {
      const err = c(v);
      if (err) return { success: false, errors: [{ path: '', message: err }] };
    }
    return { success: true, data: v };
  };

  const jsonSchemaFn = (): Record<string, unknown> => ({ type: 'string' });

  const base = buildSchema(syncValidate, jsonSchemaFn, refinements, asyncRefinements);

  const addConstraint = (c: (v: string) => string | null): StringSchema =>
    createStringSchema([...constraints, c], preprocessors, refinements, asyncRefinements);

  const schema: StringSchema = {
    ...base,

    email(): StringSchema {
      return addConstraint((v) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(v) ? null : 'Invalid email';
      });
    },

    url(): StringSchema {
      return addConstraint((v) => {
        try {
          new URL(v);
          return null;
        } catch {
          return 'Invalid URL';
        }
      });
    },

    min(length: number): StringSchema {
      return addConstraint((v) => (v.length >= length ? null : `Min length ${length}`));
    },

    max(length: number): StringSchema {
      return addConstraint((v) => (v.length <= length ? null : `Max length ${length}`));
    },

    uuid(): StringSchema {
      return addConstraint((v) => {
        const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return re.test(v) ? null : 'Invalid UUID';
      });
    },

    oneOf(values: string[]): StringSchema {
      return addConstraint((v) =>
        values.includes(v) ? null : `Must be one of: ${values.join(', ')}`
      );
    },

    pattern(regex: RegExp, message = 'Invalid format'): StringSchema {
      return addConstraint((v) => (regex.test(v) ? null : message));
    },

    required(): StringSchema {
      return addConstraint((v) => (v.length > 0 ? null : 'Value is required'));
    },

    trim(): StringSchema {
      return createStringSchema(
        constraints,
        [...preprocessors, (v: string): string => v.trim()],
        refinements,
        asyncRefinements
      );
    },

    refine(fn: (v: string) => boolean, message: string): StringSchema {
      return createStringSchema(
        constraints,
        preprocessors,
        [...refinements, { fn, message }],
        asyncRefinements
      );
    },

    refineAsync(fn: (v: string) => Promise<boolean>, message: string): StringSchema {
      return createStringSchema(constraints, preprocessors, refinements, [
        ...asyncRefinements,
        { fn, message },
      ]);
    },

    default(value: string): StringSchema {
      const next = createStringSchema(constraints, preprocessors, refinements, asyncRefinements);
      const originalValidate = next.validate.bind(next);
      return {
        ...next,
        validate: (v: unknown) =>
          v === undefined ? { success: true, data: value } : originalValidate(v),
        toJsonSchema: () => ({ type: 'string', default: value }),
      };
    },

    toJsonSchema(): Record<string, unknown> {
      return { type: 'string' };
    },
  };

  return schema;
}

// ─── Number Schema Factory ────────────────────────────────────────────────────

function createNumberSchema(
  constraints: Array<(v: number) => string | null> = [],
  refinements: Refinement<number>[] = [],
  asyncRefinements: AsyncRefinement<number>[] = []
): NumberSchema {
  const syncValidate = (value: unknown): SyncResult<number> => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return { success: false, errors: [{ path: '', message: 'Expected number' }] };
    }
    for (const c of constraints) {
      const err = c(value);
      if (err) return { success: false, errors: [{ path: '', message: err }] };
    }
    return { success: true, data: value };
  };

  const jsonSchemaFn = (): Record<string, unknown> => ({ type: 'number' });
  const base = buildSchema(syncValidate, jsonSchemaFn, refinements, asyncRefinements);

  const addConstraint = (c: (v: number) => string | null): NumberSchema =>
    createNumberSchema([...constraints, c], refinements, asyncRefinements);

  const schema: NumberSchema = {
    ...base,

    min(n: number): NumberSchema {
      return addConstraint((v) => (v >= n ? null : `Min ${n}`));
    },

    max(n: number): NumberSchema {
      return addConstraint((v) => (v <= n ? null : `Max ${n}`));
    },

    integer(): NumberSchema {
      return addConstraint((v) => (Number.isInteger(v) ? null : 'Must be an integer'));
    },

    positive(): NumberSchema {
      return addConstraint((v) => (v > 0 ? null : 'Must be positive'));
    },

    negative(): NumberSchema {
      return addConstraint((v) => (v < 0 ? null : 'Must be negative'));
    },

    multipleOf(n: number): NumberSchema {
      return addConstraint((v) => (v % n === 0 ? null : `Must be a multiple of ${n}`));
    },

    refine(fn: (v: number) => boolean, message: string): NumberSchema {
      return createNumberSchema(constraints, [...refinements, { fn, message }], asyncRefinements);
    },

    refineAsync(fn: (v: number) => Promise<boolean>, message: string): NumberSchema {
      return createNumberSchema(constraints, refinements, [...asyncRefinements, { fn, message }]);
    },

    default(value: number): NumberSchema {
      const next = createNumberSchema(constraints, refinements, asyncRefinements);
      const originalValidate = next.validate.bind(next);
      return {
        ...next,
        validate: (v: unknown) =>
          v === undefined ? { success: true, data: value } : originalValidate(v),
        toJsonSchema: () => ({ type: 'number', default: value }),
      };
    },

    toJsonSchema(): Record<string, unknown> {
      return { type: 'number' };
    },
  };

  return schema;
}

// ─── Boolean Schema Factory ───────────────────────────────────────────────────

function createBooleanSchema(): BooleanSchema {
  const syncValidate = (value: unknown): SyncResult<boolean> => {
    if (typeof value !== 'boolean') {
      return { success: false, errors: [{ path: '', message: 'Expected boolean' }] };
    }
    return { success: true, data: value };
  };

  const base = buildSchema(syncValidate, () => ({ type: 'boolean' }));

  return {
    ...base,

    default(value: boolean): BooleanSchema {
      return {
        ...createBooleanSchema(),
        validate: (v: unknown) =>
          v === undefined ? { success: true, data: value } : syncValidate(v),
        toJsonSchema: () => ({ type: 'boolean', default: value }),
      };
    },

    toJsonSchema(): Record<string, unknown> {
      return { type: 'boolean' };
    },
  };
}

// ─── Date Schema Factory ──────────────────────────────────────────────────────

function createDateSchema(constraints: Array<(v: Date) => string | null> = []): DateSchema {
  const syncValidate = (value: unknown): SyncResult<Date> => {
    let date: Date;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      date = value;
    } else if (typeof value === 'string' || typeof value === 'number') {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) {
        return { success: false, errors: [{ path: '', message: 'Expected date' }] };
      }
      date = d;
    } else {
      return { success: false, errors: [{ path: '', message: 'Expected date' }] };
    }
    for (const c of constraints) {
      const err = c(date);
      if (err) return { success: false, errors: [{ path: '', message: err }] };
    }
    return { success: true, data: date };
  };

  const base = buildSchema(syncValidate, () => ({ type: 'string', format: 'date-time' }));

  const addConstraint = (c: (v: Date) => string | null): DateSchema =>
    createDateSchema([...constraints, c]);

  return {
    ...base,

    min(date: Date): DateSchema {
      return addConstraint((v) => (v >= date ? null : `Date must be after ${date.toISOString()}`));
    },

    max(date: Date): DateSchema {
      return addConstraint((v) => (v <= date ? null : `Date must be before ${date.toISOString()}`));
    },

    default(value: Date): DateSchema {
      const next = createDateSchema(constraints);
      const originalValidate = next.validate.bind(next);
      return {
        ...next,
        validate: (v: unknown) =>
          v === undefined ? { success: true, data: value } : originalValidate(v),
        toJsonSchema: () => ({ type: 'string', format: 'date-time', default: value.toISOString() }),
      };
    },

    toJsonSchema(): Record<string, unknown> {
      return { type: 'string', format: 'date-time' };
    },
  };
}

// ─── Object Schema Factory ────────────────────────────────────────────────────

type ShapeToType<S extends Record<string, BaseSchema>> = {
  [K in keyof S]: Infer<S[K]>;
};

function createObjectSchema<S extends Record<string, BaseSchema>>(
  shape: S,
  strictMode = false
): ObjectSchema<ShapeToType<S>> {
  type T = ShapeToType<S>;

  const syncValidate = (value: unknown): SyncResult<T> => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return { success: false, errors: [{ path: '', message: 'Expected object' }] };
    }
    const obj = value as Record<string, unknown>;

    if (strictMode) {
      const extraKeys = Object.keys(obj).filter((k) => !(k in shape));
      if (extraKeys.length > 0) {
        return {
          success: false,
          errors: [{ path: '', message: `Unknown keys: ${extraKeys.join(', ')}` }],
        };
      }
    }

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
    return { success: true, data: data as T };
  };

  const jsonSchemaFn = (): Record<string, unknown> => ({
    type: 'object',
    properties: Object.fromEntries(Object.entries(shape).map(([k, s]) => [k, s.toJsonSchema()])),
    required: Object.keys(shape),
    additionalProperties: !strictMode,
  });

  const base = buildSchema(syncValidate, jsonSchemaFn);

  const objSchema: ObjectSchema<T> = {
    ...base,
    shape: shape as Record<string, BaseSchema>,

    strict(): ObjectSchema<T> {
      return createObjectSchema(shape, true);
    },

    pick<K extends keyof T>(keys: K[]): ObjectSchema<Pick<T, K>> {
      const pickedShape = Object.fromEntries(
        (keys as string[]).filter((k) => k in shape).map((k) => [k, shape[k]])
      ) as Record<string, BaseSchema>;
      return createObjectSchema(pickedShape) as unknown as ObjectSchema<Pick<T, K>>;
    },

    omit<K extends keyof T>(keys: K[]): ObjectSchema<Omit<T, K>> {
      const omittedShape = Object.fromEntries(
        Object.entries(shape).filter(([k]) => !(keys as string[]).includes(k))
      ) as Record<string, BaseSchema>;
      return createObjectSchema(omittedShape) as unknown as ObjectSchema<Omit<T, K>>;
    },

    extend<E extends Record<string, BaseSchema>>(
      extra: E
    ): ObjectSchema<T & { [K in keyof E]: Infer<E[K]> }> {
      return createObjectSchema({ ...shape, ...extra }) as unknown as ObjectSchema<
        T & { [K in keyof E]: Infer<E[K]> }
      >;
    },

    toJsonSchema(): Record<string, unknown> {
      return jsonSchemaFn();
    },
  };

  return objSchema;
}

// ─── Array Schema Factory ─────────────────────────────────────────────────────

function createArraySchema<T>(
  itemSchema: BaseSchema<T>,
  constraints: Array<(v: T[]) => string | null> = []
): ArraySchema<T> {
  const syncValidate = (value: unknown): SyncResult<T[]> => {
    if (!Array.isArray(value)) {
      return { success: false, errors: [{ path: '', message: 'Expected array' }] };
    }
    const data: T[] = [];
    const errors: SchemaValidationError[] = [];

    for (let i = 0; i < value.length; i++) {
      const result = itemSchema.validate(value[i]);
      if (result.success) {
        data.push(result.data);
      } else {
        errors.push(
          ...result.errors.map((e) => ({
            path: `[${i}]${e.path ? '.' + e.path : ''}`,
            message: e.message,
          }))
        );
      }
    }

    if (errors.length > 0) return { success: false, errors };

    for (const c of constraints) {
      const err = c(data);
      if (err) return { success: false, errors: [{ path: '', message: err }] };
    }

    return { success: true, data };
  };

  const jsonSchemaFn = (): Record<string, unknown> => ({
    type: 'array',
    items: itemSchema.toJsonSchema(),
  });

  const base = buildSchema(syncValidate, jsonSchemaFn);

  const addConstraint = (c: (v: T[]) => string | null): ArraySchema<T> =>
    createArraySchema(itemSchema, [...constraints, c]);

  return {
    ...base,

    min(length: number): ArraySchema<T> {
      return addConstraint((v) =>
        v.length >= length ? null : `Array must have at least ${length} items`
      );
    },

    max(length: number): ArraySchema<T> {
      return addConstraint((v) =>
        v.length <= length ? null : `Array must have at most ${length} items`
      );
    },

    nonempty(): ArraySchema<T> {
      return addConstraint((v) => (v.length > 0 ? null : 'Array must not be empty'));
    },

    toJsonSchema(): Record<string, unknown> {
      return jsonSchemaFn();
    },
  };
}

// ─── Literal Schema Factory ───────────────────────────────────────────────────

function createLiteralSchema<T extends string | number | boolean>(
  literalValue: T
): LiteralSchema<T> {
  const syncValidate = (value: unknown): SyncResult<T> => {
    if (value !== literalValue) {
      return {
        success: false,
        errors: [{ path: '', message: `Expected literal ${JSON.stringify(literalValue)}` }],
      };
    }
    return { success: true, data: value as T };
  };

  const base = buildSchema(syncValidate, () => ({ const: literalValue }));

  return {
    ...base,
    value: literalValue,
    toJsonSchema(): Record<string, unknown> {
      return { const: literalValue };
    },
  };
}

// ─── Union Schema Factory ─────────────────────────────────────────────────────

function createUnionSchema<T extends BaseSchema<unknown>[]>(
  schemas: T
): UnionSchema<Infer<T[number]>> {
  type Output = Infer<T[number]>;

  const syncValidate = (value: unknown): SyncResult<Output> => {
    const allErrors: SchemaValidationError[] = [];
    for (const s of schemas) {
      const result = s.validate(value);
      if (result.success) return { success: true, data: result.data as Output };
      allErrors.push(...result.errors);
    }
    return {
      success: false,
      errors: [{ path: '', message: 'Value did not match any schema in union' }],
    };
  };

  const base = buildSchema<Output>(syncValidate, () => ({
    oneOf: schemas.map((s) => s.toJsonSchema()),
  }));

  return {
    ...base,
    toJsonSchema(): Record<string, unknown> {
      return { oneOf: schemas.map((s) => s.toJsonSchema()) };
    },
  };
}

// ─── Schema Namespace ─────────────────────────────────────────────────────────

export const Schema = {
  string(): StringSchema {
    return createStringSchema();
  },

  number(): NumberSchema {
    return createNumberSchema();
  },

  boolean(): BooleanSchema {
    return createBooleanSchema();
  },

  date(): DateSchema {
    return createDateSchema();
  },

  object<S extends Record<string, BaseSchema>>(shape: S): ObjectSchema<ShapeToType<S>> {
    return createObjectSchema(shape);
  },

  array<T>(itemSchema: BaseSchema<T>): ArraySchema<T> {
    return createArraySchema(itemSchema);
  },

  literal<T extends string | number | boolean>(value: T): LiteralSchema<T> {
    return createLiteralSchema(value);
  },

  union<T extends BaseSchema<unknown>[]>(schemas: T): UnionSchema<Infer<T[number]>> {
    return createUnionSchema(schemas);
  },
};
