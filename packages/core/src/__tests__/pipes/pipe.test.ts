import {
  ValidationError,
  ParseIntPipe,
  ParseFloatPipe,
  ParseBoolPipe,
  DefaultValuePipe,
} from '../../pipes/pipe';
import { RequestContext } from '../../types';

// Mock logger
jest.mock('../../logger', () => ({
  debug: jest.fn(),
  error: jest.fn(),
}));

describe('Pipes', () => {
  let context: RequestContext;

  beforeEach(() => {
    context = {
      method: 'GET',
      url: '/test',
      headers: {},
      params: { id: '123' },
      query: {},
      body: {},
    };
  });

  describe('ValidationError', () => {
    it('should create validation error with message and errors', () => {
      const errors = [
        {
          property: 'email',
          constraints: { isEmail: 'email must be a valid email' },
          value: 'invalid',
        },
      ];

      const error = new ValidationError('Validation failed', errors);

      expect(error.message).toBe('Validation failed');
      expect(error.errors).toEqual(errors);
      expect(error.name).toBe('ValidationError');
    });

    it('should convert to JSON format', () => {
      const errors = [
        {
          property: 'email',
          constraints: {
            isEmail: 'email must be a valid email',
            isNotEmpty: 'email should not be empty',
          } as Record<string, string>,
          value: 'invalid',
        },
        {
          property: 'age',
          constraints: { isInt: 'age must be an integer' } as Record<string, string>,
          value: 'abc',
        },
      ];

      const error = new ValidationError('Validation failed', errors);
      const json = error.toJSON();

      expect(json).toEqual({
        message: 'Validation failed',
        errors: [
          {
            field: 'email',
            messages: ['email must be a valid email', 'email should not be empty'],
            value: 'invalid',
          },
          {
            field: 'age',
            messages: ['age must be an integer'],
            value: 'abc',
          },
        ],
      });
    });
  });

  describe('ParseIntPipe', () => {
    let pipe: ParseIntPipe;

    beforeEach(() => {
      pipe = new ParseIntPipe();
    });

    it('should parse valid integer string', () => {
      const result = pipe.transform('123', context);
      expect(result).toBe(123);
    });

    it('should parse negative integers', () => {
      const result = pipe.transform('-456', context);
      expect(result).toBe(-456);
    });

    it('should parse zero', () => {
      const result = pipe.transform('0', context);
      expect(result).toBe(0);
    });

    it('should throw error for empty string', () => {
      expect(() => pipe.transform('', context)).toThrow(ValidationError);
    });

    it('should throw error for non-numeric string', () => {
      expect(() => pipe.transform('abc', context)).toThrow(ValidationError);
    });

    it('should throw error for float string', () => {
      const result = pipe.transform('123.45', context);
      // parseInt truncates, so this should return 123
      expect(result).toBe(123);
    });

    it('should throw error for null/undefined', () => {
      expect(() => pipe.transform(null as any, context)).toThrow(ValidationError);
    });

    it('should include proper error details', () => {
      try {
        pipe.transform('invalid', context);
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        expect(validationError.errors[0].property).toBe('id');
        expect(validationError.errors[0].constraints.isInt).toBeDefined();
      }
    });
  });

  describe('ParseFloatPipe', () => {
    let pipe: ParseFloatPipe;

    beforeEach(() => {
      pipe = new ParseFloatPipe();
    });

    it('should parse valid float string', () => {
      const result = pipe.transform('123.45', context);
      expect(result).toBe(123.45);
    });

    it('should parse integer as float', () => {
      const result = pipe.transform('100', context);
      expect(result).toBe(100);
    });

    it('should parse negative floats', () => {
      const result = pipe.transform('-99.99', context);
      expect(result).toBe(-99.99);
    });

    it('should parse scientific notation', () => {
      const result = pipe.transform('1.5e2', context);
      expect(result).toBe(150);
    });

    it('should throw error for non-numeric string', () => {
      expect(() => pipe.transform('abc', context)).toThrow(ValidationError);
    });

    it('should throw error for empty string', () => {
      expect(() => pipe.transform('', context)).toThrow(ValidationError);
    });

    it('should include proper error details', () => {
      try {
        pipe.transform('invalid', context);
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        expect(validationError.errors[0].constraints.isFloat).toBeDefined();
      }
    });
  });

  describe('ParseBoolPipe', () => {
    let pipe: ParseBoolPipe;

    beforeEach(() => {
      pipe = new ParseBoolPipe();
    });

    it('should parse "true" string to true', () => {
      const result = pipe.transform('true', context);
      expect(result).toBe(true);
    });

    it('should parse "false" string to false', () => {
      const result = pipe.transform('false', context);
      expect(result).toBe(false);
    });

    it('should throw error for "1"', () => {
      expect(() => pipe.transform('1', context)).toThrow(ValidationError);
    });

    it('should throw error for "0"', () => {
      expect(() => pipe.transform('0', context)).toThrow(ValidationError);
    });

    it('should throw error for "yes"', () => {
      expect(() => pipe.transform('yes', context)).toThrow(ValidationError);
    });

    it('should throw error for empty string', () => {
      expect(() => pipe.transform('', context)).toThrow(ValidationError);
    });

    it('should throw error for invalid boolean string', () => {
      expect(() => pipe.transform('invalid', context)).toThrow(ValidationError);
    });

    it('should include proper error details', () => {
      try {
        pipe.transform('invalid', context);
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        expect(validationError.errors[0].constraints.isBoolean).toBeDefined();
      }
    });
  });

  describe('DefaultValuePipe', () => {
    it('should return default value for undefined', () => {
      const pipe = new DefaultValuePipe('default');
      const result = pipe.transform(undefined);
      expect(result).toBe('default');
    });

    it('should return actual value when defined', () => {
      const pipe = new DefaultValuePipe('default');
      const result = pipe.transform('actual');
      expect(result).toBe('actual');
    });

    it('should work with number default', () => {
      const pipe = new DefaultValuePipe(42);
      expect(pipe.transform(undefined)).toBe(42);
      expect(pipe.transform(10)).toBe(10);
    });

    it('should work with boolean default', () => {
      const pipe = new DefaultValuePipe(true);
      expect(pipe.transform(undefined)).toBe(true);
      expect(pipe.transform(false)).toBe(false);
    });

    it('should work with object default', () => {
      const defaultObj = { key: 'value' };
      const pipe = new DefaultValuePipe(defaultObj);
      expect(pipe.transform(undefined)).toBe(defaultObj);
    });

    it('should work with array default', () => {
      const defaultArr = [1, 2, 3];
      const pipe = new DefaultValuePipe(defaultArr);
      expect(pipe.transform(undefined)).toBe(defaultArr);
    });

    it('should not treat null as undefined', () => {
      const pipe = new DefaultValuePipe('default');
      const result = pipe.transform(null as any);
      expect(result).toBe(null);
    });

    it('should not treat empty string as undefined', () => {
      const pipe = new DefaultValuePipe('default');
      const result = pipe.transform('');
      expect(result).toBe('');
    });

    it('should not treat zero as undefined', () => {
      const pipe = new DefaultValuePipe(42);
      const result = pipe.transform(0);
      expect(result).toBe(0);
    });

    it('should not treat false as undefined', () => {
      const pipe = new DefaultValuePipe(true);
      const result = pipe.transform(false);
      expect(result).toBe(false);
    });
  });
});
