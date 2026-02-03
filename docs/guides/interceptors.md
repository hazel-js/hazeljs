# Interceptors

Interceptors are a powerful feature that allows you to add extra logic before or after route handler execution. They can **transform** the result returned from a handler, **transform** the exception thrown from a handler, **extend** basic behavior, or completely **override** a handler depending on specific conditions.

## Use Cases

Interceptors are useful for:

- **Logging**: Log request/response details and execution time
- **Caching**: Cache responses to improve performance
- **Transformation**: Transform the response data structure
- **Error handling**: Add additional error handling logic
- **Timeout handling**: Add timeout logic to requests
- **Response mapping**: Map responses to a consistent format

## Creating an Interceptor

An interceptor is a class that implements the `Interceptor` interface:

```typescript
import { Interceptor, RequestContext, Injectable } from '@hazeljs/core';

@Injectable()
export class LoggingInterceptor implements Interceptor {
  async intercept(
    context: RequestContext,
    next: () => Promise<unknown>
  ): Promise<unknown> {
    console.log('Before handler execution...');
    
    const result = await next();
    
    console.log('After handler execution...');
    return result;
  }
}
```

The `next()` function calls the route handler. Everything before `next()` runs before the handler, and everything after runs after.

## Built-in Interceptors

HazelJS provides two built-in interceptors:

### LoggingInterceptor

Logs request details and execution time:

```typescript
import { LoggingInterceptor } from '@hazeljs/core';

@Controller('users')
@UseInterceptors(LoggingInterceptor)
export class UsersController {
  @Get()
  findAll() {
    return this.service.findAll();
  }
}
```

Output:

```
[INFO] [GET] /users
[INFO] [GET] /users - 45ms
```

### CacheInterceptor

Caches GET request responses:

```typescript
import { CacheInterceptor } from '@hazeljs/core';

@Controller('products')
export class ProductsController {
  @Get()
  @UseInterceptors(new CacheInterceptor({ ttl: 60000 })) // Cache for 60 seconds
  findAll() {
    return this.service.findAll();
  }
}
```

The `CacheInterceptor` only caches GET requests and uses the URL as the cache key.

## Using Interceptors

### Method-scoped Interceptors

Apply to a single route handler:

```typescript
import { Controller, Get, UseInterceptors } from '@hazeljs/core';
import { LoggingInterceptor } from '@hazeljs/core';

@Controller('users')
export class UsersController {
  @Get()
  @UseInterceptors(LoggingInterceptor)
  findAll() {
    return this.service.findAll();
  }
}
```

### Controller-scoped Interceptors

Apply to all routes in a controller:

```typescript
@Controller('users')
@UseInterceptors(LoggingInterceptor)
export class UsersController {
  // All routes use LoggingInterceptor
}
```

### Global Interceptors

Apply to all routes in your application:

```typescript
import { HazelApp } from '@hazeljs/core';
import { LoggingInterceptor } from '@hazeljs/core';

const app = await HazelApp.create(AppModule);

app.useGlobalInterceptors(new LoggingInterceptor());

await app.listen(3000);
```

## Response Transformation

Transform the response data before sending it to the client:

```typescript
import { Interceptor, RequestContext, Injectable } from '@hazeljs/core';

interface Response<T> {
  data: T;
  timestamp: string;
  success: boolean;
}

@Injectable()
export class TransformInterceptor<T> implements Interceptor {
  async intercept(
    context: RequestContext,
    next: () => Promise<T>
  ): Promise<Response<T>> {
    const data = await next();
    
    return {
      data,
      timestamp: new Date().toISOString(),
      success: true,
    };
  }
}
```

Usage:

```typescript
@Controller('users')
@UseInterceptors(TransformInterceptor)
export class UsersController {
  @Get()
  findAll() {
    return [{ id: 1, name: 'John' }];
  }
}
```

Response:

```json
{
  "data": [
    { "id": 1, "name": "John" }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z",
  "success": true
}
```

## Timing Interceptor

Measure and log execution time:

```typescript
import { Interceptor, RequestContext, Injectable } from '@hazeljs/core';

@Injectable()
export class TimingInterceptor implements Interceptor {
  async intercept(
    context: RequestContext,
    next: () => Promise<unknown>
  ): Promise<unknown> {
    const start = Date.now();
    const method = context.method;
    const url = context.url;
    
    console.log(`→ [${method}] ${url}`);
    
    try {
      const result = await next();
      const duration = Date.now() - start;
      console.log(`← [${method}] ${url} - ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`✗ [${method}] ${url} - ${duration}ms - Error: ${error.message}`);
      throw error;
    }
  }
}
```

## Timeout Interceptor

Add timeout logic to prevent long-running requests:

```typescript
import { Interceptor, RequestContext, Injectable } from '@hazeljs/core';

@Injectable()
export class TimeoutInterceptor implements Interceptor {
  constructor(private readonly timeout: number = 5000) {}

  async intercept(
    context: RequestContext,
    next: () => Promise<unknown>
  ): Promise<unknown> {
    return Promise.race([
      next(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), this.timeout)
      ),
    ]);
  }
}
```

Usage:

```typescript
@Get('slow-operation')
@UseInterceptors(new TimeoutInterceptor(3000)) // 3 second timeout
async slowOperation() {
  return await this.service.slowOperation();
}
```

## Error Handling Interceptor

Add custom error handling logic:

```typescript
import { Interceptor, RequestContext, Injectable } from '@hazeljs/core';
import { InternalServerError } from '@hazeljs/core';

@Injectable()
export class ErrorHandlingInterceptor implements Interceptor {
  async intercept(
    context: RequestContext,
    next: () => Promise<unknown>
  ): Promise<unknown> {
    try {
      return await next();
    } catch (error) {
      // Log error
      console.error('Interceptor caught error:', error);
      
      // Transform error
      if (error.name === 'DatabaseError') {
        throw new InternalServerError('A database error occurred');
      }
      
      // Re-throw original error
      throw error;
    }
  }
}
```

## Advanced Caching Interceptor

A more sophisticated caching implementation:

```typescript
import { Interceptor, RequestContext, Injectable } from '@hazeljs/core';

interface CacheEntry {
  data: unknown;
  timestamp: number;
  hits: number;
}

interface CacheOptions {
  ttl?: number;
  maxSize?: number;
  keyGenerator?: (context: RequestContext) => string;
}

@Injectable()
export class AdvancedCacheInterceptor implements Interceptor {
  private cache = new Map<string, CacheEntry>();
  private readonly ttl: number;
  private readonly maxSize: number;
  private readonly keyGenerator: (context: RequestContext) => string;

  constructor(options: CacheOptions = {}) {
    this.ttl = options.ttl || 60000; // 1 minute default
    this.maxSize = options.maxSize || 100;
    this.keyGenerator = options.keyGenerator || this.defaultKeyGenerator;
  }

  private defaultKeyGenerator(context: RequestContext): string {
    const query = context.query ? JSON.stringify(context.query) : '';
    return `${context.method}:${context.url}:${query}`;
  }

  async intercept(
    context: RequestContext,
    next: () => Promise<unknown>
  ): Promise<unknown> {
    // Only cache GET requests
    if (context.method !== 'GET') {
      return next();
    }

    const cacheKey = this.keyGenerator(context);
    const cached = this.cache.get(cacheKey);

    // Return cached data if valid
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      cached.hits++;
      console.log(`Cache hit: ${cacheKey} (${cached.hits} hits)`);
      return cached.data;
    }

    // Execute handler and cache result
    const result = await next();
    
    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
      hits: 0,
    });

    console.log(`Cache miss: ${cacheKey}`);
    return result;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}
```

## Request ID Interceptor

Add unique request IDs for tracing:

```typescript
import { Interceptor, RequestContext, Injectable } from '@hazeljs/core';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestIdInterceptor implements Interceptor {
  async intercept(
    context: RequestContext,
    next: () => Promise<unknown>
  ): Promise<unknown> {
    const requestId = uuidv4();
    
    // Add to context for use in handlers
    context.requestId = requestId;
    
    console.log(`[${requestId}] ${context.method} ${context.url}`);
    
    const result = await next();
    
    // Add to response headers
    if (context.response) {
      context.response.setHeader('X-Request-ID', requestId);
    }
    
    return result;
  }
}
```

## Combining Multiple Interceptors

You can apply multiple interceptors to a single handler:

```typescript
@Controller('products')
export class ProductsController {
  @Get()
  @UseInterceptors(
    LoggingInterceptor,
    new CacheInterceptor({ ttl: 30000 }),
    TransformInterceptor,
  )
  findAll() {
    return this.service.findAll();
  }
}
```

Interceptors are executed in the order they are listed:
1. LoggingInterceptor (before)
2. CacheInterceptor (before)
3. TransformInterceptor (before)
4. **Route Handler**
5. TransformInterceptor (after)
6. CacheInterceptor (after)
7. LoggingInterceptor (after)

## Complete Example

Here's a comprehensive example with multiple interceptors:

<div class="filename">interceptors/api-response.interceptor.ts</div>

```typescript
import { Interceptor, RequestContext, Injectable } from '@hazeljs/core';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta: {
    timestamp: string;
    requestId: string;
    duration: number;
  };
}

@Injectable()
export class ApiResponseInterceptor<T> implements Interceptor {
  async intercept(
    context: RequestContext,
    next: () => Promise<T>
  ): Promise<ApiResponse<T>> {
    const start = Date.now();
    const requestId = context.requestId || 'unknown';
    
    try {
      const data = await next();
      const duration = Date.now() - start;
      
      return {
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
          duration,
        },
      };
    } catch (error) {
      const duration = Date.now() - start;
      
      // Log error with context
      console.error(`Request ${requestId} failed after ${duration}ms:`, error);
      
      throw error;
    }
  }
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
  UseInterceptors,
  ParseIntPipe,
} from '@hazeljs/core';
import { 
  LoggingInterceptor,
  CacheInterceptor,
} from '@hazeljs/core';
import { ApiResponseInterceptor } from './interceptors/api-response.interceptor';
import { RequestIdInterceptor } from './interceptors/request-id.interceptor';

@Controller('products')
@UseInterceptors(RequestIdInterceptor, LoggingInterceptor)
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  @UseInterceptors(
    new CacheInterceptor({ ttl: 60000 }),
    ApiResponseInterceptor,
  )
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  @UseInterceptors(ApiResponseInterceptor)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @Post()
  @UseInterceptors(ApiResponseInterceptor)
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }
}
```

Response format:

```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Product 1" },
    { "id": 2, "name": "Product 2" }
  ],
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "duration": 45
  }
}
```

## Best Practices

1. **Keep interceptors focused**: Each interceptor should have a single responsibility
2. **Order matters**: Be mindful of the order when applying multiple interceptors
3. **Handle errors**: Always handle errors appropriately in interceptors
4. **Use for cross-cutting concerns**: Interceptors are perfect for logging, caching, and transformation
5. **Don't mutate context unnecessarily**: Only modify context when needed
6. **Consider performance**: Be careful with interceptors that add significant overhead
7. **Make them reusable**: Design interceptors to be reusable across different routes

## What's Next?

- Learn about [Guards](/docs/guides/guards) for authentication and authorization
- Understand [Pipes](/docs/guides/pipes) for data validation and transformation
- Explore [Exception Filters](/docs/guides/exception-filters) for error handling
- Add [Middleware](/docs/guides/middleware) for request preprocessing
