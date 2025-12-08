# Controllers

Controllers are responsible for handling incoming **requests** and returning **responses** to the client.

<div class="filename">users.controller.ts</div>

```typescript
import { Controller, Get } from '@hazeljs/core';

@Controller('users')
export class UsersController {
  @Get()
  findAll() {
    return 'This action returns all users';
  }
}
```

## Routing

The `@Controller()` decorator is required to define a basic controller. We'll specify an optional route path prefix of `users`. Using a path prefix in the decorator allows us to easily group related routes and minimize repetitive code.

```typescript
import { Controller, Get, Post } from '@hazeljs/core';

@Controller('users')
export class UsersController {
  @Get()
  findAll() {
    return 'This action returns all users';
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return `This action returns user #${id}`;
  }

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return 'This action creates a new user';
  }
}
```

## Request Object

Handlers often need access to the client **request** details. HazelJS provides access to the request object using the `@Req()` decorator.

```typescript
import { Controller, Get, Req } from '@hazeljs/core';
import { Request } from 'express';

@Controller('users')
export class UsersController {
  @Get()
  findAll(@Req() request: Request) {
    console.log(request.headers);
    return 'This action returns all users';
  }
}
```

> **Hint**: To take advantage of express typings, install `@types/express` package.

## Route Parameters

Routes with parameters should be declared after any static paths. This prevents the parameterized paths from intercepting traffic destined for the static paths.

```typescript
@Get(':id')
findOne(@Param('id') id: string) {
  return `This action returns user #${id}`;
}
```

To accept **multiple parameters**:

```typescript
@Get(':userId/posts/:postId')
findUserPost(
  @Param('userId') userId: string,
  @Param('postId') postId: string,
) {
  return `User ${userId}, Post ${postId}`;
}
```

## Query Parameters

To access query string parameters, use the `@Query()` decorator.

```typescript
@Get()
findAll(@Query('page') page: number, @Query('limit') limit: number) {
  return `Page: ${page}, Limit: ${limit}`;
}
```

Or get all query parameters:

```typescript
@Get()
findAll(@Query() query: any) {
  console.log(query); // { page: '1', limit: '10' }
  return 'This action returns all users';
}
```

## Request Body

To access the request body, use the `@Body()` decorator.

```typescript
@Post()
create(@Body() createUserDto: CreateUserDto) {
  return `Creating user: ${createUserDto.name}`;
}
```

Define a DTO (Data Transfer Object) class:

```typescript
export class CreateUserDto {
  name: string;
  email: string;
  age: number;
}
```

## Headers

To access custom headers, use the `@Headers()` decorator.

```typescript
@Get()
findAll(@Headers('authorization') auth: string) {
  console.log(auth);
  return 'This action returns all users';
}
```

## Status Codes

By default, the response **status code** is always **200**, except for POST requests which use **201**. We can easily change this behavior by adding the `@HttpCode()` decorator.

```typescript
import { Controller, Post, HttpCode } from '@hazeljs/core';

@Controller('users')
export class UsersController {
  @Post()
  @HttpCode(204)
  create() {
    return 'This action creates a new user';
  }
}
```

## Response Headers

To specify a custom response header, use the `@Header()` decorator.

```typescript
import { Controller, Get, Header } from '@hazeljs/core';

@Controller('users')
export class UsersController {
  @Get()
  @Header('Cache-Control', 'no-cache, no-store')
  findAll() {
    return 'This action returns all users';
  }
}
```

## Redirection

To redirect a response to a specific URL, use the `@Redirect()` decorator.

```typescript
import { Controller, Get, Redirect } from '@hazeljs/core';

@Controller('users')
export class UsersController {
  @Get('old-route')
  @Redirect('/users/new-route', 301)
  oldRoute() {
    // This will redirect to /users/new-route
  }
}
```

## Async / Await

Every async function has to return a `Promise`. This means that you can return a deferred value that HazelJS will be able to resolve by itself.

```typescript
@Get()
async findAll(): Promise<User[]> {
  return await this.usersService.findAll();
}
```

## Complete Example

Here's a complete controller with all features:

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  Header,
} from '@hazeljs/core';

interface User {
  id: number;
  name: string;
  email: string;
}

interface CreateUserDto {
  name: string;
  email: string;
}

interface UpdateUserDto {
  name?: string;
  email?: string;
}

@Controller('users')
export class UsersController {
  private users: User[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
  ];

  @Get()
  findAll(@Query('search') search?: string) {
    if (search) {
      return this.users.filter(
        (user) =>
          user.name.toLowerCase().includes(search.toLowerCase()) ||
          user.email.toLowerCase().includes(search.toLowerCase()),
      );
    }
    return this.users;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    const user = this.users.find((u) => u.id === parseInt(id));
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return user;
  }

  @Post()
  @HttpCode(201)
  create(@Body() createUserDto: CreateUserDto) {
    const newUser = {
      id: this.users.length + 1,
      ...createUserDto,
    };
    this.users.push(newUser);
    return newUser;
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    const user = this.users.find((u) => u.id === parseInt(id));
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    Object.assign(user, updateUserDto);
    return user;
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    const index = this.users.findIndex((u) => u.id === parseInt(id));
    if (index === -1) {
      throw new NotFoundException(`User #${id} not found`);
    }
    this.users.splice(index, 1);
  }
}
```

## Try It Yourself

Create a new file `app.controller.ts`:

```typescript
import { Controller, Get } from '@hazeljs/core';

@Controller()
export class AppController {
  @Get()
  getHello() {
    return { message: 'Hello from HazelJS!' };
  }
}
```

Register it in your module:

```typescript
import { HazelModule } from '@hazeljs/core';
import { AppController } from './app.controller';

@HazelModule({
  controllers: [AppController],
})
export class AppModule {}
```

Start your application and visit `http://localhost:3000` - you should see the JSON response!

## What's Next?

- Learn about [Providers](/docs/guides/providers) to add business logic
- Understand [Modules](/docs/guides/modules) to organize your application
- Add [Validation](/docs/guides/validation) to validate request data
- Implement [Exception Filters](/docs/guides/exception-filters) for error handling
