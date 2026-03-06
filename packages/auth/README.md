# @hazeljs/auth

**JWT authentication, role-based access control, and tenant isolation — in one line of decorators.**

No Passport config, no middleware soup. `@UseGuards(JwtAuthGuard)` on a controller and you're done.

[![npm version](https://img.shields.io/npm/v/@hazeljs/auth.svg)](https://www.npmjs.com/package/@hazeljs/auth)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/auth)](https://www.npmjs.com/package/@hazeljs/auth)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **JWT signing & verification** via `JwtService` (backed by `jsonwebtoken`)
- **`JwtAuthGuard`** — `@UseGuards`-compatible guard that verifies Bearer tokens and attaches `req.user`
- **`RoleGuard`** — configurable role check with **inherited role hierarchy** (admin satisfies manager checks automatically)
- **`TenantGuard`** — tenant-level isolation; compares the tenant ID on the JWT against a URL param, header, or query string
- **`@CurrentUser()`** — parameter decorator that injects the authenticated user into controller methods
- **`@Auth()`** — all-in-one method decorator for JWT + optional role check without `@UseGuards`

---

## Installation

```bash
npm install @hazeljs/auth
```

---

## Setup

### 1. Register `JwtModule`

Configure the JWT secret once in your root module. Picks up `JWT_SECRET` and `JWT_EXPIRES_IN` env vars automatically when no options are passed.

```typescript
import { HazelModule } from '@hazeljs/core';
import { JwtModule } from '@hazeljs/auth';

@HazelModule({
  imports: [
    JwtModule.forRoot({
      secret: process.env.JWT_SECRET,   // or set JWT_SECRET env var
      expiresIn: '1h',                  // or set JWT_EXPIRES_IN env var
      issuer: 'my-app',                 // optional
      audience: 'my-users',             // optional
    }),
  ],
})
export class AppModule {}
```

```env
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=1h
```

### 2. Issue tokens at login

```typescript
import { Service } from '@hazeljs/core';
import { JwtService } from '@hazeljs/auth';

@Service()
export class AuthLoginService {
  constructor(private readonly jwt: JwtService) {}

  async login(userId: string, role: string, tenantId?: string) {
    const token = this.jwt.sign({
      sub: userId,
      role,
      tenantId,           // include for TenantGuard
    });

    return { accessToken: token };
  }
}
```

---

## Guards

All guards are resolved from the DI container, so they can inject services.

### `JwtAuthGuard`

Verifies the `Authorization: Bearer <token>` header. On success it attaches the decoded payload to `req.user` so downstream guards and `@CurrentUser()` can read it.

```typescript
import { Controller, Get } from '@hazeljs/core';
import { UseGuards } from '@hazeljs/core';
import { JwtAuthGuard, CurrentUser, AuthUser } from '@hazeljs/auth';

@UseGuards(JwtAuthGuard)          // protects every route in this controller
@Controller('/profile')
export class ProfileController {
  @Get('/')
  getProfile(@CurrentUser() user: AuthUser) {
    return user;
  }
}
```

Errors thrown:

| Condition | Status |
|---|---|
| No `Authorization` header | 400 |
| Header not in `Bearer <token>` format | 400 |
| Token invalid or expired | 401 |

---

### `RoleGuard`

Checks the authenticated user's `role` against a list of allowed roles. Uses the **role hierarchy** so higher roles automatically satisfy lower-level checks.

```typescript
import { UseGuards } from '@hazeljs/core';
import { JwtAuthGuard, RoleGuard } from '@hazeljs/auth';

@UseGuards(JwtAuthGuard, RoleGuard('manager'))   // manager, admin, superadmin can access
@Controller('/reports')
export class ReportsController {}
```

#### Role hierarchy

The default hierarchy is `superadmin → admin → manager → user`.

```
superadmin
  └─ admin
       └─ manager
            └─ user
```

So `RoleGuard('user')` passes for **every** role, and `RoleGuard('admin')` only passes for `admin` and `superadmin`.

```typescript
// Only superadmin and admin can call this:
@UseGuards(JwtAuthGuard, RoleGuard('admin'))

// Everyone authenticated can call this:
@UseGuards(JwtAuthGuard, RoleGuard('user'))

// Either role (admin OR moderator, each with their inherited roles):
@UseGuards(JwtAuthGuard, RoleGuard('admin', 'moderator'))
```

#### Custom hierarchy

```typescript
import { RoleGuard, RoleHierarchy } from '@hazeljs/auth';

const hierarchy = new RoleHierarchy({
  owner:  ['editor'],
  editor: ['viewer'],
  viewer: [],
});

@UseGuards(JwtAuthGuard, RoleGuard('editor', { hierarchy }))
// owner and editor pass; viewer does not
```

#### Disable hierarchy

```typescript
@UseGuards(JwtAuthGuard, RoleGuard('admin', { hierarchy: {} }))
// Only exact 'admin' role passes — no inheritance
```

Errors thrown:

| Condition | Status |
|---|---|
| No `req.user` (guard order wrong) | 401 |
| User role not in allowed set | 403 |

---

### `TenantGuard`

Enforces tenant-level isolation. Compares `req.user.tenantId` (from the JWT) against the tenant ID found in the request.

**Requires `JwtAuthGuard` to run first** so `req.user` is populated.

#### URL param (default)

```typescript
import { JwtAuthGuard, TenantGuard } from '@hazeljs/auth';

// Route: GET /orgs/:tenantId/invoices
@UseGuards(JwtAuthGuard, TenantGuard())
@Controller('/orgs/:tenantId/invoices')
export class InvoicesController {}
```

#### HTTP header

```typescript
// Client sends: X-Org-ID: acme
@UseGuards(JwtAuthGuard, TenantGuard({ source: 'header', key: 'x-org-id' }))
@Controller('/invoices')
export class InvoicesController {}
```

#### Query string

```typescript
// Client sends: GET /invoices?org=acme
@UseGuards(JwtAuthGuard, TenantGuard({ source: 'query', key: 'org' }))
@Controller('/invoices')
export class InvoicesController {}
```

#### Bypass for privileged roles

Superadmins often need to manage any tenant. Use `bypassRoles` to skip the check for them:

```typescript
@UseGuards(
  JwtAuthGuard,
  TenantGuard({ bypassRoles: ['superadmin'] })
)
@Controller('/orgs/:tenantId/settings')
export class OrgSettingsController {}
```

#### Custom user field

```typescript
// JWT payload uses 'orgId' instead of 'tenantId'
@UseGuards(JwtAuthGuard, TenantGuard({ userField: 'orgId' }))
```

All options:

| Option | Type | Default | Description |
|---|---|---|---|
| `source` | `'param' \| 'header' \| 'query'` | `'param'` | Where to read the tenant ID from the request |
| `key` | `string` | `'tenantId'` | Param name / header name / query key |
| `userField` | `string` | `'tenantId'` | Field on `req.user` holding the user's tenant |
| `bypassRoles` | `string[]` | `[]` | Roles that skip the check entirely |

Errors thrown:

| Condition | Status |
|---|---|
| No `req.user` | 401 |
| `req.user` has no tenant field | 403 |
| Tenant ID absent from request | 400 |
| Tenant IDs do not match | 403 |

---

### Database-level tenant isolation

`TenantGuard` blocks cross-tenant HTTP requests, but that alone isn't enough — a bug in service code could still return another tenant's rows. `TenantContext` closes that gap by enforcing isolation at the **query level** using Node.js `AsyncLocalStorage`.

After `TenantGuard` validates the request it calls `TenantContext.enterWith(tenantId)`, which seeds the tenant ID into the current async execution chain. Every service and repository downstream can then call `tenantCtx.requireId()` to get the current tenant without it being passed through every function signature.

```typescript
// src/orders/orders.repository.ts
import { Service } from '@hazeljs/core';
import { TenantContext } from '@hazeljs/auth';

@Service()
export class OrdersRepository {
  constructor(private readonly tenantCtx: TenantContext) {}

  findAll() {
    const tenantId = this.tenantCtx.requireId();
    // Scoped automatically — no tenantId parameter needed
    return db.query('SELECT * FROM orders WHERE tenant_id = $1', [tenantId]);
  }

  findById(id: string) {
    const tenantId = this.tenantCtx.requireId();
    // Even direct ID lookup is tenant-scoped — prevents IDOR attacks
    return db.query(
      'SELECT * FROM orders WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
  }
}
```

The route setup:

```typescript
@UseGuards(JwtAuthGuard, TenantGuard())
@Controller('/orgs/:tenantId/orders')
export class OrdersController {
  constructor(private readonly repo: OrdersRepository) {}

  @Get('/')
  list() {
    // TenantContext is already seeded by TenantGuard — no need to pass tenantId
    return this.repo.findAll();
  }
}
```

The two layers together:

| Layer | What it does | What it catches |
|---|---|---|
| `TenantGuard` | Rejects requests where `req.user.tenantId !== :tenantId` | Unauthenticated cross-tenant requests |
| `TenantContext` | Scopes every DB query via AsyncLocalStorage | Bugs, missing guard on a route, IDOR attempts |

For background jobs or tests, you can run code in a specific tenant context explicitly:

```typescript
// Background job — no HTTP request involved
await TenantContext.run('acme', async () => {
  await ordersService.processPendingOrders();
});
```

`requireId()` throws with a 500 if called outside any tenant context (guard missing), giving you a clear error instead of silently querying all tenants.

---

### Combining guards

Guards run left-to-right. Always put `JwtAuthGuard` first.

```typescript
@UseGuards(JwtAuthGuard, RoleGuard('manager'), TenantGuard())
@Controller('/orgs/:tenantId/orders')
export class OrdersController {

  @Get('/')
  listOrders(@CurrentUser() user: AuthUser) {
    return this.ordersService.findAll(user.tenantId!);
  }

  // Stricter restriction on a single route — only admin (and above) can delete:
  @UseGuards(RoleGuard('admin'))
  @Delete('/:id')
  deleteOrder(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }
}
```

---

## `@CurrentUser()` decorator

Injects the authenticated user (or a specific field from it) directly into the controller parameter.

```typescript
import { CurrentUser, AuthUser } from '@hazeljs/auth';

@UseGuards(JwtAuthGuard)
@Get('/me')
getMe(@CurrentUser() user: AuthUser) {
  return user;
  // { id: 'u1', username: 'alice', role: 'admin', tenantId: 'acme' }
}

@Get('/role')
getRole(@CurrentUser('role') role: string) {
  return { role };
}

@Get('/tenant')
getTenant(@CurrentUser('tenantId') tenantId: string) {
  return { tenantId };
}
```

---

## `@Auth()` decorator (method-level shorthand)

A lower-level alternative that wraps the handler directly instead of using the `@UseGuards` metadata system. Useful for one-off routes or when you prefer explicit colocation.

```typescript
import { Auth } from '@hazeljs/auth';

@Controller('/admin')
export class AdminController {
  @Auth()                         // JWT check only
  @Get('/dashboard')
  getDashboard() { ... }

  @Auth({ roles: ['admin'] })     // JWT + role check (no hierarchy)
  @Delete('/user/:id')
  deleteUser(@Param('id') id: string) { ... }
}
```

> **Note:** `@Auth()` does not use the role hierarchy. Use `@UseGuards(JwtAuthGuard, RoleGuard('admin'))` when hierarchy matters.

---

## `JwtService` API

```typescript
import { JwtService } from '@hazeljs/auth';

// Sign a token
const token = jwtService.sign({ sub: userId, role: 'admin', tenantId: 'acme' });
const token = jwtService.sign({ sub: userId }, { expiresIn: '15m' }); // custom expiry

// Verify and decode
const payload = jwtService.verify(token);   // throws on invalid/expired
payload.sub       // string
payload.role      // string
payload.tenantId  // string | undefined

// Decode without verification (e.g. to read exp before refreshing)
const payload = jwtService.decode(token);   // returns null on malformed
```

---

## `AuthService` API

`AuthService` wraps `JwtService` and returns a typed `AuthUser` object:

```typescript
interface AuthUser {
  id: string;
  username?: string;
  role: string;
  [key: string]: unknown;   // all other JWT claims pass through
}

const user = await authService.verifyToken(token);
// Returns AuthUser | null (null when token is invalid — never throws)
```

---

## `RoleHierarchy` API

```typescript
import { RoleHierarchy, DEFAULT_ROLE_HIERARCHY } from '@hazeljs/auth';

const h = new RoleHierarchy(DEFAULT_ROLE_HIERARCHY);

h.satisfies('superadmin', 'user')  // true  — full chain
h.satisfies('manager', 'admin')    // false — no upward inheritance
h.resolve('admin')                 // Set { 'admin', 'manager', 'user' }
```

---

## Custom guards

Implement `CanActivate` from `@hazeljs/core` for fully custom logic:

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@hazeljs/core';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest() as { headers: Record<string, string> };
    return req.headers['x-api-key'] === process.env.API_KEY;
  }
}
```

The `ExecutionContext` also exposes the fully parsed `RequestContext` (params, query, headers, body, user):

```typescript
canActivate(context: ExecutionContext): boolean {
  const ctx = context.switchToHttp().getContext();
  const orgId = ctx.params['orgId'];
  const user  = ctx.user;
  // ...
}
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | *(required)* | Secret used to sign and verify tokens |
| `JWT_EXPIRES_IN` | `1h` | Default token lifetime |
| `JWT_ISSUER` | — | Optional `iss` claim |
| `JWT_AUDIENCE` | — | Optional `aud` claim |

---

## Links

- [Documentation](https://hazeljs.com/docs/packages/auth)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazel-js/hazeljs/issues)
- [Discord](https://discord.com/channels/1448263814238965833/1448263814859456575)
