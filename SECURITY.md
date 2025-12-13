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

**security@hazeljs.com**

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
import { AuthGuard } from '@hazeljs/core';

@Controller('/admin')
@UseGuards(AuthGuard)
export class AdminController {
  // Protected routes
}
```

### 3. Rate Limiting

Implement rate limiting to prevent abuse:

```typescript
// Coming in v1.0.0
@RateLimit({ points: 10, duration: 60 })
@Post('/login')
async login() {
  // Login logic
}
```

### 4. Security Headers

Add security headers to responses:

```typescript
import { CorsMiddleware } from '@hazeljs/core';

// Configure CORS properly
app.use(CorsMiddleware({
  origin: ['https://yourdomain.com'],
  credentials: true
}));
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

Use parameterized queries (Prisma does this automatically):

```typescript
// Safe with Prisma
const user = await prisma.user.findUnique({
  where: { email: userInput }
});

// Avoid raw SQL unless necessary
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
- npm: https://www.npmjs.com/package/@hazeljs/core\?activeTab\=versions

## Bug Bounty Program

We currently do not have a bug bounty program, but we deeply appreciate security researchers who responsibly disclose vulnerabilities.

## Contact

For security concerns, contact:
- Email: security@hazeljs.com
- PGP Key: (Coming soon)

For general questions:
- GitHub Discussions: https://github.com/hazel-js/hazeljs/discussions
- Discord: (Coming soon)

---

Thank you for helping keep HazelJS and our users safe!
