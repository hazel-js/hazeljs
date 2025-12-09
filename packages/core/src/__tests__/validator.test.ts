import { Validator } from '../validator';
import { ValidationSchema } from '../types';

describe('Validator', () => {
  describe('required validation', () => {
    it('should validate required fields', () => {
      const schema: ValidationSchema = {
        name: { type: 'string', required: true },
      };

      const errors = Validator.validate({}, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        field: 'name',
        message: 'name is required',
      });
    });

    it('should reject null values for required fields', () => {
      const schema: ValidationSchema = {
        email: { type: 'string', required: true },
      };

      const errors = Validator.validate({ email: null }, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('email');
    });

    it('should reject empty strings for required fields', () => {
      const schema: ValidationSchema = {
        username: { type: 'string', required: true },
      };

      const errors = Validator.validate({ username: '' }, schema);

      expect(errors).toHaveLength(1);
    });

    it('should pass when required field is present', () => {
      const schema: ValidationSchema = {
        name: { type: 'string', required: true },
      };

      const errors = Validator.validate({ name: 'John' }, schema);

      expect(errors).toHaveLength(0);
    });
  });

  describe('string validation', () => {
    it('should validate string type', () => {
      const schema: ValidationSchema = {
        name: { type: 'string' },
      };

      const errors = Validator.validate({ name: 123 }, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('name must be a string');
    });

    it('should validate minimum length', () => {
      const schema: ValidationSchema = {
        password: { type: 'string', min: 8 },
      };

      const errors = Validator.validate({ password: 'short' }, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('password must be at least 8 characters');
    });

    it('should validate maximum length', () => {
      const schema: ValidationSchema = {
        username: { type: 'string', max: 10 },
      };

      const errors = Validator.validate({ username: 'verylongusername' }, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('username must be at most 10 characters');
    });

    it('should validate pattern', () => {
      const schema: ValidationSchema = {
        email: { type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
      };

      const errors = Validator.validate({ email: 'invalid-email' }, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('email has invalid format');
    });

    it('should pass valid string', () => {
      const schema: ValidationSchema = {
        name: { type: 'string', min: 2, max: 50 },
      };

      const errors = Validator.validate({ name: 'John Doe' }, schema);

      expect(errors).toHaveLength(0);
    });
  });

  describe('number validation', () => {
    it('should validate number type', () => {
      const schema: ValidationSchema = {
        age: { type: 'number' },
      };

      const errors = Validator.validate({ age: '25' }, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('age must be a number');
    });

    it('should validate minimum value', () => {
      const schema: ValidationSchema = {
        age: { type: 'number', min: 18 },
      };

      const errors = Validator.validate({ age: 16 }, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('age must be at least 18');
    });

    it('should validate maximum value', () => {
      const schema: ValidationSchema = {
        percentage: { type: 'number', max: 100 },
      };

      const errors = Validator.validate({ percentage: 150 }, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('percentage must be at most 100');
    });

    it('should pass valid number', () => {
      const schema: ValidationSchema = {
        score: { type: 'number', min: 0, max: 100 },
      };

      const errors = Validator.validate({ score: 85 }, schema);

      expect(errors).toHaveLength(0);
    });
  });

  describe('boolean validation', () => {
    it('should validate boolean type', () => {
      const schema: ValidationSchema = {
        active: { type: 'boolean' },
      };

      const errors = Validator.validate({ active: 'true' }, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('active must be a boolean');
    });

    it('should pass valid boolean', () => {
      const schema: ValidationSchema = {
        active: { type: 'boolean' },
      };

      const errors = Validator.validate({ active: true }, schema);

      expect(errors).toHaveLength(0);
    });
  });

  describe('object validation', () => {
    it('should validate object type', () => {
      const schema: ValidationSchema = {
        user: { type: 'object' },
      };

      const errors = Validator.validate({ user: 'not an object' }, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('user must be an object');
    });

    it('should reject arrays as objects', () => {
      const schema: ValidationSchema = {
        user: { type: 'object' },
      };

      const errors = Validator.validate({ user: [] }, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('user must be an object');
    });

    it('should validate nested properties', () => {
      const schema: ValidationSchema = {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string', required: true },
            age: { type: 'number', min: 0 },
          },
        },
      };

      const errors = Validator.validate(
        {
          user: {
            age: -5,
          },
        },
        schema
      );

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.field === 'name')).toBe(true);
      expect(errors.some((e) => e.field === 'age')).toBe(true);
    });

    it('should pass valid nested object', () => {
      const schema: ValidationSchema = {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string', required: true },
            age: { type: 'number', min: 0 },
          },
        },
      };

      const errors = Validator.validate(
        {
          user: {
            name: 'John',
            age: 25,
          },
        },
        schema
      );

      expect(errors).toHaveLength(0);
    });
  });

  describe('array validation', () => {
    it('should validate array type', () => {
      const schema: ValidationSchema = {
        tags: { type: 'array' },
      };

      const errors = Validator.validate({ tags: 'not an array' }, schema);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('tags must be an array');
    });

    it('should validate array items', () => {
      const schema: ValidationSchema = {
        scores: {
          type: 'array',
          items: { type: 'number', min: 0, max: 100 },
        },
      };

      const errors = Validator.validate({ scores: [50, 150, -10] }, schema);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass valid array', () => {
      const schema: ValidationSchema = {
        tags: {
          type: 'array',
          items: { type: 'string' },
        },
      };

      const errors = Validator.validate({ tags: ['tag1', 'tag2', 'tag3'] }, schema);

      expect(errors).toHaveLength(0);
    });

    it('should validate array without item schema', () => {
      const schema: ValidationSchema = {
        items: { type: 'array' },
      };

      const errors = Validator.validate({ items: [1, 'two', true] }, schema);

      expect(errors).toHaveLength(0);
    });
  });

  describe('optional fields', () => {
    it('should skip validation for undefined optional fields', () => {
      const schema: ValidationSchema = {
        name: { type: 'string', required: true },
        age: { type: 'number' },
      };

      const errors = Validator.validate({ name: 'John' }, schema);

      expect(errors).toHaveLength(0);
    });

    it('should skip validation for null optional fields', () => {
      const schema: ValidationSchema = {
        bio: { type: 'string', max: 500 },
      };

      const errors = Validator.validate({ bio: null }, schema);

      expect(errors).toHaveLength(0);
    });
  });

  describe('complex validation scenarios', () => {
    it('should validate multiple fields with multiple errors', () => {
      const schema: ValidationSchema = {
        username: { type: 'string', required: true, min: 3, max: 20 },
        email: { type: 'string', required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
        age: { type: 'number', min: 18, max: 120 },
      };

      const errors = Validator.validate(
        {
          username: 'ab',
          email: 'invalid',
          age: 15,
        },
        schema
      );

      expect(errors.length).toBe(3);
    });

    it('should validate deeply nested objects', () => {
      const schema: ValidationSchema = {
        profile: {
          type: 'object',
          properties: {
            address: {
              type: 'object',
              properties: {
                street: { type: 'string', required: true },
                city: { type: 'string', required: true },
              },
            },
          },
        },
      };

      const errors = Validator.validate(
        {
          profile: {
            address: {
              street: '123 Main St',
            },
          },
        },
        schema
      );

      expect(errors.some((e) => e.field === 'city')).toBe(true);
    });

    it('should validate arrays of objects', () => {
      const schema: ValidationSchema = {
        users: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', required: true },
              email: { type: 'string', required: true },
            },
          },
        },
      };

      const errors = Validator.validate(
        {
          users: [
            { name: 'John', email: 'john@example.com' },
            { name: 'Jane' }, // missing email
          ],
        },
        schema
      );

      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
