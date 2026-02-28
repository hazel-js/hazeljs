# @hazeljs/core

**The foundation of HazelJS — DI, routing, and decorators that feel right.**

Stop wiring boilerplate. Build APIs with dependency injection, decorator-based routing, and middleware that just works. TypeScript-first, production-ready, zero Express dependency.

[![npm version](https://img.shields.io/npm/v/@hazeljs/core.svg)](https://www.npmjs.com/package/@hazeljs/core)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/core)](https://www.npmjs.com/package/@hazeljs/core)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- 🎯 **Dependency Injection** - Advanced DI with Singleton, Transient, and Request scopes
- 🎨 **Decorator-Based API** - Clean, intuitive programming model
- 🛣️ **Routing** - Express-based routing with parameter extraction
- 🔌 **Middleware Support** - Global and route-level middleware
- 🛡️ **Guards & Interceptors** - Request validation and transformation
- 🔧 **Pipes** - Data transformation and validation
- 🏥 **Health Checks** - Built-in liveness, readiness, and startup probes
- 🛑 **Graceful Shutdown** - Proper cleanup and connection draining
- 📊 **Logging** - Winston-based structured logging
- ✅ **Validation** - Automatic request validation with class-validator
- 🧪 **Testing Utilities** - Full testing support with TestingModule

## Installation

```bash
npm install @hazeljs/core
```

## Quick Start

### 1. Create a Controller

```typescript
import { Controller, Get, Post, Body, Param } from '@hazeljs/core';

@Controller('/users')
export class UserController {
  @Get()
  findAll() {
    return { users: [] };
  }

  @Get('/:id')
  findOne(@Param('id') id: string) {
    return { id, name: 'John Doe' };
  }

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return { message: 'User created', data: createUserDto };
  }
}
```

### 2. Create a Service

```typescript
import { Injectable } from '@hazeljs/core';

@Injectable()
export class UserService {
  private users = [];

  findAll() {
    return this.users;
  }

  findOne(id: string) {
    return this.users.find(user => user.id === id);
  }

  create(data: any) {
    const user = { id: Date.now().toString(), ...data };
    this.users.push(user);
    return user;
  }
}
```

### 3. Create a Module

```typescript
import { HazelModule } from '@hazeljs/core';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@HazelModule({
  controllers: [UserController],
  providers: [UserService],
})
export class AppModule {}
```

### 4. Bootstrap the Application

```typescript
import { HazelApp, BuiltInHealthChecks } from '@hazeljs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await HazelApp.create(AppModule);

  // Register health checks
  app.registerHealthCheck(BuiltInHealthChecks.memoryCheck(500));
  app.registerHealthCheck(BuiltInHealthChecks.eventLoopCheck(100));

  // Register shutdown handlers
  app.registerShutdownHandler({
    name: 'cleanup',
    handler: async () => {
      console.log('Cleaning up resources...');
    },
    timeout: 5000,
  });

  await app.listen(3000);
}

bootstrap();
```

## Dependency Injection

### Scopes

```typescript
import { Injectable, Scope } from '@hazeljs/core';

// Singleton (default) - one instance for entire app
@Injectable()
export class SingletonService {}

// Transient - new instance every time
@Injectable({ scope: Scope.TRANSIENT })
export class TransientService {}

// Request - one instance per HTTP request
@Injectable({ scope: Scope.REQUEST })
export class RequestContextService {}
```

### Constructor Injection

```typescript
@Injectable()
export class OrderService {
  constructor(
    private userService: UserService,
    private paymentService: PaymentService
  ) {}

  async createOrder(userId: string) {
    const user = await this.userService.findOne(userId);
    const payment = await this.paymentService.process(user);
    return { user, payment };
  }
}
```

## Routing & Decorators

### HTTP Methods

```typescript
import { Controller, Get, Post, Put, Delete, Patch } from '@hazeljs/core';

@Controller('/api')
export class ApiController {
  @Get('/items')
  getItems() {}

  @Post('/items')
  createItem() {}

  @Put('/items/:id')
  updateItem() {}

  @Patch('/items/:id')
  patchItem() {}

  @Delete('/items/:id')
  deleteItem() {}
}
```

### Parameter Decorators

```typescript
import { Controller, Get, Post, Param, Query, Body, Headers, Req, Res } from '@hazeljs/core';

@Controller('/users')
export class UserController {
  @Get('/:id')
  findOne(
    @Param('id') id: string,
    @Query('include') include?: string
  ) {
    return { id, include };
  }

  @Post()
  create(
    @Body() createUserDto: CreateUserDto,
    @Headers('authorization') auth: string
  ) {
    return { data: createUserDto, auth };
  }

  @Get('/raw')
  rawAccess(@Req() req: Request, @Res() res: Response) {
    res.json({ message: 'Direct access to req/res' });
  }
}
```

## Middleware

### Global Middleware

```typescript
import { Middleware, MiddlewareContext } from '@hazeljs/core';

@Injectable()
export class LoggerMiddleware implements Middleware {
  async use(context: MiddlewareContext, next: () => Promise<void>) {
    console.log(`${context.request.method} ${context.request.url}`);
    await next();
  }
}

// Register globally
const app = await HazelApp.create(AppModule);
app.useGlobalMiddleware(new LoggerMiddleware());
```

### Route-Level Middleware

```typescript
import { Controller, Get, UseMiddleware } from '@hazeljs/core';

@Controller('/admin')
@UseMiddleware(AuthMiddleware)
export class AdminController {
  @Get('/dashboard')
  @UseMiddleware(RoleCheckMiddleware)
  getDashboard() {
    return { data: 'admin dashboard' };
  }
}
```

## Guards

```typescript
import { Guard, GuardContext } from '@hazeljs/core';

@Injectable()
export class AuthGuard implements Guard {
  canActivate(context: GuardContext): boolean | Promise<boolean> {
    const token = context.request.headers.authorization;
    return this.validateToken(token);
  }

  private validateToken(token: string): boolean {
    // Validate JWT token
    return !!token;
  }
}

// Use in controller
@Controller('/protected')
@UseGuard(AuthGuard)
export class ProtectedController {
  @Get()
  getData() {
    return { message: 'Protected data' };
  }
}
```

## Interceptors

```typescript
import { Interceptor, InterceptorContext } from '@hazeljs/core';

@Injectable()
export class TransformInterceptor implements Interceptor {
  async intercept(context: InterceptorContext, next: () => Promise<any>) {
    const result = await next();
    
    return {
      data: result,
      timestamp: new Date().toISOString(),
      path: context.request.url,
    };
  }
}

// Use globally or per route
@Controller('/api')
@UseInterceptor(TransformInterceptor)
export class ApiController {}
```

## Pipes

```typescript
import { Pipe, PipeContext } from '@hazeljs/core';

@Injectable()
export class ValidationPipe implements Pipe {
  transform(value: any, context: PipeContext) {
    if (!value) {
      throw new Error('Value is required');
    }
    return value;
  }
}

// Use in route
@Post()
create(@Body(ValidationPipe) createDto: CreateDto) {
  return createDto;
}
```

## Validation

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  name: string;
}

@Controller('/users')
export class UserController {
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    // Automatically validated before reaching here
    return createUserDto;
  }
}
```

## Health Checks

```typescript
import { HazelApp, BuiltInHealthChecks } from '@hazeljs/core';

const app = await HazelApp.create(AppModule);

// Built-in checks
app.registerHealthCheck(BuiltInHealthChecks.memoryCheck(500)); // 500MB threshold
app.registerHealthCheck(BuiltInHealthChecks.eventLoopCheck(100)); // 100ms lag

// Custom health check
app.registerHealthCheck({
  name: 'database',
  check: async () => {
    try {
      await database.ping();
      return { status: 'healthy' };
    } catch (error) {
      return { 
        status: 'unhealthy',
        message: error.message 
      };
    }
  },
  critical: true,
  timeout: 3000,
});

// Endpoints available:
// GET /health  - Liveness probe
// GET /ready   - Readiness probe
// GET /startup - Startup probe
```

## Graceful Shutdown

```typescript
const app = await HazelApp.create(AppModule);

app.registerShutdownHandler({
  name: 'database',
  handler: async () => {
    await database.disconnect();
    console.log('Database disconnected');
  },
  timeout: 5000,
});

app.registerShutdownHandler({
  name: 'cache',
  handler: async () => {
    await redis.quit();
    console.log('Redis connection closed');
  },
  timeout: 3000,
});

await app.listen(3000);

// On SIGTERM/SIGINT:
// 1. HTTP server stops accepting new connections
// 2. Existing requests complete (up to 10s)
// 3. Shutdown handlers execute in order
// 4. Process exits cleanly
```

## Exception Handling

```typescript
import { ExceptionFilter, ExceptionContext } from '@hazeljs/core';

@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(error: Error, context: ExceptionContext) {
    const response = context.response;
    
    response.status(500).json({
      statusCode: 500,
      message: error.message,
      timestamp: new Date().toISOString(),
      path: context.request.url,
    });
  }
}

// Use globally
app.useGlobalExceptionFilter(new HttpExceptionFilter());
```

## Testing

```typescript
import { TestingModule } from '@hazeljs/core';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  let module: TestingModule;
  let controller: UserController;
  let service: UserService;

  beforeEach(async () => {
    module = await TestingModule.create({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            findAll: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    });

    controller = module.get(UserController);
    service = module.get(UserService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('should return all users', async () => {
    const result = await controller.findAll();
    expect(result).toEqual([]);
    expect(service.findAll).toHaveBeenCalled();
  });
});
```

## API Reference

### Decorators

- `@HazelModule(options)` - Define a module
- `@Controller(path)` - Define a controller
- `@Injectable(options?)` - Mark class as injectable
- `@Get(path?)`, `@Post(path?)`, `@Put(path?)`, `@Delete(path?)`, `@Patch(path?)` - HTTP methods
- `@Param(name)`, `@Query(name)`, `@Body()`, `@Headers(name)` - Parameter extraction
- `@UseMiddleware(middleware)` - Apply middleware
- `@UseGuard(guard)` - Apply guard
- `@UseInterceptor(interceptor)` - Apply interceptor

### Classes

- `HazelApp` - Main application class
- `TestingModule` - Testing utilities
- `Logger` - Logging service

## Examples

See the [examples](../../example) directory for complete working examples.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

Apache 2.0 © [HazelJS](https://hazeljs.com)

## Links

- [Documentation](https://hazeljs.com/docs)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazel-js/hazeljs/issues)
- [Discord](https://discord.gg/hazeljs)
