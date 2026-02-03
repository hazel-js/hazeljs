# Exception Filters

Exception filters let you control the exact flow of error handling and the response sent back to the client. HazelJS provides a built-in exception layer that handles all unhandled exceptions across your application.

## Built-in HTTP Exceptions

HazelJS provides a set of standard HTTP exception classes that you can throw from your handlers:

```typescript
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalServerError,
} from '@hazeljs/core';
```

### Using Built-in Exceptions

```typescript
import { Controller, Get, Param, ParseIntPipe } from '@hazeljs/core';
import { NotFoundError } from '@hazeljs/core';

@Controller('users')
export class UsersController {
  private users = [
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Smith' },
  ];

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    const user = this.users.find(u => u.id === id);
    
    if (!user) {
      throw new NotFoundError(`User with ID ${id} not found`);
    }
    
    return user;
  }
}
```

Response when user is not found:

```json
{
  "statusCode": 404,
  "message": "User with ID 5 not found",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/users/5"
}
```

## Available HTTP Exceptions

### BadRequestError (400)

Used for invalid client requests:

```typescript
import { BadRequestError } from '@hazeljs/core';

@Post()
create(@Body() data: any) {
  if (!data.email) {
    throw new BadRequestError('Email is required');
  }
  return this.service.create(data);
}
```

You can also pass an array of error messages:

```typescript
throw new BadRequestError('Validation failed', [
  'Email is required',
  'Password must be at least 8 characters',
]);
```

### UnauthorizedError (401)

Used when authentication is required:

```typescript
import { UnauthorizedError } from '@hazeljs/core';

@Get('profile')
getProfile(@Headers('authorization') auth: string) {
  if (!auth) {
    throw new UnauthorizedError('Authentication required');
  }
  
  const token = auth.replace('Bearer ', '');
  // Verify token...
}
```

### ForbiddenError (403)

Used when the user doesn't have permission:

```typescript
import { ForbiddenError } from '@hazeljs/core';

@Delete(':id')
remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
  const user = req.user;
  
  if (user.role !== 'admin') {
    throw new ForbiddenError('Only admins can delete users');
  }
  
  return this.service.remove(id);
}
```

### NotFoundError (404)

Used when a resource doesn't exist:

```typescript
import { NotFoundError } from '@hazeljs/core';

@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  const item = this.service.findOne(id);
  
  if (!item) {
    throw new NotFoundError(`Item #${id} not found`);
  }
  
  return item;
}
```

### ConflictError (409)

Used when there's a conflict with the current state:

```typescript
import { ConflictError } from '@hazeljs/core';

@Post()
create(@Body() data: CreateUserDto) {
  const existing = this.service.findByEmail(data.email);
  
  if (existing) {
    throw new ConflictError('User with this email already exists');
  }
  
  return this.service.create(data);
}
```

### InternalServerError (500)

Used for unexpected server errors:

```typescript
import { InternalServerError } from '@hazeljs/core';

@Get('data')
async getData() {
  try {
    return await this.externalApi.fetch();
  } catch (error) {
    throw new InternalServerError('Failed to fetch data from external API');
  }
}
```

## Custom Exception Filters

You can create custom exception filters to handle specific exceptions in a custom way.

### Creating a Custom Filter

```typescript
import { ExceptionFilter, ArgumentsHost, Catch } from '@hazeljs/core';
import { ValidationError } from '@hazeljs/core';

@Catch(ValidationError)
export class ValidationExceptionFilter implements ExceptionFilter<ValidationError> {
  catch(exception: ValidationError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    response.status(400).json({
      statusCode: 400,
      message: 'Validation failed',
      errors: exception.errors.map(err => ({
        field: err.property,
        messages: Object.values(err.constraints),
      })),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```

### Using the @Catch Decorator

The `@Catch()` decorator binds the exception filter to specific exception types:

```typescript
// Catch a single exception type
@Catch(NotFoundError)
export class NotFoundExceptionFilter implements ExceptionFilter<NotFoundError> {
  catch(exception: NotFoundError, host: ArgumentsHost): void {
    // Handle NotFoundError
  }
}

// Catch multiple exception types
@Catch(BadRequestError, ValidationError)
export class ClientErrorFilter implements ExceptionFilter {
  catch(exception: BadRequestError | ValidationError, host: ArgumentsHost): void {
    // Handle client errors
  }
}

// Catch all exceptions
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    // Handle any exception
  }
}
```

### Applying Exception Filters

#### Method-scoped Filters

Apply to a single route handler:

```typescript
import { UseFilters } from '@hazeljs/core';

@Controller('users')
export class UsersController {
  @Post()
  @UseFilters(ValidationExceptionFilter)
  create(@Body(ValidationPipe) createUserDto: CreateUserDto) {
    return this.service.create(createUserDto);
  }
}
```

#### Controller-scoped Filters

Apply to all routes in a controller:

```typescript
@Controller('users')
@UseFilters(ValidationExceptionFilter)
export class UsersController {
  // All routes use ValidationExceptionFilter
}
```

#### Global Filters

Apply to all routes in your application:

```typescript
import { HazelApp } from '@hazeljs/core';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

const app = await HazelApp.create(AppModule);

app.useGlobalFilters(new AllExceptionsFilter());

await app.listen(3000);
```

## Advanced Custom Filter Example

Here's a comprehensive exception filter that handles multiple scenarios:

```typescript
import { ExceptionFilter, ArgumentsHost, Catch } from '@hazeljs/core';
import { HttpError } from '@hazeljs/core';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = 500;
    let message = 'Internal server error';
    let errors: string[] | undefined;

    if (exception instanceof HttpError) {
      status = exception.statusCode;
      message = exception.message;
      errors = exception.errors;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const errorResponse = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      ...(errors && { errors }),
      ...(process.env.NODE_ENV === 'development' && {
        stack: exception instanceof Error ? exception.stack : undefined,
      }),
    };

    // Log the error
    console.error(`[${request.method}] ${request.url}`, {
      status,
      message,
      ...(exception instanceof Error && { stack: exception.stack }),
    });

    response.status(status).json(errorResponse);
  }
}
```

## Custom HTTP Exception

You can create your own custom HTTP exceptions:

```typescript
import { HttpError } from '@hazeljs/core';

export class PaymentRequiredError extends HttpError {
  constructor(message: string = 'Payment Required') {
    super(402, message);
    this.name = 'PaymentRequiredError';
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(message: string = 'Too Many Requests') {
    super(429, message);
    this.name = 'TooManyRequestsError';
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(message: string = 'Service Unavailable') {
    super(503, message);
    this.name = 'ServiceUnavailableError';
  }
}
```

Usage:

```typescript
@Post('premium-feature')
usePremiumFeature(@Req() req: Request) {
  if (!req.user.isPremium) {
    throw new PaymentRequiredError('This feature requires a premium subscription');
  }
  
  return this.service.usePremiumFeature();
}
```

## Exception Filter with Logging

Integrate logging into your exception filter:

```typescript
import { ExceptionFilter, ArgumentsHost, Catch } from '@hazeljs/core';
import { HttpError } from '@hazeljs/core';

@Catch(HttpError)
export class HttpExceptionFilter implements ExceptionFilter<HttpError> {
  constructor(private logger: LoggerService) {}

  catch(exception: HttpError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception.statusCode;
    const message = exception.message;

    // Log based on severity
    if (status >= 500) {
      this.logger.error(`Server Error: ${message}`, {
        url: request.url,
        method: request.method,
        statusCode: status,
        stack: exception.stack,
      });
    } else if (status >= 400) {
      this.logger.warn(`Client Error: ${message}`, {
        url: request.url,
        method: request.method,
        statusCode: status,
      });
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(exception.errors && { errors: exception.errors }),
    });
  }
}
```

## Complete Example

Here's a complete example with custom exceptions and filters:

<div class="filename">exceptions/business.exception.ts</div>

```typescript
import { HttpError } from '@hazeljs/core';

export class InsufficientFundsError extends HttpError {
  constructor(required: number, available: number) {
    super(
      400,
      `Insufficient funds. Required: $${required}, Available: $${available}`
    );
    this.name = 'InsufficientFundsError';
  }
}

export class AccountLockedError extends HttpError {
  constructor(reason: string) {
    super(403, `Account is locked: ${reason}`);
    this.name = 'AccountLockedError';
  }
}
```

<div class="filename">filters/business-exception.filter.ts</div>

```typescript
import { ExceptionFilter, ArgumentsHost, Catch } from '@hazeljs/core';
import { InsufficientFundsError, AccountLockedError } from '../exceptions/business.exception';

@Catch(InsufficientFundsError, AccountLockedError)
export class BusinessExceptionFilter implements ExceptionFilter {
  catch(exception: InsufficientFundsError | AccountLockedError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    response.status(exception.statusCode).json({
      statusCode: exception.statusCode,
      error: exception.name,
      message: exception.message,
      timestamp: new Date().toISOString(),
      path: request.url,
      type: 'business_error',
    });
  }
}
```

<div class="filename">payments.controller.ts</div>

```typescript
import { Controller, Post, Body, UseFilters } from '@hazeljs/core';
import { BusinessExceptionFilter } from './filters/business-exception.filter';
import { InsufficientFundsError, AccountLockedError } from './exceptions/business.exception';

@Controller('payments')
@UseFilters(BusinessExceptionFilter)
export class PaymentsController {
  @Post('transfer')
  transfer(@Body() data: { from: string; to: string; amount: number }) {
    const account = this.getAccount(data.from);
    
    if (account.locked) {
      throw new AccountLockedError('Too many failed login attempts');
    }
    
    if (account.balance < data.amount) {
      throw new InsufficientFundsError(data.amount, account.balance);
    }
    
    return this.processTransfer(data);
  }
}
```

## Best Practices

1. **Use specific exceptions**: Throw the most specific exception type for the error
2. **Provide helpful messages**: Include context and suggestions in error messages
3. **Don't expose sensitive data**: Avoid leaking internal details in production
4. **Log appropriately**: Log errors with enough context for debugging
5. **Use global filters**: Apply common error handling globally
6. **Handle async errors**: Ensure async operations properly propagate errors
7. **Test error scenarios**: Write tests for your exception filters

## What's Next?

- Learn about [Interceptors](/docs/guides/interceptors) to transform responses
- Understand [Guards](/docs/guides/guards) for authentication and authorization
- Explore [Pipes](/docs/guides/pipes) for data validation and transformation
- Add [Middleware](/docs/guides/middleware) for request preprocessing
