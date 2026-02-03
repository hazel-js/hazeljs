# Troubleshooting Guide

Common issues and solutions when working with HazelJS.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Runtime Errors](#runtime-errors)
- [Dependency Injection Issues](#dependency-injection-issues)
- [Database Issues](#database-issues)
- [Performance Issues](#performance-issues)
- [TypeScript Issues](#typescript-issues)
- [Testing Issues](#testing-issues)

---

## Installation Issues

### npm install fails

**Problem**: Installation fails with errors

**Solutions**:

1. Clear npm cache:
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

2. Use correct Node.js version (18+):
   ```bash
   node --version  # Should be 18.x or higher
   nvm use 18      # If using nvm
   ```

3. Check for conflicting dependencies:
   ```bash
   npm ls
   ```

### TypeScript errors during installation

**Problem**: TypeScript compilation errors

**Solution**: Ensure TypeScript is installed:
```bash
npm install -D typescript@latest
npm run build
```

---

## Runtime Errors

### "Cannot find module '@hazeljs/core'"

**Problem**: Module not found error

**Solutions**:

1. Ensure package is installed:
   ```bash
   npm install @hazeljs/core
   ```

2. Check import path:
   ```typescript
   // Correct
   import { HazelApp } from '@hazeljs/core';
   
   // Wrong
   import { HazelApp } from '@hazeljs/core';
   ```

### "reflect-metadata shim is required"

**Problem**: This error should no longer occur as `@hazeljs/core` now imports `reflect-metadata` automatically.

**If you still see this error**:
- Make sure you're using the latest version of `@hazeljs/core`
- Ensure `reflect-metadata` is installed: `npm install reflect-metadata`
- The core package handles the import automatically, so you don't need to import it manually

### "Circular dependency detected"

**Problem**: Circular dependency in DI container

**Solutions**:

1. Use forwardRef:
   ```typescript
   @Injectable()
   export class ServiceA {
     constructor(
       @Inject(forwardRef(() => ServiceB))
       private serviceB: ServiceB
     ) {}
   }
   ```

2. Refactor to remove circular dependency (preferred):
   - Extract shared logic to a third service
   - Use events/pub-sub pattern
   - Restructure dependencies

### "Provider not found"

**Problem**: Service not registered in module

**Solution**: Add to module providers:
```typescript
@HazelModule({
  providers: [UserService, AuthService], // Add here
  controllers: [UserController],
})
export class UserModule {}
```

---

## Dependency Injection Issues

### Request-scoped provider memory leak

**Problem**: Memory grows over time with request-scoped providers

**Solution**: Ensure proper cleanup:
```typescript
@Injectable({ scope: Scope.REQUEST })
export class RequestService implements OnModuleDestroy {
  onModuleDestroy() {
    // Clean up resources
  }
}
```

### Provider not injected (undefined)

**Problem**: Injected service is undefined

**Solutions**:

1. Check provider is in module:
   ```typescript
   @HazelModule({
     providers: [MyService], // Must be here
   })
   ```

2. Check decorator is applied:
   ```typescript
   @Injectable() // Must have this
   export class MyService {}
   ```

3. Check import order:
   ```typescript
   // Note: reflect-metadata is now imported automatically by @hazeljs/core
   // You no longer need to import it manually
   import { MyService } from './my.service';
   ```

---

## Database Issues

### Prisma Client not generated

**Problem**: "Cannot find module '@prisma/client'"

**Solution**: Generate Prisma client:
```bash
npm run prisma:generate
# or
npx prisma generate
```

### Database connection fails

**Problem**: Cannot connect to database

**Solutions**:

1. Check DATABASE_URL in .env:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
   ```

2. Ensure database is running:
   ```bash
   npm run db:up
   # or check if PostgreSQL is running
   ```

3. Test connection:
   ```bash
   npx prisma db pull
   ```

### Migration fails

**Problem**: Prisma migration errors

**Solutions**:

1. Reset database (development only):
   ```bash
   npm run prisma:reset
   ```

2. Create new migration:
   ```bash
   npx prisma migrate dev --name fix_schema
   ```

3. Check schema syntax:
   ```bash
   npx prisma format
   npx prisma validate
   ```

---

## Performance Issues

### Slow startup time

**Problem**: Application takes long to start

**Solutions**:

1. Use lazy loading for heavy modules
2. Optimize imports (avoid barrel exports)
3. Profile startup:
   ```typescript
   console.time('bootstrap');
   const app = new HazelApp(AppModule);
   await app.listen(3000);
   console.timeEnd('bootstrap');
   ```

### High memory usage

**Problem**: Memory usage grows over time

**Solutions**:

1. Check for memory leaks:
   ```bash
   node --inspect src/index.js
   # Use Chrome DevTools to profile
   ```

2. Avoid global state
3. Clean up subscriptions and timers
4. Use request-scoped providers carefully

### Slow response times

**Problem**: API responses are slow

**Solutions**:

1. Add caching:
   ```typescript
   @Cache({ ttl: 3600 })
   @Get('/users')
   async getUsers() {
     return this.userService.findAll();
   }
   ```

2. Optimize database queries:
   ```typescript
   // Include relations in one query
   const users = await prisma.user.findMany({
     include: { posts: true }
   });
   ```

3. Use pagination:
   ```typescript
   @Get('/users')
   async getUsers(@Query('page') page: number) {
     return this.userService.findAll({
       skip: (page - 1) * 10,
       take: 10
     });
   }
   ```

---

## TypeScript Issues

### "Decorator metadata not found"

**Problem**: Decorators don't work

**Solution**: Enable in tsconfig.json:
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### Type errors with decorators

**Problem**: TypeScript errors with parameter decorators

**Solution**: Ensure correct order:
```typescript
// Correct order
@Get(':id')
async getUser(
  @Param('id') id: string,
  @Req() req: Request
) {}

// Wrong - parameters must match decorator order
@Get(':id')
async getUser(
  @Req() req: Request,  // Wrong position
  @Param('id') id: string
) {}
```

---

## Testing Issues

### Tests fail with "Cannot resolve dependency"

**Problem**: DI doesn't work in tests

**Solution**: Use TestingModule:
```typescript
import { Test } from '@hazeljs/core';

const module = await Test.createTestingModule({
  providers: [UserService],
}).compile();

const service = module.get(UserService);
```

### Mock providers not working

**Problem**: Real services used instead of mocks

**Solution**: Override providers:
```typescript
const module = await Test.createTestingModule({
  providers: [UserService],
})
.overrideProvider(UserService)
.useValue(mockUserService)
.compile();
```

### Tests timeout

**Problem**: Tests hang and timeout

**Solutions**:

1. Close connections after tests:
   ```typescript
   afterAll(async () => {
     await app.close();
     await prisma.$disconnect();
   });
   ```

2. Increase timeout:
   ```typescript
   jest.setTimeout(10000);
   ```

---

## Common Error Messages

### "Port already in use"

**Solution**:
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
await app.listen(3001);
```

### "ECONNREFUSED"

**Solution**: Database not running
```bash
npm run db:up
```

### "Module not found"

**Solution**: Check import paths and module registration

---

## Getting Help

If you can't find a solution here:

1. **Check Documentation**
   - [QUICKSTART.md](QUICKSTART.md)
   - [IMPROVEMENTS.md](IMPROVEMENTS.md)
   - [README.md](README.md)

2. **Search Issues**
   - GitHub Issues: https://github.com/hazeljs/hazel-js/issues
3. **Ask Community**
   - GitHub Discussions: https://github.com/hazel-js/hazeljs/discussions
   - Discord: (Coming soon)

4. **Report Bug**
   - Create detailed issue with:
     - Error message
     - Code example
     - Environment details
     - Steps to reproduce

---

## Debug Mode

Enable debug logging:

```typescript
// Set environment variable
process.env.DEBUG = 'hazeljs:*';

// Or in .env file
DEBUG=hazeljs:*
```

---

Still stuck? Open an issue on GitHub with:
- Error message
- Code example (minimal reproducible)
- Environment (Node version, OS, etc.)
- What you've tried

We're here to help! 🚀
