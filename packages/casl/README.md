# @hazeljs/casl

**Attribute-level (record-level) authorization for HazelJS, powered by [CASL](https://casl.js.org).**

Where `RoleGuard` asks "is your role high enough?", `@hazeljs/casl` asks:
> **Can _this_ user perform _this action_ on _this specific record_?**

[![npm version](https://img.shields.io/npm/v/@hazeljs/casl.svg)](https://www.npmjs.com/package/@hazeljs/casl)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/casl)](https://www.npmjs.com/package/@hazeljs/casl)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **`AbilityFactory`** — abstract base class; extend it to define what each role can do, including **conditional permissions** (`can('update', 'Post', { authorId: user.id })`)
- **`CaslService`** — injectable service; call `createForUser(user)` anywhere to build an ability for record-level checks in services
- **`@Ability()`** — parameter decorator that injects the current user's pre-built ability directly into a controller method, so services never need `CaslService` injected
- **`PoliciesGuard`** — factory guard (`@UseGuards(PoliciesGuard(...handlers))`) that runs policy handlers before the route executes
- **`@CheckPolicies()`** — method decorator shorthand, equivalent to `@UseGuards(PoliciesGuard(...handlers))`
- **Function and class handlers** — use inline lambdas or `IPolicyHandler` class instances with injected dependencies
- **Composes with the full guard stack** — designed to sit after `JwtAuthGuard`, `TenantGuard`, and `RoleGuard`
- **No direct `@casl/ability` dependency needed** — `MongoAbility`, `AbilityBuilder`, `createMongoAbility`, `subject` are all re-exported from `@hazeljs/casl`

---

## Installation

```bash
npm install @hazeljs/casl
```

`@casl/ability` is a dependency of `@hazeljs/casl` and is installed automatically. You do not need to add it to your own `package.json` — import everything you need directly from `@hazeljs/casl`.

---

## Setup

### 1. Define your ability factory

Extend `AbilityFactory` and implement `createForUser` to describe what each user can do. Decorate it with `@Injectable()` so the DI container can resolve it.

```typescript
import { Injectable } from '@hazeljs/core';
// All @casl/ability symbols are re-exported — no separate @casl/ability dep needed.
import { AbilityFactory, MongoAbility, AbilityBuilder, createMongoAbility } from '@hazeljs/casl';

type Action  = 'create' | 'read' | 'update' | 'delete' | 'manage';
type Subject = Post | 'Post' | 'all';
export type AppAbility = MongoAbility<[Action, Subject]>;

@Injectable()
export class AppAbilityFactory extends AbilityFactory<AppAbility> {
  createForUser(user: AuthUser): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (user.role === 'admin') {
      can('manage', 'all');                              // admin: everything
    } else {
      can('read',   'Post');
      can('update', 'Post', { authorId: user.id });     // own posts only
      cannot('delete', 'Post');
    }

    return build();
  }
}
```

### 2. Register `CaslModule`

Call `CaslModule.forRoot()` once in your root module.

```typescript
import { HazelModule } from '@hazeljs/core';
import { CaslModule } from '@hazeljs/casl';
import { AppAbilityFactory } from './casl/app-ability.factory';

@HazelModule({
  imports: [
    CaslModule.forRoot({ abilityFactory: AppAbilityFactory }),
  ],
})
export class AppModule {}
```

---

## Guards

### `PoliciesGuard`

Factory guard — pass one or more policy handlers inline. The guard builds the ability for the current user and runs every handler; if any returns `false` it throws 403.

**Requires `JwtAuthGuard` (or any guard that sets `req.user`) to run first.**

```typescript
import { Controller, Get, Post, UseGuards } from '@hazeljs/core';
import { JwtAuthGuard } from '@hazeljs/auth';
import { PoliciesGuard } from '@hazeljs/casl';
import type { AppAbility } from './casl/app-ability.factory';

@UseGuards(JwtAuthGuard)
@Controller('/posts')
export class PostsController {

  @UseGuards(PoliciesGuard<AppAbility>((ability) => ability.can('read', 'Post')))
  @Get('/')
  list() { ... }

  @UseGuards(PoliciesGuard<AppAbility>((ability) => ability.can('create', 'Post')))
  @Post('/')
  create(@Body() dto: CreatePostDto) { ... }
}
```

Errors thrown:

| Condition | Status |
|---|---|
| No `req.user` (guard order wrong) | 401 |
| Any handler returns `false` | 403 |

---

### `@CheckPolicies()` (shorthand)

Method decorator equivalent to `@UseGuards(PoliciesGuard(...handlers))`. Cleaner syntax, same behaviour.

```typescript
import { JwtAuthGuard } from '@hazeljs/auth';
import { CheckPolicies } from '@hazeljs/casl';
import type { AppAbility } from './casl/app-ability.factory';

@UseGuards(JwtAuthGuard)
@Controller('/posts')
export class PostsController {

  @CheckPolicies((ability: AppAbility) => ability.can('read', 'Post'))
  @Get('/')
  list() { ... }

  @CheckPolicies((ability: AppAbility) => ability.can('create', 'Post'))
  @Post('/')
  create(@Body() dto: CreatePostDto) { ... }

  // Multiple handlers — all must pass
  @CheckPolicies(
    (ability: AppAbility) => ability.can('read',   'Post'),
    (ability: AppAbility) => ability.can('update', 'Post'),
  )
  @Get('/:id/edit')
  editForm(@Param('id') id: string) { ... }
}
```

---

### Class-instance handlers (`IPolicyHandler`)

For handlers that need constructor-injected dependencies, implement the `IPolicyHandler` interface and pass an instance:

```typescript
import { Injectable } from '@hazeljs/core';
import { IPolicyHandler } from '@hazeljs/casl';
import type { AppAbility } from './casl/app-ability.factory';

@Injectable()
export class CanManagePost implements IPolicyHandler<AppAbility> {
  constructor(private readonly config: SomeService) {}

  handle(ability: AppAbility): boolean {
    return ability.can('manage', 'Post');
  }
}

// Usage
@CheckPolicies(new CanManagePost())
@Delete('/:id')
remove(@Param('id') id: string) { ... }
```

---

### Combining with other guards

Guards run left-to-right. The recommended order:

```typescript
@UseGuards(
  JwtAuthGuard,                                             // 1. verify token, attach req.user
  TenantGuard({ source: 'param', key: 'orgId' }),           // 2. enforce tenant isolation
  RoleGuard('user'),                                        // 3. coarse role check
)
@Controller('/orgs/:orgId/posts')
export class PostsController {

  @CheckPolicies((ability: AppAbility) => ability.can('read', 'Post'))
  @Get('/')
  list() { ... }

  @CheckPolicies((ability: AppAbility) => ability.can('create', 'Post'))
  @Post('/')
  create(@Body() dto: CreatePostDto) { ... }
}
```

```
Request
  → JwtAuthGuard       — who are you?
  → TenantGuard        — does this belong to your org?
  → RoleGuard          — is your role high enough?
  → @CheckPolicies     — can you act on THIS record?
  → Controller method
```

---

## `@Ability()` — inject the ability directly

`@Ability()` is a **parameter decorator** that resolves `CaslService.createForUser(req.user)` once per request and injects the result straight into your controller method.  Services receive the pre-built ability instead of the raw user, keeping business logic clean.

```typescript
// posts.controller.ts
import { Controller, Patch, Delete, Param, Body, UseGuards } from '@hazeljs/core';
import { JwtAuthGuard, RoleGuard } from '@hazeljs/auth';
import { Ability } from '@hazeljs/casl';
import type { AppAbility } from './casl/app-ability.factory';

@UseGuards(JwtAuthGuard, RoleGuard('user'))
@Controller('/posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Patch('/:id')
  update(
    @Ability() ability: AppAbility,   // ← resolved from req.user automatically
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(ability, id, dto);
  }

  @Delete('/:id')
  remove(
    @Ability() ability: AppAbility,
    @Param('id') id: string,
  ) {
    return this.postsService.remove(ability, id);
  }
}
```

The service just receives an `AppAbility` — no `CaslService` injection needed:

```typescript
// posts.service.ts
import { Injectable } from '@hazeljs/core';
import { subject } from '@hazeljs/casl';   // re-exported — no @casl/ability dep needed
import type { AppAbility } from './casl/app-ability.factory';

@Injectable()
export class PostsService {
  constructor(private readonly postsRepo: PostsRepository) {}

  async update(ability: AppAbility, postId: string, dto: UpdatePostDto) {
    const post = await this.postsRepo.findById(postId);

    // subject() tags the plain object so CASL evaluates conditional rules correctly.
    if (!ability.can('update', subject('Post', post))) {
      throw Object.assign(new Error('You can only edit your own posts'), { status: 403 });
    }
    return this.postsRepo.update(postId, dto);
  }

  async remove(ability: AppAbility, postId: string) {
    const post = await this.postsRepo.findById(postId);

    if (!ability.can('delete', subject('Post', post))) {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }
    return this.postsRepo.delete(postId);
  }
}
```

> **When to use `@Ability()` vs `CaslService`**  
> Use `@Ability()` when the controller passes the ability to a single service.  Use `CaslService` directly when a service is called from multiple places (background jobs, other services) and the caller may not hold an ability object.

---

## Record-level checks in services (manual approach)

If you prefer to inject `CaslService` directly — for example, when a service is called from multiple sources — the pattern is the same as above but the ability is built inside the service.

```typescript
import { Injectable } from '@hazeljs/core';
import { CaslService, subject } from '@hazeljs/casl';
import type { AppAbility } from './casl/app-ability.factory';

@Injectable()
export class PostsService {
  constructor(
    private readonly postsRepo: PostsRepository,
    private readonly casl: CaslService<AppAbility>,
  ) {}

  async update(user: Record<string, unknown>, postId: string, dto: UpdatePostDto) {
    const post    = await this.postsRepo.findById(postId);
    const ability = this.casl.createForUser(user);

    if (!ability.can('update', subject('Post', post))) {
      throw Object.assign(new Error('You can only edit your own posts'), { status: 403 });
    }
    return this.postsRepo.update(postId, dto);
  }
}
```

> **Why use `subject()`?** When you define conditions like `can('update', 'Post', { authorId: user.id })`, CASL needs to know the subject type of the plain object you pass to `ability.can()`. `subject('Post', post)` tags the object without mutating it.

---

## `CaslService` API

```typescript
import { CaslService } from '@hazeljs/casl';

// Inject and call createForUser to get an ability for the current user
const ability = this.casl.createForUser(user);

ability.can('read',   'Post')                          // true / false
ability.can('update', subject('Post', post))           // checks conditions
ability.cannot('delete', 'Post')                       // negation check
```

---

## `AbilityFactory` API

```typescript
import { AbilityFactory } from '@hazeljs/casl';

// Extend this abstract class
abstract class AbilityFactory<A extends AnyAbility> {
  abstract createForUser(user: Record<string, unknown>): A;
}
```

---

## `CaslModule.forRoot()` options

| Option | Type | Required | Description |
|---|---|---|---|
| `abilityFactory` | `new (...args: any[]) => AbilityFactory<A>` | ✓ | Your factory class (must be `@Injectable()`) |

---

## Links

- [Documentation](https://hazeljs.ai/docs/packages/casl)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazel-js/hazeljs/issues)
- [Discord](https://discord.gg/rnxaDcXx)
