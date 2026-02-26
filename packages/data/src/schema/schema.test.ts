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
});
