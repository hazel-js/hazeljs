import { SchemaValidator, SchemaValidationException } from './schema.validator';
import { Schema } from '../schema/schema';

describe('SchemaValidator', () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    validator = new SchemaValidator();
  });

  it('validates and returns data', () => {
    const schema = Schema.object({ x: Schema.number() });
    const result = validator.validate(schema, { x: 42 });
    expect(result).toEqual({ x: 42 });
  });

  it('throws SchemaValidationException on invalid data', () => {
    const schema = Schema.object({ x: Schema.number() });
    expect(() => validator.validate(schema, { x: 'not a number' })).toThrow(
      SchemaValidationException
    );
    try {
      validator.validate(schema, { x: 'bad' });
    } catch (e) {
      expect(e).toBeInstanceOf(SchemaValidationException);
      expect((e as SchemaValidationException).errors).toBeDefined();
    }
  });

  it('validateOrThrow is alias for validate', () => {
    const schema = Schema.object({ x: Schema.number() });
    const result = validator.validateOrThrow(schema, { x: 1 });
    expect(result).toEqual({ x: 1 });
  });

  it('safeValidate returns result without throwing', () => {
    const schema = Schema.string();
    const valid = validator.safeValidate(schema, 'ok');
    expect(valid.success).toBe(true);
    if (valid.success) expect(valid.data).toBe('ok');

    const invalid = validator.safeValidate(schema, 123);
    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.errors.length).toBeGreaterThan(0);
  });
});
