# Providers

Providers are a fundamental concept in HazelJS. Many of the basic HazelJS classes may be treated as a provider – services, repositories, factories, helpers, and so on. The main idea of a provider is that it can be **injected** as a dependency.

<div class="filename">users.service.ts</div>

```typescript
import { Injectable } from '@hazeljs/core';

@Injectable()
export class UsersService {
  private users = [
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Smith' },
  ];

  findAll() {
    return this.users;
  }

  findOne(id: number) {
    return this.users.find((user) => user.id === id);
  }
}
```

## Services

Let's start by creating a simple `UsersService`. This service will be responsible for data storage and retrieval, and is designed to be used by the `UsersController`.

```typescript
import { Injectable } from '@hazeljs/core';

interface User {
  id: number;
  name: string;
  email: string;
}

@Injectable()
export class UsersService {
  private users: User[] = [];

  create(user: Omit<User, 'id'>): User {
    const newUser = {
      id: this.users.length + 1,
      ...user,
    };
    this.users.push(newUser);
    return newUser;
  }

  findAll(): User[] {
    return this.users;
  }

  findOne(id: number): User | undefined {
    return this.users.find((user) => user.id === id);
  }

  update(id: number, updates: Partial<User>): User | undefined {
    const user = this.findOne(id);
    if (user) {
      Object.assign(user, updates);
    }
    return user;
  }

  remove(id: number): boolean {
    const index = this.users.findIndex((user) => user.id === id);
    if (index !== -1) {
      this.users.splice(index, 1);
      return true;
    }
    return false;
  }
}
```

## Dependency Injection

HazelJS is built around the strong design pattern commonly known as **Dependency injection**. We recommend reading a great article about this concept in the [official Angular documentation](https://angular.io/guide/dependency-injection).

Now we can inject the `UsersService` into the `UsersController`:

```typescript
import { Controller, Get, Post, Body, Param } from '@hazeljs/core';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(parseInt(id));
  }

  @Post()
  create(@Body() createUserDto: any) {
    return this.usersService.create(createUserDto);
  }
}
```

## Scopes

Providers normally have a lifetime ("scope") synchronized with the application lifecycle. When the application is bootstrapped, every dependency must be resolved, and therefore every provider has to be instantiated. Similarly, when the application shuts down, each provider will be destroyed. However, there are ways to make your provider lifetime **request-scoped** as well.

### Singleton Scope (Default)

A single instance of the provider is shared across the entire application. The instance lifetime is tied directly to the application lifecycle.

```typescript
import { Injectable, Scope } from '@hazeljs/core';

@Injectable({ scope: Scope.SINGLETON })
export class UsersService {
  // This service will be created once and shared
}
```

### Transient Scope

Transient providers are not shared across consumers. Each consumer that injects a transient provider will receive a new, dedicated instance.

```typescript
import { Injectable, Scope } from '@hazeljs/core';

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService {
  // Each injection gets a new instance
}
```

### Request Scope

Request-scoped providers are created for each incoming request and garbage collected after the request has completed processing.

```typescript
import { Injectable, Scope } from '@hazeljs/core';

@Injectable({ scope: Scope.REQUEST })
export class RequestContextService {
  // New instance for each HTTP request
}
```

## Custom Providers

There are several ways to create custom providers.

### Value Providers

The `useValue` syntax is useful for injecting a constant value:

```typescript
const configProvider = {
  provide: 'CONFIG',
  useValue: {
    apiUrl: 'https://api.example.com',
    timeout: 5000,
  },
};

@HazelModule({
  providers: [configProvider],
})
export class AppModule {}
```

Inject it using `@Inject()`:

```typescript
import { Injectable, Inject } from '@hazeljs/core';

@Injectable()
export class ApiService {
  constructor(@Inject('CONFIG') private config: any) {
    console.log(this.config.apiUrl);
  }
}
```

### Class Providers

The `useClass` syntax allows you to dynamically determine a class:

```typescript
const loggerProvider = {
  provide: LoggerService,
  useClass:
    process.env.NODE_ENV === 'development'
      ? DevLoggerService
      : ProdLoggerService,
};
```

### Factory Providers

The `useFactory` syntax allows for creating providers **dynamically**:

```typescript
const databaseProvider = {
  provide: 'DATABASE_CONNECTION',
  useFactory: async () => {
    const connection = await createConnection({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
    });
    return connection;
  },
};
```

With dependencies:

```typescript
const repositoryProvider = {
  provide: 'USER_REPOSITORY',
  useFactory: (connection: Connection) => {
    return connection.getRepository(User);
  },
  inject: ['DATABASE_CONNECTION'],
};
```

## Optional Providers

Occasionally, you might have dependencies which do not necessarily have to be resolved. For instance, your class may depend on a **configuration object**, but if none is passed, the default values should be used.

```typescript
import { Injectable, Optional, Inject } from '@hazeljs/core';

@Injectable()
export class HttpService {
  constructor(@Optional() @Inject('HTTP_OPTIONS') private options: any) {
    this.options = options || { timeout: 3000 };
  }
}
```

## Property-based Injection

In some very specific cases, **property-based injection** might be useful. For instance, if your top-level class depends on either one or multiple providers, passing them all the way up by calling `super()` in sub-classes can be very tedious.

```typescript
import { Injectable, Inject } from '@hazeljs/core';

@Injectable()
export class BaseService {
  @Inject()
  protected logger: LoggerService;
}

@Injectable()
export class UsersService extends BaseService {
  // logger is automatically injected from parent
  
  findAll() {
    this.logger.log('Finding all users');
    return [];
  }
}
```

## Complete Example

Here's a complete example with a service, controller, and module:

<div class="filename">users.service.ts</div>

```typescript
import { Injectable } from '@hazeljs/core';

interface User {
  id: number;
  name: string;
  email: string;
}

@Injectable()
export class UsersService {
  private users: User[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
  ];

  findAll(): User[] {
    return this.users;
  }

  findOne(id: number): User | undefined {
    return this.users.find((user) => user.id === id);
  }

  create(user: Omit<User, 'id'>): User {
    const newUser = {
      id: Math.max(...this.users.map((u) => u.id), 0) + 1,
      ...user,
    };
    this.users.push(newUser);
    return newUser;
  }
}
```

<div class="filename">users.controller.ts</div>

```typescript
import { Controller, Get, Post, Param, Body } from '@hazeljs/core';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(parseInt(id));
  }

  @Post()
  create(@Body() createUserDto: { name: string; email: string }) {
    return this.usersService.create(createUserDto);
  }
}
```

<div class="filename">users.module.ts</div>

```typescript
import { HazelModule } from '@hazeljs/core';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@HazelModule({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```

## Try It Yourself

1. Create a new service:

```bash
# Create users.service.ts with the code above
```

2. Create a controller that uses it:

```bash
# Create users.controller.ts with the code above
```

3. Register both in a module:

```bash
# Create users.module.ts with the code above
```

4. Import the module in your app:

```typescript
import { HazelModule } from '@hazeljs/core';
import { UsersModule } from './users/users.module';

@HazelModule({
  imports: [UsersModule],
})
export class AppModule {}
```

5. Test the endpoints:

```bash
# GET all users
curl http://localhost:3000/users

# GET one user
curl http://localhost:3000/users/1

# POST create user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Bob","email":"bob@example.com"}'
```

## What's Next?

- Learn about [Modules](/docs/guides/modules) to organize your providers
- Add [Database integration](/docs/guides/database) with Prisma
- Implement [Caching](/docs/guides/caching) for better performance
- Use [Testing](/docs/guides/testing) to test your services
