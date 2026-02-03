# HazelJS Middleware Guide

## Overview

HazelJS provides powerful middleware for common production needs: request timeouts, CORS, and rate limiting.

---

## Request Timeout Middleware

Prevent requests from hanging indefinitely with configurable timeouts.

### Basic Usage

```typescript
import { HazelApp } from '@hazeljs/core';

const app = await HazelApp.create(AppModule);

// Set global request timeout (30 seconds)
app.setRequestTimeout(30000);

await app.listen(3000);
```

### Advanced Configuration

```typescript
app.setRequestTimeout(30000, {
  message: 'Request took too long',
  onTimeout: (req) => {
    console.log(`Request timeout: ${req.method} ${req.url}`);
    // Log to monitoring service, etc.
  },
});
```

### Per-Route Timeout

```typescript
import { TimeoutMiddleware } from '@hazeljs/core';

@Controller('/api')
export class ApiController {
  @Get('/slow-operation')
  @UseMiddleware(TimeoutMiddleware.create({ timeout: 60000 })) // 60 seconds
  async slowOperation() {
    // Long-running operation
    return { status: 'completed' };
  }
}
```

### Features

- ✅ Configurable timeout duration
- ✅ Custom timeout messages
- ✅ Timeout callbacks for logging/monitoring
- ✅ Automatic cleanup
- ✅ 408 Request Timeout response

---

## CORS Middleware

Enable Cross-Origin Resource Sharing for browser applications.

### Basic Usage

```typescript
import { HazelApp } from '@hazeljs/core';

const app = await HazelApp.create(AppModule);

// Enable CORS for all origins
app.enableCors();

await app.listen(3000);
```

### Restrict Origins

```typescript
// Single origin
app.enableCors({
  origin: 'https://example.com',
});

// Multiple origins
app.enableCors({
  origin: ['https://example.com', 'https://app.example.com'],
});

// Dynamic origin validation
app.enableCors({
  origin: (origin) => {
    // Custom logic
    return origin.endsWith('.example.com');
  },
});
```

### Full Configuration

```typescript
app.enableCors({
  origin: 'https://example.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Custom-Header'],
  exposedHeaders: ['X-Total-Count'],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204,
});
```

### Disable CORS

```typescript
app.disableCors();
```

### Features

- ✅ Wildcard or specific origins
- ✅ Array of allowed origins
- ✅ Dynamic origin validation function
- ✅ Configurable HTTP methods
- ✅ Custom allowed/exposed headers
- ✅ Credentials support
- ✅ Preflight caching (max-age)
- ✅ OPTIONS request handling

---

## Rate Limiting Middleware

Protect your API from abuse with flexible rate limiting.

### Basic Usage

```typescript
import { RateLimitMiddleware } from '@hazeljs/core';

@Controller('/api')
@UseMiddleware(new RateLimitMiddleware({
  max: 100,        // 100 requests
  windowMs: 60000, // per minute
}))
export class ApiController {
  // All routes in this controller are rate-limited
}
```

### Per-Route Rate Limiting

```typescript
@Controller('/api')
export class ApiController {
  @Post('/login')
  @UseMiddleware(new RateLimitMiddleware({
    max: 5,          // 5 attempts
    windowMs: 900000, // per 15 minutes
    message: 'Too many login attempts, please try again later',
  }))
  async login(@Body() credentials: LoginDto) {
    return await this.authService.login(credentials);
  }

  @Get('/users')
  @UseMiddleware(new RateLimitMiddleware({
    max: 1000,       // 1000 requests
    windowMs: 60000, // per minute
  }))
  async getUsers() {
    return await this.userService.findAll();
  }
}
```

### Custom Key Generator

```typescript
// Rate limit by user ID instead of IP
new RateLimitMiddleware({
  max: 100,
  windowMs: 60000,
  keyGenerator: (req) => {
    const user = req.user; // Assuming auth middleware sets this
    return user?.id || 'anonymous';
  },
})
```

### Custom Store (Redis)

```typescript
import { createClient } from 'redis';

class RedisStore implements RateLimitStore {
  private client: ReturnType<typeof createClient>;

  constructor() {
    this.client = createClient();
    this.client.connect();
  }

  async get(key: string): Promise<number | null> {
    const value = await this.client.get(key);
    return value ? parseInt(value, 10) : null;
  }

  async set(key: string, value: number, ttl: number): Promise<void> {
    await this.client.setEx(key, ttl, value.toString());
  }

  async increment(key: string, ttl: number): Promise<number> {
    const value = await this.client.incr(key);
    if (value === 1) {
      await this.client.expire(key, ttl);
    }
    return value;
  }

  async reset(key: string): Promise<void> {
    await this.client.del(key);
  }
}

// Use Redis store
new RateLimitMiddleware({
  max: 100,
  windowMs: 60000,
  store: new RedisStore(),
})
```

### Rate Limit Headers

The middleware automatically sets standard rate limit headers:

```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 2025-12-09T01:00:00.000Z

X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2025-12-09T01:00:00.000Z
```

### Configuration Options

```typescript
interface RateLimitOptions {
  max: number;                    // Maximum requests
  windowMs: number;               // Time window in milliseconds
  keyGenerator?: (req) => string; // Custom key function
  store?: RateLimitStore;         // Custom storage
  message?: string;               // Error message
  statusCode?: number;            // Error status (default: 429)
  standardHeaders?: boolean;      // RateLimit-* headers
  legacyHeaders?: boolean;        // X-RateLimit-* headers
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}
```

### Features

- ✅ Per-IP rate limiting (default)
- ✅ Custom key generation (user ID, API key, etc.)
- ✅ In-memory store (default)
- ✅ Custom store support (Redis, Memcached, etc.)
- ✅ Configurable time windows
- ✅ Standard and legacy headers
- ✅ Custom error messages
- ✅ Automatic cleanup of expired entries
- ✅ Skip successful/failed requests

---

## Combining Middleware

You can combine multiple middleware for comprehensive protection:

```typescript
import { 
  HazelApp, 
  TimeoutMiddleware, 
  RateLimitMiddleware 
} from '@hazeljs/core';

const app = await HazelApp.create(AppModule);

// Global configuration
app.enableCors({
  origin: ['https://example.com'],
  credentials: true,
});

app.setRequestTimeout(30000);

// Per-controller configuration
@Controller('/api')
@UseMiddleware(new RateLimitMiddleware({
  max: 100,
  windowMs: 60000,
}))
export class ApiController {
  @Post('/upload')
  @UseMiddleware(TimeoutMiddleware.create({ timeout: 120000 })) // 2 minutes for uploads
  @UseMiddleware(new RateLimitMiddleware({
    max: 10,        // Stricter limit for uploads
    windowMs: 60000,
  }))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    return await this.fileService.upload(file);
  }
}
```

---

## Production Best Practices

### 1. Set Appropriate Timeouts

```typescript
// API endpoints: 30 seconds
app.setRequestTimeout(30000);

// File uploads: 2 minutes
@Post('/upload')
@UseMiddleware(TimeoutMiddleware.create({ timeout: 120000 }))

// Long-running operations: 5 minutes
@Post('/process')
@UseMiddleware(TimeoutMiddleware.create({ timeout: 300000 }))
```

### 2. Configure CORS Properly

```typescript
// ❌ Bad - Too permissive
app.enableCors({ origin: '*' });

// ✅ Good - Specific origins
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  credentials: true,
});
```

### 3. Use Redis for Rate Limiting in Production

```typescript
// ❌ Bad - In-memory store doesn't work with multiple instances
new RateLimitMiddleware({
  max: 100,
  windowMs: 60000,
  // Uses in-memory store by default
})

// ✅ Good - Redis store works across instances
new RateLimitMiddleware({
  max: 100,
  windowMs: 60000,
  store: new RedisStore(),
})
```

### 4. Different Limits for Different Endpoints

```typescript
// Public endpoints: Strict limits
@Get('/public/data')
@UseMiddleware(new RateLimitMiddleware({ max: 10, windowMs: 60000 }))

// Authenticated endpoints: Higher limits
@Get('/api/data')
@UseGuards(AuthGuard)
@UseMiddleware(new RateLimitMiddleware({ max: 1000, windowMs: 60000 }))

// Admin endpoints: No limits
@Get('/admin/data')
@UseGuards(AdminGuard)
// No rate limiting
```

### 5. Monitor Rate Limit Hits

```typescript
new RateLimitMiddleware({
  max: 100,
  windowMs: 60000,
  onLimitReached: (req, key) => {
    logger.warn(`Rate limit exceeded for ${key}`, {
      ip: req.ip,
      url: req.url,
      userAgent: req.headers['user-agent'],
    });
    
    // Send to monitoring service
    monitoring.trackRateLimitHit(key);
  },
})
```

---

## Troubleshooting

### Timeout Not Working

```typescript
// Make sure timeout is set before listen()
app.setRequestTimeout(30000);
await app.listen(3000); // ✅ Correct order
```

### CORS Preflight Failing

```typescript
// Make sure to allow OPTIONS method
app.enableCors({
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Include OPTIONS
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

### Rate Limiting Not Shared Across Instances

```typescript
// Use Redis store for multi-instance deployments
new RateLimitMiddleware({
  max: 100,
  windowMs: 60000,
  store: new RedisStore(), // Shared across instances
})
```

---

## Summary

HazelJS provides production-ready middleware for:

- ⏱️ **Request Timeout** - Prevent hanging requests
- 🌐 **CORS** - Enable browser applications
- 🛡️ **Rate Limiting** - Protect against abuse

All middleware is:
- ✅ Easy to configure
- ✅ Flexible and extensible
- ✅ Production-tested
- ✅ Well-documented

For more information, see the [API Reference](./api-reference.md).
