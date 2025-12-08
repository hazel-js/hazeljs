# HazelJS Example Application

A lightweight, modular Node.js framework for building scalable applications with TypeScript.

## Features

### Core Features
- **Decorator-based API** - Clean and intuitive API using TypeScript decorators
- **Advanced Dependency Injection** - Singleton, Transient, and Request scopes
- **Request Validation** - Automatic request validation using class-validator
- **OpenAPI/Swagger** - Automatic API documentation generation
- **Middleware Support** - Global and route-specific middleware
- **Interceptor Support** - AOP-style interceptors for cross-cutting concerns
- **Type Safety** - Full TypeScript support with type inference

### New in v0.2.0 🎉
- **Exception Filters** - Centralized error handling
- **Configuration Module** - Type-safe configuration with validation
- **Testing Utilities** - Full test module builder with mocking
- **Advanced Routing** - Wildcards, optional params, API versioning
- **File Upload** - Native multipart form data support
- **Scoped Providers** - Request-scoped dependency injection

## Demo Module

Check out the `/demo` module to see all new v0.2.0 features in action:
- Optional route parameters (`:id?`)
- Wildcard routes (`/*`)
- Request-scoped providers
- Configuration service usage
- API versioning (v1, v2)

## Installation

```bash
npm install @hazeljs/core
```

## Quick Start

1. Create a module:
```typescript
import { HazelModule } from '@hazeljs/core';

@HazelModule({
  imports: [],
  providers: []
})
export class AppModule {}
```

2. Create a controller:
```typescript
import { Controller, Get, Post, Body, Param } from '@hazeljs/core';

@Controller({ path: '/users' })
export class UserController {
  @Get('/:id')
  async getUser(@Param('id') id: string) {
    return { id };
  }

  @Post()
  async createUser(@Body(CreateUserDto) user: CreateUserDto) {
    return user;
  }
}
```

3. Create a DTO with validation:
```typescript
import { IsString, IsEmail } from 'class-validator';
import { Expose } from 'class-transformer';

export class CreateUserDto {
  @Expose()
  @IsString()
  @IsEmail()
  email: string;

  @Expose()
  @IsString()
  name: string;
}
```

4. Bootstrap your application:
```typescript
import 'reflect-metadata';
import { HazelApp } from '@hazeljs/core';
import { SwaggerModule } from '@hazeljs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = new HazelApp(AppModule);
  SwaggerModule.setRootModule(AppModule);
  await app.listen(3000);
  console.log('Application is running on http://localhost:3000');
}

bootstrap();
```

## Core Features

### Decorators

- `@HazelModule()` - Define a module
- `@Controller()` - Define a controller
- `@Injectable()` - Define a service
- `@Get()`, `@Post()`, `@Put()`, `@Delete()` - HTTP method decorators
- `@Body()`, `@Param()`, `@Query()` - Parameter decorators
- `@UseGuards()` - Apply guards
- `@UsePipes()` - Apply pipes
- `@UseInterceptors()` - Apply interceptors

### Validation

```typescript
import { ValidationPipe } from '@hazeljs/core';

@Controller({ path: '/users' })
@UsePipes(ValidationPipe)
export class UserController {
  @Post()
  async createUser(@Body(CreateUserDto) user: CreateUserDto) {
    return user;
  }
}
```

### Guards

```typescript
import { Injectable, CanActivate } from '@hazeljs/core';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: RequestContext): boolean {
    // Your auth logic here
    return true;
  }
}
```

### Interceptors

```typescript
import { Injectable, Interceptor } from '@hazeljs/core';

@Injectable()
export class LoggingInterceptor implements Interceptor {
  intercept(context: RequestContext, next: () => Promise<unknown>) {
    console.log('Before...');
    const result = next();
    console.log('After...');
    return result;
  }
}
```

### Swagger Documentation

```typescript
import { Swagger, ApiOperation } from '@hazeljs/swagger';

@Swagger({
  title: 'User API',
  description: 'User management endpoints',
  version: '1.0.0'
})
@Controller({ path: '/users' })
export class UserController {
  @ApiOperation({
    summary: 'Create user',
    description: 'Creates a new user',
    responses: {
      '200': {
        description: 'User created successfully'
      }
    }
  })
  @Post()
  async createUser(@Body(CreateUserDto) user: CreateUserDto) {
    return user;
  }
}
```

## Project Structure

```
example/
  ├── src/
  │   ├── app.module.ts    # Root module
  │   ├── index.ts         # Application entry point
  │   ├── user/            # User module
  │   ├── auth/            # Authentication module
  │   └── ...              # Other modules
  ├── package.json
  └── tsconfig.json
```

## Testing

```typescript
import { Test } from '@hazeljs/core';

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UserController],
      providers: [UserService]
    }).compile();

    controller = module.get(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
```

## License

MIT 