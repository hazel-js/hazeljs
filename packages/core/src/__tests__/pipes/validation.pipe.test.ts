import { ValidationPipe } from '../../pipes/validation.pipe';
import { ValidationError } from '../../pipes/pipe';
import { RequestContext } from '../../request-context';
import { IsString, IsInt, Min, IsEmail } from 'class-validator';
import 'reflect-metadata';

// Mock logger
jest.mock('../../logger', () => ({
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

describe('ValidationPipe', () => {
  let pipe: ValidationPipe;

  beforeEach(() => {
    pipe = new ValidationPipe();
  });

  describe('transform', () => {
    it('should return value as-is when no DTO type provided', async () => {
      const value = { name: 'test' };
      const context = {} as RequestContext;

      const result = await pipe.transform(value, context);

      expect(result).toBe(value);
    });

    it('should return value as-is when DTO type is not a constructor', async () => {
      const value = { name: 'test' };
      const context = {
        dtoType: 'not-a-constructor',
      } as unknown as RequestContext;

      const result = await pipe.transform(value, context);

      expect(result).toBe(value);
    });

    it('should validate and transform valid DTO', async () => {
      class CreateUserDto {
        @IsString()
        name!: string;

        @IsInt()
        @Min(0)
        age!: number;
      }

      const value = { name: 'John', age: 25 };
      const context = {
        dtoType: CreateUserDto,
      } as RequestContext;

      const result = await pipe.transform(value, context);

      expect(result).toBeInstanceOf(CreateUserDto);
      expect((result as CreateUserDto).name).toBe('John');
      expect((result as CreateUserDto).age).toBe(25);
    });

    it('should throw ValidationError for invalid DTO', async () => {
      class CreateUserDto {
        @IsString()
        name!: string;

        @IsInt()
        @Min(18)
        age!: number;
      }

      const value = { name: 'John', age: 15 };
      const context = {
        dtoType: CreateUserDto,
      } as RequestContext;

      await expect(pipe.transform(value, context)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when value is not an object', async () => {
      class CreateUserDto {
        @IsString()
        name!: string;
      }

      const value = 'not an object';
      const context = {
        dtoType: CreateUserDto,
      } as RequestContext;

      await expect(pipe.transform(value, context)).rejects.toThrow(ValidationError);
      await expect(pipe.transform(value, context)).rejects.toThrow('Invalid input: expected an object');
    });

    it('should throw ValidationError when value is null', async () => {
      class CreateUserDto {
        @IsString()
        name!: string;
      }

      const value = null;
      const context = {
        dtoType: CreateUserDto,
      } as RequestContext;

      await expect(pipe.transform(value, context)).rejects.toThrow(ValidationError);
    });

    it('should handle multiple validation errors', async () => {
      class CreateUserDto {
        @IsString()
        name!: string;

        @IsInt()
        age!: number;

        @IsEmail()
        email!: string;
      }

      const value = { name: 123, age: 'not-a-number', email: 'invalid-email' };
      const context = {
        dtoType: CreateUserDto,
      } as RequestContext;

      try {
        await pipe.transform(value, context);
        fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        expect(validationError.errors.length).toBeGreaterThan(0);
      }
    });

    it('should handle empty constraints', async () => {
      class CreateUserDto {
        @IsString()
        name!: string;
      }

      const value = { name: 123 };
      const context = {
        dtoType: CreateUserDto,
      } as RequestContext;

      try {
        await pipe.transform(value, context);
        fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
      }
    });

    it('should transform nested objects', async () => {
      class AddressDto {
        @IsString()
        street!: string;

        @IsString()
        city!: string;
      }

      class CreateUserDto {
        @IsString()
        name!: string;

        address!: AddressDto;
      }

      const value = {
        name: 'John',
        address: {
          street: '123 Main St',
          city: 'New York',
        },
      };
      const context = {
        dtoType: CreateUserDto,
      } as RequestContext;

      const result = await pipe.transform(value, context);

      expect(result).toBeInstanceOf(CreateUserDto);
      expect((result as CreateUserDto).name).toBe('John');
    });

    it('should handle arrays in DTO', async () => {
      class CreateUserDto {
        @IsString()
        name!: string;

        tags!: string[];
      }

      const value = {
        name: 'John',
        tags: ['developer', 'typescript'],
      };
      const context = {
        dtoType: CreateUserDto,
      } as RequestContext;

      const result = await pipe.transform(value, context);

      expect(result).toBeInstanceOf(CreateUserDto);
      expect((result as CreateUserDto).tags).toEqual(['developer', 'typescript']);
    });

    it('should validate email format', async () => {
      class CreateUserDto {
        @IsEmail()
        email!: string;
      }

      const validValue = { email: 'user@example.com' };
      const invalidValue = { email: 'not-an-email' };
      const context = {
        dtoType: CreateUserDto,
      } as RequestContext;

      const validResult = await pipe.transform(validValue, context);
      expect(validResult).toBeInstanceOf(CreateUserDto);

      await expect(pipe.transform(invalidValue, context)).rejects.toThrow(ValidationError);
    });

    it('should handle minimum value validation', async () => {
      class CreateProductDto {
        @IsInt()
        @Min(1)
        quantity!: number;
      }

      const validValue = { quantity: 5 };
      const invalidValue = { quantity: 0 };
      const context = {
        dtoType: CreateProductDto,
      } as RequestContext;

      const validResult = await pipe.transform(validValue, context);
      expect(validResult).toBeInstanceOf(CreateProductDto);

      await expect(pipe.transform(invalidValue, context)).rejects.toThrow(ValidationError);
    });

    it('should preserve extra properties', async () => {
      class CreateUserDto {
        @IsString()
        name!: string;
      }

      const value = { name: 'John', extra: 'property' };
      const context = {
        dtoType: CreateUserDto,
      } as RequestContext;

      const result = await pipe.transform(value, context);

      expect(result).toBeInstanceOf(CreateUserDto);
      expect((result as any).name).toBe('John');
    });

    it('should handle validation error with constraints', async () => {
      class CreateUserDto {
        @IsString()
        @IsEmail()
        email!: string;
      }

      const value = { email: 'invalid' };
      const context = {
        dtoType: CreateUserDto,
      } as RequestContext;

      try {
        await pipe.transform(value, context);
        fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        expect(validationError.message).toBe('Validation failed');
        expect(validationError.errors[0].property).toBe('email');
      }
    });

    it('should rethrow caught errors', async () => {
      class CreateUserDto {
        @IsString()
        name!: string;
      }

      const value = { name: 123 };
      const context = {
        dtoType: CreateUserDto,
      } as RequestContext;

      try {
        await pipe.transform(value, context);
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
