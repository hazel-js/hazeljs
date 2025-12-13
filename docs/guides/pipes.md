# Pipes

Pipes are a powerful feature in HazelJS that allow you to **transform** and **validate** data before it reaches your route handlers. A pipe is a class annotated with the `@Injectable()` decorator that implements the `PipeTransform` interface.

## Use Cases

Pipes have two typical use cases:

- **Transformation**: Transform input data to the desired form (e.g., from string to integer)
- **Validation**: Evaluate input data and throw an exception if invalid

## Built-in Pipes

HazelJS provides several built-in pipes out of the box:

- `ParseIntPipe` - Transforms string to integer
- `ParseFloatPipe` - Transforms string to float
- `ParseBoolPipe` - Transforms string to boolean
- `DefaultValuePipe` - Provides default values for undefined inputs
- `ValidationPipe` - Validates objects using class-validator decorators

## Using Pipes

### ParseIntPipe

The `ParseIntPipe` transforms string parameters to integers and validates that the conversion is successful.

```typescript
import { Controller, Get, Param, ParseIntPipe } from '@hazeljs/core';

@Controller('users')
export class UsersController {
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    // id is guaranteed to be a number
    return `User #${id}`;
  }
}
```

If you try to access `/users/abc`, you'll get a validation error:

```json
{
  "message": "Invalid integer value",
  "errors": [
    {
      "field": "id",
      "messages": ["value must be an integer"],
      "value": "abc"
    }
  ]
}
```

### ParseFloatPipe

Similar to `ParseIntPipe`, but for floating-point numbers:

```typescript
@Get('price/:amount')
getPrice(@Param('amount', ParseFloatPipe) amount: number) {
  return { price: amount * 1.2 };
}
```

### ParseBoolPipe

Converts string values `'true'` and `'false'` to boolean:

```typescript
@Get('active/:status')
filterActive(@Param('status', ParseBoolPipe) status: boolean) {
  return { active: status };
}
```

### DefaultValuePipe

Provides a default value when the parameter is undefined:

```typescript
import { DefaultValuePipe } from '@hazeljs/core';

@Get()
findAll(
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
) {
  return { page, limit };
}
```

## Validation Pipe

The `ValidationPipe` provides automatic validation using `class-validator` decorators. This is one of the most powerful features for ensuring data integrity.

### Basic Usage

First, install the required dependencies:

```bash
npm install class-validator class-transformer
```

Create a DTO (Data Transfer Object) with validation decorators:

<div class="filename">create-user.dto.ts</div>

```typescript
import { IsString, IsEmail, IsInt, Min, Max, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsInt()
  @Min(18)
  @Max(120)
  age: number;

  @IsString()
  @IsOptional()
  bio?: string;
}
```

Use the `ValidationPipe` in your controller:

```typescript
import { Controller, Post, Body, ValidationPipe } from '@hazeljs/core';
import { CreateUserDto } from './create-user.dto';

@Controller('users')
export class UsersController {
  @Post()
  create(@Body(ValidationPipe) createUserDto: CreateUserDto) {
    // createUserDto is validated and transformed to CreateUserDto instance
    return createUserDto;
  }
}
```

### Validation Error Response

When validation fails, you'll receive a detailed error response:

```json
{
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "messages": ["email must be an email"],
      "value": "invalid-email"
    },
    {
      "field": "age",
      "messages": ["age must not be less than 18"],
      "value": 15
    }
  ]
}
```

### Global Validation Pipe

You can apply the `ValidationPipe` globally to all routes:

```typescript
import { HazelApp } from '@hazeljs/core';
import { ValidationPipe } from '@hazeljs/core';

const app = await HazelApp.create(AppModule);

// Apply globally
app.useGlobalPipes(new ValidationPipe());

await app.listen(3000);
```

## Custom Pipes

You can create custom pipes by implementing the `PipeTransform` interface:

```typescript
import { PipeTransform, Injectable, ValidationError } from '@hazeljs/core';
import { RequestContext } from '@hazeljs/core';

@Injectable()
export class ParseDatePipe implements PipeTransform<string, Date> {
  transform(value: string, context: RequestContext): Date {
    const date = new Date(value);
    
    if (isNaN(date.getTime())) {
      throw new ValidationError('Invalid date format', [
        {
          property: 'date',
          constraints: { isDate: 'value must be a valid date' },
          value,
        },
      ]);
    }
    
    return date;
  }
}
```

Use your custom pipe:

```typescript
@Get('events/:date')
getEvents(@Param('date', ParseDatePipe) date: Date) {
  return { date: date.toISOString() };
}
```

## Advanced Custom Pipe Example

Here's a more sophisticated example that validates and transforms an array of IDs:

```typescript
import { PipeTransform, Injectable, ValidationError } from '@hazeljs/core';
import { RequestContext } from '@hazeljs/core';

@Injectable()
export class ParseArrayPipe implements PipeTransform<string, number[]> {
  transform(value: string, context: RequestContext): number[] {
    if (!value) {
      return [];
    }

    const items = value.split(',');
    const numbers: number[] = [];

    for (const item of items) {
      const num = parseInt(item.trim(), 10);
      if (isNaN(num)) {
        throw new ValidationError('Invalid array format', [
          {
            property: 'ids',
            constraints: { 
              isArray: 'all values must be valid integers' 
            },
            value,
          },
        ]);
      }
      numbers.push(num);
    }

    return numbers;
  }
}
```

Usage:

```typescript
@Get('bulk')
getBulk(@Query('ids', ParseArrayPipe) ids: number[]) {
  // GET /bulk?ids=1,2,3,4
  return { ids }; // [1, 2, 3, 4]
}
```

## Pipe with Options

Create pipes that accept configuration options:

```typescript
import { PipeTransform, Injectable, ValidationError } from '@hazeljs/core';
import { RequestContext } from '@hazeljs/core';

interface TrimOptions {
  maxLength?: number;
  toLowerCase?: boolean;
}

@Injectable()
export class TrimPipe implements PipeTransform<string, string> {
  constructor(private options: TrimOptions = {}) {}

  transform(value: string, context: RequestContext): string {
    if (typeof value !== 'string') {
      throw new ValidationError('Value must be a string', [
        {
          property: 'value',
          constraints: { isString: 'value must be a string' },
          value,
        },
      ]);
    }

    let result = value.trim();

    if (this.options.toLowerCase) {
      result = result.toLowerCase();
    }

    if (this.options.maxLength && result.length > this.options.maxLength) {
      result = result.substring(0, this.options.maxLength);
    }

    return result;
  }
}
```

Usage:

```typescript
@Post()
create(
  @Body('name', new TrimPipe({ maxLength: 50, toLowerCase: true })) 
  name: string
) {
  return { name };
}
```

## Combining Multiple Pipes

You can chain multiple pipes together:

```typescript
@Get()
findAll(
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('search', new TrimPipe({ toLowerCase: true })) search: string,
) {
  return { page, search };
}
```

Pipes are executed in order from left to right.

## Complete Example

Here's a complete example combining DTOs, validation, and custom pipes:

<div class="filename">create-product.dto.ts</div>

```typescript
import { 
  IsString, 
  IsNumber, 
  Min, 
  Max, 
  IsEnum,
  IsOptional,
  Length 
} from 'class-validator';

enum ProductCategory {
  ELECTRONICS = 'electronics',
  CLOTHING = 'clothing',
  FOOD = 'food',
}

export class CreateProductDto {
  @IsString()
  @Length(3, 100)
  name: string;

  @IsString()
  @Length(10, 500)
  description: string;

  @IsNumber()
  @Min(0)
  @Max(1000000)
  price: number;

  @IsEnum(ProductCategory)
  category: ProductCategory;

  @IsString()
  @IsOptional()
  imageUrl?: string;
}
```

<div class="filename">products.controller.ts</div>

```typescript
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Query,
  ParseIntPipe,
  ValidationPipe,
  DefaultValuePipe,
} from '@hazeljs/core';
import { CreateProductDto } from './create-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.productsService.findAll(page, limit);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @Post()
  create(@Body(ValidationPipe) createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }
}
```

## Best Practices

1. **Use DTOs with ValidationPipe**: Always define DTOs with validation decorators for request bodies
2. **Parse route parameters**: Use `ParseIntPipe` for numeric IDs to ensure type safety
3. **Provide defaults**: Use `DefaultValuePipe` for optional query parameters
4. **Keep pipes focused**: Each pipe should have a single responsibility
5. **Handle errors gracefully**: Throw `ValidationError` with descriptive messages
6. **Apply globally when appropriate**: Use global pipes for consistent validation across your app

## What's Next?

- Learn about [Exception Filters](/docs/guides/exception-filters) to handle errors
- Understand [Interceptors](/docs/guides/interceptors) to transform responses
- Explore [Guards](/docs/guides/guards) for authentication and authorization
- Add [Middleware](/docs/guides/middleware) for request preprocessing
