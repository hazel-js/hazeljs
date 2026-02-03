# Guards

Guards are a powerful feature that determines whether a request should be handled by the route handler or not. They are primarily used for **authentication** and **authorization** logic.

## Use Cases

Guards are commonly used for:

- **Authentication**: Verify user identity
- **Authorization**: Check user permissions and roles
- **Rate limiting**: Limit request frequency
- **Feature flags**: Enable/disable features conditionally
- **Tenant isolation**: Multi-tenant access control

## Creating a Guard

A guard is a class that implements the `CanActivate` interface:

```typescript
import { CanActivate, ExecutionContext, Injectable } from '@hazeljs/core';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Validate request
    return this.validateRequest(request);
  }

  private validateRequest(request: any): boolean {
    // Your validation logic here
    return true;
  }
}
```

The `canActivate()` method should return:
- `true` - Allow the request to proceed
- `false` - Deny the request (returns 403 Forbidden)
- `Promise<boolean>` - For async validation

## Using Guards

### Method-scoped Guards

Apply to a single route handler:

```typescript
import { Controller, Get, UseGuards } from '@hazeljs/core';
import { AuthGuard } from './guards/auth.guard';

@Controller('users')
export class UsersController {
  @Get('profile')
  @UseGuards(AuthGuard)
  getProfile() {
    return { message: 'This is a protected route' };
  }
}
```

### Controller-scoped Guards

Apply to all routes in a controller:

```typescript
@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  // All routes require authentication and admin role
}
```

### Global Guards

Apply to all routes in your application:

```typescript
import { HazelApp } from '@hazeljs/core';
import { AuthGuard } from './guards/auth.guard';

const app = await HazelApp.create(AppModule);

app.useGlobalGuards(new AuthGuard());

await app.listen(3000);
```

## Authentication Guard

Here's a complete authentication guard using JWT:

```typescript
import { 
  CanActivate, 
  ExecutionContext, 
  Injectable,
  UnauthorizedError,
} from '@hazeljs/core';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedError('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      
      // Attach user to request for use in handlers
      request.user = payload;
      
      return true;
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }
}
```

Usage:

```typescript
@Controller('users')
export class UsersController {
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: Request) {
    // req.user is available here
    return { user: req.user };
  }
}
```

## Role-based Authorization Guard

Check if the user has the required role:

```typescript
import { 
  CanActivate, 
  ExecutionContext, 
  Injectable,
  ForbiddenError,
} from '@hazeljs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private requiredRoles: string[]) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenError('User not authenticated');
    }

    const hasRole = this.requiredRoles.some(role => 
      user.roles?.includes(role)
    );

    if (!hasRole) {
      throw new ForbiddenError(
        `Required roles: ${this.requiredRoles.join(', ')}`
      );
    }

    return true;
  }
}
```

### Custom Roles Decorator

Create a decorator to specify required roles:

```typescript
import { SetMetadata } from '@hazeljs/core';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
```

Enhanced RolesGuard that reads from metadata:

```typescript
import { 
  CanActivate, 
  ExecutionContext, 
  Injectable,
  ForbiddenError,
} from '@hazeljs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    
    // Get required roles from metadata
    const requiredRoles = Reflect.getMetadata('roles', handler) || [];
    
    if (requiredRoles.length === 0) {
      return true; // No roles required
    }

    const user = request.user;
    
    if (!user) {
      throw new ForbiddenError('User not authenticated');
    }

    const hasRole = requiredRoles.some(role => 
      user.roles?.includes(role)
    );

    if (!hasRole) {
      throw new ForbiddenError(
        `Required roles: ${requiredRoles.join(', ')}`
      );
    }

    return true;
  }
}
```

Usage with custom decorator:

```typescript
@Controller('admin')
export class AdminController {
  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  getAllUsers() {
    return this.usersService.findAll();
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin')
  deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
```

## Permission-based Guard

Check specific permissions instead of roles:

```typescript
import { 
  CanActivate, 
  ExecutionContext, 
  Injectable,
  ForbiddenError,
} from '@hazeljs/core';

export const RequirePermissions = (...permissions: string[]) => 
  SetMetadata('permissions', permissions);

@Injectable()
export class PermissionsGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    
    const requiredPermissions = Reflect.getMetadata('permissions', handler) || [];
    
    if (requiredPermissions.length === 0) {
      return true;
    }

    const user = request.user;
    
    if (!user) {
      throw new ForbiddenError('User not authenticated');
    }

    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every(permission =>
      user.permissions?.includes(permission)
    );

    if (!hasAllPermissions) {
      throw new ForbiddenError(
        `Missing required permissions: ${requiredPermissions.join(', ')}`
      );
    }

    return true;
  }
}
```

Usage:

```typescript
@Controller('posts')
export class PostsController {
  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('posts:create')
  create(@Body() createPostDto: CreatePostDto) {
    return this.postsService.create(createPostDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('posts:delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.remove(id);
  }
}
```

## API Key Guard

Validate API keys for external integrations:

```typescript
import { 
  CanActivate, 
  ExecutionContext, 
  Injectable,
  UnauthorizedError,
} from '@hazeljs/core';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedError('API key is required');
    }

    const isValid = await this.apiKeysService.validate(apiKey);

    if (!isValid) {
      throw new UnauthorizedError('Invalid API key');
    }

    // Optionally attach API key metadata to request
    const keyData = await this.apiKeysService.getKeyData(apiKey);
    request.apiKey = keyData;

    return true;
  }
}
```

## Rate Limiting Guard

Limit the number of requests from a client:

```typescript
import { 
  CanActivate, 
  ExecutionContext, 
  Injectable,
} from '@hazeljs/core';
import { TooManyRequestsError } from '../exceptions/http.exception';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private requests = new Map<string, number[]>();

  constructor(private options: RateLimitOptions = {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
  }) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const clientId = this.getClientId(request);
    
    const now = Date.now();
    const windowStart = now - this.options.windowMs;

    // Get existing requests for this client
    let clientRequests = this.requests.get(clientId) || [];
    
    // Filter out old requests outside the window
    clientRequests = clientRequests.filter(time => time > windowStart);
    
    // Check if limit exceeded
    if (clientRequests.length >= this.options.maxRequests) {
      throw new TooManyRequestsError(
        `Rate limit exceeded. Max ${this.options.maxRequests} requests per ${this.options.windowMs / 1000}s`
      );
    }

    // Add current request
    clientRequests.push(now);
    this.requests.set(clientId, clientRequests);

    return true;
  }

  private getClientId(request: any): string {
    // Use IP address or user ID
    return request.user?.id || request.ip || 'anonymous';
  }
}
```

Usage:

```typescript
@Controller('api')
export class ApiController {
  @Post('data')
  @UseGuards(new RateLimitGuard({ windowMs: 60000, maxRequests: 10 }))
  postData(@Body() data: any) {
    return this.service.process(data);
  }
}
```

## Combining Multiple Guards

Guards are executed in the order they are listed:

```typescript
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, RateLimitGuard)
export class AdminController {
  // 1. JwtAuthGuard - Verify authentication
  // 2. RolesGuard - Check user role
  // 3. RateLimitGuard - Check rate limit
}
```

If any guard returns `false` or throws an exception, the request is denied and subsequent guards are not executed.

## Conditional Guards

Create guards that apply conditionally:

```typescript
import { 
  CanActivate, 
  ExecutionContext, 
  Injectable,
} from '@hazeljs/core';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(private featureName: string) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isEnabled = await this.checkFeatureFlag(this.featureName);
    
    if (!isEnabled) {
      throw new ForbiddenError(`Feature '${this.featureName}' is not enabled`);
    }

    return true;
  }

  private async checkFeatureFlag(feature: string): Promise<boolean> {
    // Check feature flag from database, config, or feature flag service
    return process.env[`FEATURE_${feature.toUpperCase()}`] === 'true';
  }
}
```

Usage:

```typescript
@Controller('beta')
export class BetaController {
  @Get('new-feature')
  @UseGuards(new FeatureFlagGuard('new-feature'))
  newFeature() {
    return { message: 'This is a beta feature' };
  }
}
```

## Complete Example

Here's a comprehensive example with authentication and authorization:

<div class="filename">guards/jwt-auth.guard.ts</div>

```typescript
import { 
  CanActivate, 
  ExecutionContext, 
  Injectable,
  UnauthorizedError,
} from '@hazeljs/core';
import { JwtService } from '../services/jwt.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    try {
      const payload = await this.jwtService.verify(token);
      request.user = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedError('Invalid token');
    }
  }

  private extractToken(request: any): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;
    
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }
}
```

<div class="filename">guards/roles.guard.ts</div>

```typescript
import { 
  CanActivate, 
  ExecutionContext, 
  Injectable,
  ForbiddenError,
} from '@hazeljs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    
    const requiredRoles = Reflect.getMetadata('roles', handler);
    
    if (!requiredRoles) {
      return true;
    }

    const user = request.user;
    
    if (!user) {
      throw new ForbiddenError('User not found');
    }

    const hasRole = requiredRoles.some(role => user.roles?.includes(role));

    if (!hasRole) {
      throw new ForbiddenError('Insufficient permissions');
    }

    return true;
  }
}
```

<div class="filename">decorators/roles.decorator.ts</div>

```typescript
export const Roles = (...roles: string[]) => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (propertyKey && descriptor) {
      Reflect.defineMetadata('roles', roles, descriptor.value);
    }
  };
};
```

<div class="filename">users.controller.ts</div>

```typescript
import { 
  Controller, 
  Get, 
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@hazeljs/core';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('profile')
  getProfile(@Req() req: Request) {
    return req.user;
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  findAll() {
    return this.usersService.findAll();
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'moderator')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
```

## Best Practices

1. **Keep guards focused**: Each guard should have a single responsibility
2. **Order matters**: Apply guards in the correct order (auth before authz)
3. **Throw descriptive errors**: Provide clear error messages
4. **Use dependency injection**: Inject services into guards for flexibility
5. **Cache when possible**: Cache validation results to improve performance
6. **Test thoroughly**: Write tests for all guard scenarios
7. **Document requirements**: Clearly document what each guard checks

## What's Next?

- Learn about [Middleware](/docs/guides/middleware) for request preprocessing
- Understand [Interceptors](/docs/guides/interceptors) to transform responses
- Explore [Exception Filters](/docs/guides/exception-filters) for error handling
- Add [Pipes](/docs/guides/pipes) for data validation and transformation
