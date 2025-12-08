# Security Guide

HazelJS provides comprehensive security features to help you build secure applications. This guide covers all security features and best practices.

## Table of Contents

- [Security Headers](#security-headers)
- [Rate Limiting](#rate-limiting)
- [CSRF Protection](#csrf-protection)
- [Input Sanitization](#input-sanitization)
- [Request Validation](#request-validation)
- [SQL Injection Prevention](#sql-injection-prevention)
- [XSS Prevention](#xss-prevention)
- [Best Practices](#best-practices)

## Security Headers

Security headers help protect your application from various attacks. HazelJS provides a built-in middleware for setting security headers.

### Basic Usage

```typescript
import { HazelApp, HazelModule, Controller, Get } from '@hazeljs/core';
import { SecurityHeadersMiddleware } from '@hazeljs/core';
import { AppModule } from './app.module';

const app = new HazelApp(AppModule);

// Add security headers middleware
app.use(new SecurityHeadersMiddleware({
  noSniff: true,
  frameOptions: 'DENY',
  xssProtection: true,
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
  },
  hidePoweredBy: true,
}));

await app.listen(3000);
```

### Advanced Configuration

```typescript
import { SecurityHeadersMiddleware } from '@hazeljs/core';

app.use(new SecurityHeadersMiddleware({
  // Content Security Policy
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
    upgradeInsecureRequests: true,
  },
  // Referrer Policy
  referrerPolicy: 'strict-origin-when-cross-origin',
  // Permissions Policy
  permissionsPolicy: {
    geolocation: ['()'],
    camera: ['()'],
    microphone: ['()'],
  },
}));
```

## Rate Limiting

Rate limiting prevents abuse by limiting the number of requests from a single IP address.

### Basic Usage

```typescript
import { RateLimitMiddleware } from '@hazeljs/core';

// Limit to 100 requests per 15 minutes
app.use(new RateLimitMiddleware({
  max: 100,
  windowMs: 15 * 60 * 1000, // 15 minutes
}));
```

### Advanced Configuration

```typescript
import { RateLimitMiddleware } from '@hazeljs/core';

app.use(new RateLimitMiddleware({
  max: 10,
  windowMs: 60 * 1000, // 1 minute
  keyGenerator: (req) => {
    // Custom key generation (e.g., by user ID)
    const userId = req.headers['x-user-id'];
    return userId || req.socket?.remoteAddress || 'unknown';
  },
  message: 'Too many requests, please try again later.',
  statusCode: 429,
  standardHeaders: true,
  legacyHeaders: true,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
}));
```

### Route-Specific Rate Limiting

```typescript
import { GlobalMiddlewareManager } from '@hazeljs/core';
import { RateLimitMiddleware } from '@hazeljs/core';

const middlewareManager = new GlobalMiddlewareManager();

// Stricter rate limit for login endpoint
middlewareManager.useFor(
  new RateLimitMiddleware({
    max: 5,
    windowMs: 15 * 60 * 1000, // 5 attempts per 15 minutes
  }),
  [{ path: '/auth/login', method: 'POST' }]
);
```

## CSRF Protection

CSRF (Cross-Site Request Forgery) protection prevents unauthorized actions on behalf of authenticated users.

### Basic Usage

```typescript
import { CsrfMiddleware } from '@hazeljs/core';

app.use(new CsrfMiddleware({
  cookieName: '_csrf',
  headerName: 'x-csrf-token',
  methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
}));
```

### Frontend Integration

```html
<!-- Get CSRF token from response header -->
<script>
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
  
  // Include in requests
  fetch('/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({ name: 'John' }),
  });
</script>
```

### Exclude Specific Paths

```typescript
app.use(new CsrfMiddleware({
  excludePaths: ['/webhook', '/api/public'],
}));
```

## Input Sanitization

Always sanitize user input to prevent XSS and injection attacks.

### String Sanitization

```typescript
import { sanitizeString, sanitizeHtml, escapeHtml } from '@hazeljs/core';

// Sanitize plain text
const clean = sanitizeString(userInput);

// Sanitize HTML
const cleanHtml = sanitizeHtml(userInput);

// Escape HTML entities
const escaped = escapeHtml(userInput);
```

### Object Sanitization

```typescript
import { sanitizeObject } from '@hazeljs/core';

@Post()
async createUser(@Body() userData: CreateUserDto) {
  // Sanitize all string fields
  const sanitized = sanitizeObject(userData, {
    sanitizeStrings: true,
    sanitizeHtml: false,
    allowedKeys: ['name', 'email', 'bio'],
  });
  
  return this.userService.create(sanitized);
}
```

### URL and Email Validation

```typescript
import { sanitizeUrl, sanitizeEmail } from '@hazeljs/core';

const url = sanitizeUrl(userInput); // Returns empty string if invalid
const email = sanitizeEmail(userInput); // Returns empty string if invalid
```

## Request Validation

Use DTOs with class-validator for automatic validation.

### DTO Definition

```typescript
import { IsString, IsEmail, MinLength, MaxLength, IsOptional } from 'class-validator';
import { Expose } from 'class-transformer';

export class CreateUserDto {
  @Expose()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @Expose()
  @IsEmail()
  email: string;

  @Expose()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
}
```

### Controller Usage

```typescript
import { Controller, Post, Body } from '@hazeljs/core';
import { ValidationPipe } from '@hazeljs/core';

@Controller('/users')
export class UserController {
  @Post()
  @UsePipes(ValidationPipe)
  async create(@Body(CreateUserDto) user: CreateUserDto) {
    // user is automatically validated and sanitized
    return this.userService.create(user);
  }
}
```

## SQL Injection Prevention

### Use Prisma (Recommended)

Prisma automatically uses parameterized queries, preventing SQL injection:

```typescript
import { PrismaService } from '@hazeljs/prisma';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    // Safe - Prisma uses parameterized queries
    return this.prisma.user.findUnique({
      where: { email },
    });
  }
}
```

### If Using Raw SQL

```typescript
import { sanitizeSql } from '@hazeljs/core';

// WARNING: Only use if absolutely necessary
// Always prefer Prisma's parameterized queries
const safeInput = sanitizeSql(userInput);
```

## XSS Prevention

### 1. Sanitize HTML Input

```typescript
import { sanitizeHtml, escapeHtml } from '@hazeljs/core';

// For user-generated HTML content
const safeHtml = sanitizeHtml(userInput);

// For plain text that will be displayed
const safeText = escapeHtml(userInput);
```

### 2. Use Content Security Policy

```typescript
app.use(new SecurityHeadersMiddleware({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"], // No 'unsafe-inline' or 'unsafe-eval'
    styleSrc: ["'self'", "'unsafe-inline'"],
  },
}));
```

### 3. Set Proper Content Types

HazelJS automatically sets `Content-Type: application/json` for JSON responses, which helps prevent XSS.

## Best Practices

### 1. Always Validate Input

```typescript
@Post()
@UsePipes(ValidationPipe)
async create(@Body(CreateUserDto) user: CreateUserDto) {
  // Validation happens automatically
}
```

### 2. Use Environment Variables

```typescript
// ✅ Good
const jwtSecret = process.env.JWT_SECRET;

// ❌ Bad
const jwtSecret = 'my-secret-key';
```

### 3. Implement Authentication

```typescript
import { UseGuards } from '@hazeljs/core';
import { AuthGuard } from '@hazeljs/auth';

@Controller('/admin')
@UseGuards(AuthGuard)
export class AdminController {
  // Protected routes
}
```

### 4. Log Security Events

```typescript
import logger from '@hazeljs/core';

// Log failed login attempts
logger.warn('Failed login attempt', {
  ip: req.socket?.remoteAddress,
  username: userInput.username,
  // Never log passwords!
});

// Log rate limit violations
logger.warn('Rate limit exceeded', {
  ip: req.socket?.remoteAddress,
  path: req.url,
});
```

### 5. Use HTTPS in Production

```typescript
const useHttps = process.env.NODE_ENV === 'production';

if (useHttps) {
  // Configure HTTPS
  const https = require('https');
  const fs = require('fs');
  
  const options = {
    key: fs.readFileSync('path/to/key.pem'),
    cert: fs.readFileSync('path/to/cert.pem'),
  };
  
  https.createServer(options, app).listen(443);
}
```

### 6. Keep Dependencies Updated

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Update dependencies
npm update
```

### 7. Implement Proper Error Handling

```typescript
import { Catch, HttpError } from '@hazeljs/core';

@Catch(HttpError)
export class GlobalExceptionFilter implements ExceptionFilter<HttpError> {
  catch(exception: HttpError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    
    // Don't expose internal errors
    const message = exception.statusCode >= 500
      ? 'Internal server error'
      : exception.message;
    
    response.status(exception.statusCode).json({
      statusCode: exception.statusCode,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

## Security Checklist

- [ ] Security headers middleware enabled
- [ ] Rate limiting configured
- [ ] CSRF protection enabled for state-changing operations
- [ ] Input validation on all endpoints
- [ ] Input sanitization for user-generated content
- [ ] Authentication and authorization implemented
- [ ] HTTPS enabled in production
- [ ] Environment variables used for secrets
- [ ] Dependencies regularly updated
- [ ] Security events logged
- [ ] Error messages don't expose sensitive information
- [ ] File uploads validated and scanned
- [ ] SQL injection prevented (use Prisma)
- [ ] XSS prevented (sanitize output)

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [HazelJS Security Policy](../SECURITY.md)

