# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| 0.1.x   | :x:                |

## Reporting a Vulnerability

The HazelJS team takes security bugs seriously. We appreciate your efforts to responsibly disclose your findings.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to:

**info@hazeljs.ai**

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

### What to Include

Please include the following information in your report:

- Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

This information will help us triage your report more quickly.

### What to Expect

After you submit a report, we will:

1. **Confirm receipt** of your vulnerability report within 48 hours
2. **Provide an initial assessment** of the report within 5 business days
3. **Keep you informed** of our progress towards a fix
4. **Notify you** when the vulnerability is fixed
5. **Credit you** in the security advisory (unless you prefer to remain anonymous)

### Disclosure Policy

- We will investigate and confirm the vulnerability
- We will prepare a fix and release it as soon as possible
- We will publicly disclose the vulnerability after the fix is released
- We will credit you in the security advisory (if desired)

### Security Update Process

1. Security fix is prepared in a private repository
2. New version is released with the fix
3. Security advisory is published
4. Users are notified via:
   - GitHub Security Advisories
   - npm security advisories
   - Discord announcement
   - Twitter/X announcement

## Security Best Practices

When using HazelJS in production, we recommend:

### 1. Input Validation

Always validate and sanitize user input:

```typescript
import { IsString, IsEmail, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

### 2. Authentication & Authorization

Use proper authentication and authorization:

```typescript
import { Controller, UseGuards } from '@hazeljs/core';
import { JwtAuthGuard, RoleGuard, TenantGuard } from '@hazeljs/auth';

// JWT verification + role check + tenant isolation
@UseGuards(JwtAuthGuard, TenantGuard({ source: 'param', key: 'orgId' }), RoleGuard('admin'))
@Controller('/orgs/:orgId/admin')
export class AdminController {
  // Protected routes — only org admins can reach this
}
```

### 3. Rate Limiting

Implement rate limiting to prevent abuse using `@hazeljs/resilience`:

```typescript
import { RateLimiter } from '@hazeljs/resilience';

// Token-bucket limiter — 10 requests per 60 seconds
const loginLimiter = new RateLimiter({
  strategy: 'sliding-window',
  max: 10,
  window: 60_000,
});

@Post('/login')
async login(@Res() res: Response) {
  if (!loginLimiter.tryAcquire()) {
    const retryAfter = Math.ceil(loginLimiter.getRetryAfterMs() / 1000);
    res.status(429).setHeader('Retry-After', String(retryAfter)).json({ error: 'Too many requests' });
    return;
  }
  // login logic
}
```

Or declaratively on any service method:

```typescript
import { WithRateLimit } from '@hazeljs/resilience';

@Service()
export class AuthService {
  @WithRateLimit({ strategy: 'sliding-window', max: 10, window: 60_000 })
  async login(email: string, password: string) {
    // login logic
  }
}
```

### 4. Security Headers

Configure CORS via `HazelApp.enableCors()` in `main.ts`:

```typescript
import { HazelApp } from '@hazeljs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = new HazelApp(AppModule);

  app.enableCors({
    origin: ['https://yourdomain.com'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  await app.listen(3000);
}
bootstrap();
```

### 5. Environment Variables

Never commit sensitive data:

```typescript
// Use environment variables
const dbUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;

// Never hardcode:
// const jwtSecret = 'my-secret-key'; // ❌ DON'T DO THIS
```

### 6. SQL Injection Prevention

Use the ORM layer — both Prisma and TypeORM use parameterized queries automatically:

```typescript
// Safe with Prisma
const user = await prisma.user.findUnique({
  where: { email: userInput },
});

// Safe with TypeORM
const user = await userRepository.findOne({
  where: { email: userInput },
});

// If raw SQL is unavoidable, always use parameters — never string interpolation
const users = await dataSource.query(
  'SELECT * FROM users WHERE email = $1',
  [userInput], // ✅ parameterized
);
// Never: `SELECT * FROM users WHERE email = '${userInput}'` ❌
```

### 7. XSS Prevention

Sanitize output and use proper content types:

```typescript
// HazelJS automatically sets proper content types
// Always validate and sanitize HTML input
```

### 8. Dependency Security

Keep dependencies updated:

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Update dependencies
npm update
```

### 9. HTTPS Only

Always use HTTPS in production:

```typescript
// Use environment-based configuration
const port = process.env.PORT || 3000;
const useHttps = process.env.NODE_ENV === 'production';
```

### 10. Logging & Monitoring

Log security events but never log sensitive data:

```typescript
import logger from '@hazeljs/core';

// Good
logger.warn('Failed login attempt', { ip, username });

// Bad - don't log passwords!
// logger.warn('Failed login', { password }); // ❌
```

## Known Security Considerations

### Dependency Injection

- Be careful with request-scoped providers and memory leaks
- Avoid circular dependencies

### File Uploads

- Always validate file types and sizes
- Scan uploaded files for malware
- Store files outside the web root

### WebSocket Connections

- Implement proper authentication for WebSocket connections
- Validate all incoming messages
- Implement rate limiting

## Security Advisories

Security advisories will be published at:

- GitHub Security Advisories: https://github.com/hazel-js/hazeljs/security/advisories
- npm: https://www.npmjs.com/package/@hazeljs/core?activeTab=versions

## Bug Bounty Program

We currently do not have a bug bounty program, but we deeply appreciate security researchers who responsibly disclose vulnerabilities.

## Contact

For security concerns, contact:
- Email: info@hazeljs.ai
- PGP Key: (Coming soon)

For general questions:
- GitHub Discussions: https://github.com/hazel-js/hazeljs/discussions
- Discord: (Coming soon)

---

Thank you for helping keep HazelJS and our users safe!
