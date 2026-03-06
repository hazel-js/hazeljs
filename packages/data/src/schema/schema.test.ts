import { Schema } from './schema';

describe('Schema', () => {
  describe('string', () => {
    it('validates string', () => {
      const result = Schema.string().validate('hello');
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('hello');
    });

    it('rejects non-string', () => {
      const result = Schema.string().validate(123);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.errors[0].message).toBe('Expected string');
    });

    it('email validation', () => {
      expect(Schema.string().email().validate('a@b.com').success).toBe(true);
      expect(Schema.string().email().validate('invalid').success).toBe(false);
    });

    it('min length', () => {
      expect(Schema.string().min(3).validate('abc').success).toBe(true);
      expect(Schema.string().min(3).validate('ab').success).toBe(false);
    });

    it('max length', () => {
      expect(Schema.string().max(3).validate('abc').success).toBe(true);
      expect(Schema.string().max(2).validate('abc').success).toBe(false);
    });

    it('uuid validation', () => {
      const valid = '550e8400-e29b-41d4-a716-446655440000';
      expect(Schema.string().uuid().validate(valid).success).toBe(true);
      expect(Schema.string().uuid().validate('not-uuid').success).toBe(false);
    });

    it('oneOf validation', () => {
      expect(Schema.string().oneOf(['a', 'b']).validate('a').success).toBe(true);
      expect(Schema.string().oneOf(['a', 'b']).validate('c').success).toBe(false);
    });
  });

  describe('number', () => {
    it('validates number', () => {
      const result = Schema.number().validate(42);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe(42);
    });

    it('rejects non-number', () => {
      expect(Schema.number().validate('42').success).toBe(false);
      expect(Schema.number().validate(NaN).success).toBe(false);
    });

    it('min/max', () => {
      expect(Schema.number().min(0).max(100).validate(50).success).toBe(true);
      expect(Schema.number().min(0).validate(-1).success).toBe(false);
      expect(Schema.number().max(10).validate(11).success).toBe(false);
    });
  });

  describe('date', () => {
    it('validates Date', () => {
      const d = new Date();
      const result = Schema.date().validate(d);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe(d);
    });

    it('validates date string', () => {
      const result = Schema.date().validate('2024-01-01');
      expect(result.success).toBe(true);
    });

    it('rejects invalid date', () => {
      expect(Schema.date().validate('invalid').success).toBe(false);
      expect(Schema.date().validate({}).success).toBe(false);
    });
  });

  describe('object', () => {
    it('validates object shape', () => {
      const schema = Schema.object({
        name: Schema.string(),
        age: Schema.number(),
      });
      const result = schema.validate({ name: 'John', age: 30 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('John');
        expect(result.data.age).toBe(30);
      }
    });

    it('rejects invalid fields', () => {
      const schema = Schema.object({
        age: Schema.number(),
      });
      const result = schema.validate({ age: 'thirty' });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects non-object', () => {
      expect(Schema.object({}).validate('str').success).toBe(false);
      expect(Schema.object({}).validate(null).success).toBe(false);
      expect(Schema.object({}).validate([]).success).toBe(false);
    });
  });

  describe('array', () => {
    it('validates array of items', () => {
      const schema = Schema.array(Schema.number());
      const result = schema.validate([1, 2, 3]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toEqual([1, 2, 3]);
    });

    it('rejects invalid items', () => {
      const schema = Schema.array(Schema.number());
      const result = schema.validate([1, 'two', 3]);
      expect(result.success).toBe(false);
    });

    it('rejects non-array', () => {
      expect(Schema.array(Schema.string()).validate({}).success).toBe(false);
    });
  });

  describe('boolean', () => {
    it('validates boolean', () => {
      expect(Schema.boolean().validate(true).success).toBe(true);
      expect(Schema.boolean().validate(false).success).toBe(true);
      expect(Schema.boolean().validate(1).success).toBe(false);
    });
  });

  describe('literal', () => {
    it('validates literal value', () => {
      expect(Schema.literal('active').validate('active').success).toBe(true);
      expect(Schema.literal('active').validate('inactive').success).toBe(false);
      expect(Schema.literal(42).validate(42).success).toBe(true);
    });
  });

  describe('union', () => {
    it('validates union of schemas', () => {
      const schema = Schema.union([Schema.literal('a'), Schema.literal('b')]);
      expect(schema.validate('a').success).toBe(true);
      expect(schema.validate('b').success).toBe(true);
      expect(schema.validate('c').success).toBe(false);
    });
  });

  describe('optional and default', () => {
    it('optional accepts undefined', () => {
      const schema = Schema.string().optional();
      expect(schema.validate(undefined).success).toBe(true);
      expect(schema.validate('x').success).toBe(true);
    });

    it('default returns default for undefined', () => {
      const schema = Schema.string().default('fallback');
      const result = schema.validate(undefined);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('fallback');
    });
  });

  describe('transform and refine', () => {
    it('transform coerces after validation', () => {
      const schema = Schema.number().transform((n) => n * 2);
      const result = schema.validate(21);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe(42);
    });

    it('refine adds custom constraint', () => {
      const schema = Schema.number().refine((n) => n % 2 === 0, 'Must be even');
      expect(schema.validate(4).success).toBe(true);
      expect(schema.validate(3).success).toBe(false);
    });
  });

  describe('toJsonSchema', () => {
    it('exports string schema', () => {
      const js = Schema.string().toJsonSchema();
      expect(js).toMatchObject({ type: 'string' });
    });

    it('exports object schema', () => {
      const schema = Schema.object({ name: Schema.string() });
      const js = schema.toJsonSchema();
      expect(js).toMatchObject({ type: 'object' });
      expect(js).toHaveProperty('properties');
    });

    it('exports array schema', () => {
      const schema = Schema.array(Schema.number());
      const js = schema.toJsonSchema();
      expect(js).toMatchObject({ type: 'array' });
      expect(js).toHaveProperty('items');
    });

    it('exports literal schema', () => {
      const js = Schema.literal('x').toJsonSchema();
      expect(js).toMatchObject({ const: 'x' });
    });
  });

  describe('nullable', () => {
    it('accepts null', () => {
      const schema = Schema.string().nullable();
      expect(schema.validate(null).success).toBe(true);
      expect(schema.validate('x').success).toBe(true);
    });
  });

  describe('validateAsync', () => {
    it('validates with async refinements', async () => {
      const schema = Schema.number().refineAsync(async (n) => n > 0, 'Must be positive');
      const result = await schema.validateAsync(5);
      expect(result.success).toBe(true);
      const fail = await schema.validateAsync(-1);
      expect(fail.success).toBe(false);
    });
  });

  describe('number integer and url', () => {
    it('integer rejects decimals', () => {
      expect(Schema.number().integer().validate(5).success).toBe(true);
      expect(Schema.number().integer().validate(5.5).success).toBe(false);
    });

    it('string url validates', () => {
      expect(Schema.string().url().validate('https://example.com').success).toBe(true);
      expect(Schema.string().url().validate('not-a-url').success).toBe(false);
    });
  });

  describe('object pick omit extend strict', () => {
    const base = Schema.object({ a: Schema.number(), b: Schema.string(), c: Schema.boolean() });

    it('pick selects keys', () => {
      const picked = base.pick(['a', 'c']);
      const result = picked.validate({ a: 1, b: 'x', c: true });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ a: 1, c: true });
      }
    });

    it('omit removes keys', () => {
      const omitted = base.omit(['b']);
      const result = omitted.validate({ a: 1, b: 'x', c: true });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ a: 1, c: true });
      }
    });

    it('extend adds fields', () => {
      const extended = base.extend({ d: Schema.number() });
      const result = extended.validate({ a: 1, b: 'x', c: true, d: 4 });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.d).toBe(4);
    });

    it('strict rejects unknown keys', () => {
      const strict = base.strict();
      const result = strict.validate({ a: 1, b: 'x', c: true, extra: 'bad' });
      expect(result.success).toBe(false);
    });
  });

  describe('array min max nonempty', () => {
    it('min rejects short arrays', () => {
      const schema = Schema.array(Schema.number()).min(2);
      expect(schema.validate([1, 2]).success).toBe(true);
      expect(schema.validate([1]).success).toBe(false);
    });

    it('nonempty rejects empty', () => {
      const schema = Schema.array(Schema.string()).nonempty();
      expect(schema.validate(['x']).success).toBe(true);
      expect(schema.validate([]).success).toBe(false);
    });
  });

  describe('transform throws', () => {
    it('transform error is caught', () => {
      const schema = Schema.number().transform((n) => {
        if (n < 0) throw new Error('Negative');
        return n;
      });
      const result = schema.validate(-1);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.errors[0].message).toBe('Negative');
    });

    it('transform non-Error throw uses generic message', () => {
      const schema = Schema.number().transform(() => {
        throw 'string error';
      });
      const result = schema.validate(1);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.errors[0].message).toBe('Transform failed');
    });
  });

  describe('string pattern required trim', () => {
    it('pattern validates regex', () => {
      expect(Schema.string().pattern(/^\d+$/).validate('123').success).toBe(true);
      expect(Schema.string().pattern(/^\d+$/, 'Digits only').validate('abc').success).toBe(false);
    });

    it('required rejects empty string', () => {
      expect(Schema.string().required().validate('x').success).toBe(true);
      expect(Schema.string().required().validate('').success).toBe(false);
    });

    it('trim preprocesses', () => {
      const result = Schema.string().trim().validate('  hi  ');
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe('hi');
    });
  });

  describe('number positive negative multipleOf', () => {
    it('positive rejects zero and negative', () => {
      expect(Schema.number().positive().validate(1).success).toBe(true);
      expect(Schema.number().positive().validate(0).success).toBe(false);
      expect(Schema.number().positive().validate(-1).success).toBe(false);
    });

    it('negative rejects zero and positive', () => {
      expect(Schema.number().negative().validate(-1).success).toBe(true);
      expect(Schema.number().negative().validate(0).success).toBe(false);
    });

    it('multipleOf validates', () => {
      expect(Schema.number().multipleOf(5).validate(10).success).toBe(true);
      expect(Schema.number().multipleOf(5).validate(7).success).toBe(false);
    });
  });

  describe('number and boolean default', () => {
    it('number default for undefined', () => {
      const schema = Schema.number().default(42);
      const result = schema.validate(undefined);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe(42);
    });

    it('boolean default for undefined', () => {
      const schema = Schema.boolean().default(true);
      const result = schema.validate(undefined);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toBe(true);
    });
  });

  describe('date min max default', () => {
    it('date min max', () => {
      const min = new Date('2024-01-01');
      const max = new Date('2024-12-31');
      const schema = Schema.date().min(min).max(max);
      expect(schema.validate(new Date('2024-06-15')).success).toBe(true);
      expect(schema.validate(new Date('2023-06-15')).success).toBe(false);
      expect(schema.validate(new Date('2025-06-15')).success).toBe(false);
    });

    it('date default for undefined', () => {
      const d = new Date('2024-01-01');
      const schema = Schema.date().default(d);
      const result = schema.validate(undefined);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toEqual(d);
    });
  });

  describe('nullable toJsonSchema', () => {
    it('nullable string has type array', () => {
      const js = Schema.string().nullable().toJsonSchema();
      expect(js.type).toEqual(['string', 'null']);
    });

    it('nullable without base type', () => {
      const schema = Schema.literal('x').nullable();
      const js = schema.toJsonSchema();
      expect(js.type).toEqual(['null']);
    });
  });

  describe('optional toJsonSchema', () => {
    it('optional has _optional flag', () => {
      const js = Schema.string().optional().toJsonSchema();
      expect(js._optional).toBe(true);
    });
  });

  describe('object pick filters keys not in shape', () => {
    it('pick ignores keys not in shape', () => {
      const base = Schema.object({ a: Schema.number() });
      const picked = base.pick(['a', 'nonexistent']);
      const result = picked.validate({ a: 1 });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toEqual({ a: 1 });
    });
  });

  describe('array max', () => {
    it('max rejects long arrays', () => {
      const schema = Schema.array(Schema.number()).max(2);
      expect(schema.validate([1, 2]).success).toBe(true);
      expect(schema.validate([1, 2, 3]).success).toBe(false);
    });
  });

  describe('refineAsync', () => {
    it('refineAsync failure path', async () => {
      const schema = Schema.number().refineAsync(async (n) => n > 10, 'Must be > 10');
      const result = await schema.validateAsync(5);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.errors[0].message).toBe('Must be > 10');
    });
  });

  describe('buildSchema refine failure', () => {
    it('sync refine failure returns error', () => {
      const schema = Schema.number().refine((n) => n > 0, 'Must be positive');
      const result = schema.validate(-1);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.errors[0].message).toBe('Must be positive');
    });
  });

  describe('validateAsync with sync failure', () => {
    it('returns sync failure without running async refinements', async () => {
      const schema = Schema.number()
        .refine((n) => n > 0, 'sync fail')
        .refineAsync(async () => true, 'async');
      const result = await schema.validateAsync(-1);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.errors[0].message).toBe('sync fail');
    });
  });
});
