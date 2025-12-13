# @hazeljs/auth

**Authentication and JWT Module for HazelJS**

Secure your HazelJS applications with JWT-based authentication, guards, and decorators.

[![npm version](https://img.shields.io/npm/v/@hazeljs/auth.svg)](https://www.npmjs.com/package/@hazeljs/auth)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔐 **JWT Authentication** - Secure token-based authentication
- 🛡️ **Auth Guards** - Protect routes with decorators
- 👤 **User Extraction** - Get current user from request
- 🔑 **Token Management** - Generate, verify, and refresh tokens
- ⏰ **Token Expiration** - Configurable expiration times
- 🎯 **Role-Based Access** - Role and permission guards
- 🔄 **Refresh Tokens** - Long-lived refresh token support
- 📊 **Token Blacklisting** - Revoke tokens when needed

## Installation

```bash
npm install @hazeljs/auth
```

## Quick Start

### 1. Configure Auth Module

```typescript
import { HazelModule } from '@hazeljs/core';
import { AuthModule } from '@hazeljs/auth';

@HazelModule({
  imports: [
    AuthModule.forRoot({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      expiresIn: '1h',
      refreshExpiresIn: '7d',
    }),
  ],
})
export class AppModule {}
```

### 2. Create Auth Service

```typescript
import { Injectable } from '@hazeljs/core';
import { AuthService } from '@hazeljs/auth';

@Injectable()
export class UserAuthService {
  constructor(private authService: AuthService) {}

  async login(email: string, password: string) {
    // Validate credentials
    const user = await this.validateUser(email, password);
    
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Generate tokens
    const accessToken = await this.authService.generateToken({
      sub: user.id,
      email: user.email,
      roles: user.roles,
    });

    const refreshToken = await this.authService.generateRefreshToken({
      sub: user.id,
    });

    return {
      accessToken,
      refreshToken,
      user,
    };
  }

  async validateUser(email: string, password: string) {
    // Your user validation logic
    const user = await this.userService.findByEmail(email);
    
    if (user && await this.comparePasswords(password, user.password)) {
      return user;
    }
    
    return null;
  }
}
```

### 3. Protect Routes with Guards

```typescript
import { Controller, Get, Post, Body } from '@hazeljs/core';
import { UseGuard, AuthGuard, CurrentUser } from '@hazeljs/auth';

@Controller('/api')
export class ApiController {
  @Post('/login')
  async login(@Body() credentials: LoginDto) {
    return this.authService.login(credentials.email, credentials.password);
  }

  @Get('/profile')
  @UseGuard(AuthGuard)
  getProfile(@CurrentUser() user: any) {
    return { user };
  }

  @Get('/admin')
  @UseGuard(AuthGuard)
  @UseGuard(RoleGuard(['admin']))
  getAdminData(@CurrentUser() user: any) {
    return { message: 'Admin only data', user };
  }
}
```

## Authentication Flow

### Login

```typescript
@Post('/auth/login')
async login(@Body() loginDto: LoginDto) {
  const user = await this.authService.validateUser(
    loginDto.email,
    loginDto.password
  );

  if (!user) {
    throw new UnauthorizedException('Invalid credentials');
  }

  const payload = {
    sub: user.id,
    email: user.email,
    roles: user.roles,
  };

  return {
    accessToken: await this.authService.generateToken(payload),
    refreshToken: await this.authService.generateRefreshToken(payload),
  };
}
```

### Refresh Token

```typescript
@Post('/auth/refresh')
async refresh(@Body() refreshDto: RefreshDto) {
  const payload = await this.authService.verifyRefreshToken(
    refreshDto.refreshToken
  );

  return {
    accessToken: await this.authService.generateToken({
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles,
    }),
  };
}
```

### Logout

```typescript
@Post('/auth/logout')
@UseGuard(AuthGuard)
async logout(@CurrentUser() user: any, @Headers('authorization') token: string) {
  // Extract token from "Bearer <token>"
  const jwt = token.split(' ')[1];
  
  // Blacklist the token
  await this.authService.blacklistToken(jwt);
  
  return { message: 'Logged out successfully' };
}
```

## Guards

### Auth Guard

```typescript
import { AuthGuard } from '@hazeljs/auth';

@Controller('/protected')
export class ProtectedController {
  @Get()
  @UseGuard(AuthGuard)
  getData(@CurrentUser() user: any) {
    return { data: 'protected', user };
  }
}
```

### Role Guard

```typescript
import { RoleGuard } from '@hazeljs/auth';

@Controller('/admin')
export class AdminController {
  @Get('/users')
  @UseGuard(AuthGuard)
  @UseGuard(RoleGuard(['admin']))
  getAllUsers() {
    return { users: [] };
  }

  @Get('/settings')
  @UseGuard(AuthGuard)
  @UseGuard(RoleGuard(['admin', 'superadmin']))
  getSettings() {
    return { settings: {} };
  }
}
```

### Permission Guard

```typescript
import { PermissionGuard } from '@hazeljs/auth';

@Controller('/posts')
export class PostController {
  @Post()
  @UseGuard(AuthGuard)
  @UseGuard(PermissionGuard(['posts:create']))
  createPost(@Body() createPostDto: CreatePostDto) {
    return this.postService.create(createPostDto);
  }

  @Delete('/:id')
  @UseGuard(AuthGuard)
  @UseGuard(PermissionGuard(['posts:delete']))
  deletePost(@Param('id') id: string) {
    return this.postService.delete(id);
  }
}
```

## Decorators

### @CurrentUser()

Extract the authenticated user from the request:

```typescript
@Get('/me')
@UseGuard(AuthGuard)
getMe(@CurrentUser() user: any) {
  return user;
}

// With specific property
@Get('/email')
@UseGuard(AuthGuard)
getEmail(@CurrentUser('email') email: string) {
  return { email };
}
```

### @Public()

Mark routes as public (skip authentication):

```typescript
import { Public } from '@hazeljs/auth';

@Controller('/api')
@UseGuard(AuthGuard) // Applied to all routes
export class ApiController {
  @Get('/public')
  @Public() // This route skips authentication
  getPublicData() {
    return { data: 'public' };
  }

  @Get('/private')
  getPrivateData(@CurrentUser() user: any) {
    return { data: 'private', user };
  }
}
```

### @Roles()

Shorthand for role-based access:

```typescript
import { Roles } from '@hazeljs/auth';

@Controller('/admin')
export class AdminController {
  @Get('/dashboard')
  @Roles('admin', 'superadmin')
  getDashboard() {
    return { dashboard: 'data' };
  }
}
```

## Token Management

### Generate Token

```typescript
const token = await authService.generateToken({
  sub: user.id,
  email: user.email,
  roles: ['user'],
  customClaim: 'value',
});
```

### Verify Token

```typescript
try {
  const payload = await authService.verifyToken(token);
  console.log(payload.sub); // user.id
  console.log(payload.email);
} catch (error) {
  console.error('Invalid token:', error.message);
}
```

### Decode Token (without verification)

```typescript
const payload = authService.decodeToken(token);
console.log(payload);
```

### Blacklist Token

```typescript
await authService.blacklistToken(token);

// Check if blacklisted
const isBlacklisted = await authService.isTokenBlacklisted(token);
```

## Configuration

### Module Configuration

```typescript
AuthModule.forRoot({
  // JWT secret key
  secret: process.env.JWT_SECRET,
  
  // Access token expiration
  expiresIn: '15m',
  
  // Refresh token expiration
  refreshExpiresIn: '7d',
  
  // Token issuer
  issuer: 'hazeljs-app',
  
  // Token audience
  audience: 'hazeljs-users',
  
  // Algorithm
  algorithm: 'HS256',
  
  // Token blacklist (requires Redis)
  blacklist: {
    enabled: true,
    redis: redisClient,
  },
})
```

### Environment Variables

```env
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
```

## Password Hashing

```typescript
import { hash, compare } from '@hazeljs/auth';

// Hash password
const hashedPassword = await hash('user-password', 10);

// Compare password
const isValid = await compare('user-password', hashedPassword);
```

## Custom Guards

```typescript
import { Guard, GuardContext } from '@hazeljs/core';
import { Injectable } from '@hazeljs/core';

@Injectable()
export class CustomAuthGuard implements Guard {
  async canActivate(context: GuardContext): Promise<boolean> {
    const request = context.request;
    const token = request.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return false;
    }

    try {
      const payload = await this.authService.verifyToken(token);
      request.user = payload;
      return true;
    } catch {
      return false;
    }
  }
}
```

## API Reference

### AuthService

```typescript
class AuthService {
  generateToken(payload: any, options?: SignOptions): Promise<string>;
  generateRefreshToken(payload: any): Promise<string>;
  verifyToken(token: string): Promise<any>;
  verifyRefreshToken(token: string): Promise<any>;
  decodeToken(token: string): any;
  blacklistToken(token: string): Promise<void>;
  isTokenBlacklisted(token: string): Promise<boolean>;
}
```

### Guards

- `AuthGuard` - Validates JWT token
- `RoleGuard(roles: string[])` - Checks user roles
- `PermissionGuard(permissions: string[])` - Checks user permissions

### Decorators

- `@CurrentUser(property?: string)` - Extract user from request
- `@Public()` - Skip authentication
- `@Roles(...roles: string[])` - Require specific roles

## Examples

See the [examples](../../example/src/auth) directory for complete working examples.

## Testing

```bash
npm test
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT © [HazelJS](https://hazeljs.com)

## Links

- [Documentation](https://hazeljs.com/docs/packages/auth)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazeljs/hazel-js/issues)
- [Discord](https://discord.gg/hazeljs)
