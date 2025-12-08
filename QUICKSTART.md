# HazelJS Quick Start Guide

## Installation

```bash
npm install @hazeljs/core reflect-metadata class-validator class-transformer
```

## Basic Application

### 1. Create Your First Controller

```typescript
// user.controller.ts
import { Controller, Get, Post, Body, Param } from '@hazeljs/core';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('/users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  async getAllUsers() {
    return this.userService.findAll();
  }

  @Get('/:id')
  async getUser(@Param('id') id: string) {
    return this.userService.findById(parseInt(id));
  }

  @Post()
  async createUser(@Body(CreateUserDto) user: CreateUserDto) {
    return this.userService.create(user);
  }
}
```

### 2. Create a Service

```typescript
// user.service.ts
import { Injectable } from '@hazeljs/core';

@Injectable()
export class UserService {
  private users = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
  ];

  findAll() {
    return this.users;
  }

  findById(id: number) {
    return this.users.find(u => u.id === id);
  }

  create(user: { name: string; email: string }) {
    const newUser = {
      id: this.users.length + 1,
      ...user,
    };
    this.users.push(newUser);
    return newUser;
  }
}
```

### 3. Create a DTO with Validation

```typescript
// dto/create-user.dto.ts
import { IsString, IsEmail, MinLength } from 'class-validator';
import { Expose } from 'class-transformer';

export class CreateUserDto {
  @Expose()
  @IsString()
  @MinLength(2)
  name: string;

  @Expose()
  @IsEmail()
  email: string;
}
```

### 4. Create a Module

```typescript
// user.module.ts
import { HazelModule } from '@hazeljs/core';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@HazelModule({
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
```

### 5. Create the App Module

```typescript
// app.module.ts
import { HazelModule, ConfigModule } from '@hazeljs/core';
import { UserModule } from './user/user.module';

@HazelModule({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
    UserModule,
  ],
})
export class AppModule {}
```

### 6. Bootstrap the Application

```typescript
// main.ts
import 'reflect-metadata';
import { HazelApp } from '@hazeljs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = new HazelApp(AppModule);
  await app.listen(3000);
  console.log('Application is running on http://localhost:3000');
}

bootstrap();
```

## Advanced Features

### Using Scoped Providers

```typescript
import { Injectable, Scope } from '@hazeljs/core';

@Injectable({ scope: Scope.REQUEST })
export class RequestScopedService {
  private requestId = Math.random();

  getRequestId() {
    return this.requestId;
  }
}
```

### Exception Filters

```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpError } from '@hazeljs/core';

@Catch(HttpError)
export class GlobalExceptionFilter implements ExceptionFilter<HttpError> {
  catch(exception: HttpError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    response.status(exception.statusCode).json({
      statusCode: exception.statusCode,
      message: exception.message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### API Versioning

```typescript
import { Controller, Get, Version } from '@hazeljs/core';

@Controller('/users')
@Version('1')
export class UserV1Controller {
  @Get()
  getUsers() {
    return { version: 1, users: [] };
  }
}

@Controller('/users')
@Version('2')
export class UserV2Controller {
  @Get()
  getUsers() {
    return { version: 2, users: [], metadata: {} };
  }
}
```

### Global Middleware

```typescript
import { GlobalMiddlewareManager, CorsMiddleware, LoggerMiddleware } from '@hazeljs/core';

const middlewareManager = new GlobalMiddlewareManager();

// Add CORS
middlewareManager.use(new CorsMiddleware({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

// Add logging
middlewareManager.use(new LoggerMiddleware());
```

### File Uploads

```typescript
import { Controller, Post, UploadedFile, UploadedFileType } from '@hazeljs/core';

@Controller('/upload')
export class UploadController {
  @Post()
  uploadFile(@UploadedFile('file') file: UploadedFileType) {
    return {
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
}
```

### Testing

```typescript
import { Test } from '@hazeljs/core';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  let controller: UserController;
  let service: UserService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UserController],
      providers: [UserService],
    }).compile();

    controller = module.get(UserController);
    service = module.get(UserService);
  });

  it('should return all users', async () => {
    const users = await controller.getAllUsers();
    expect(users).toBeDefined();
    expect(Array.isArray(users)).toBe(true);
  });
});
```

### Configuration Service

```typescript
import { Injectable, ConfigService } from '@hazeljs/core';

@Injectable()
export class DatabaseService {
  constructor(private config: ConfigService) {}

  connect() {
    const host = this.config.get('DB_HOST', 'localhost');
    const port = this.config.get<number>('DB_PORT', 5432);
    const database = this.config.getOrThrow<string>('DB_NAME');

    console.log(`Connecting to ${host}:${port}/${database}`);
  }
}
```

## Project Structure

```
my-hazeljs-app/
├── src/
│   ├── user/
│   │   ├── dto/
│   │   │   └── create-user.dto.ts
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   └── user.module.ts
│   ├── app.module.ts
│   └── main.ts
├── .env
├── package.json
└── tsconfig.json
```

## Environment Variables

Create a `.env` file:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
JWT_SECRET=your-secret-key
```

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Running the Application

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## Next Steps

- Read the [full documentation](./IMPROVEMENTS.md)
- Check out [example applications](./example)
- Join our community
- Contribute to the project

## Common Patterns

### Repository Pattern with Prisma

```typescript
import { Injectable } from '@hazeljs/core';
import { BaseRepository } from '@hazeljs/core';
import { PrismaService } from '@hazeljs/core';

@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(prisma: PrismaService) {
    super(prisma, 'user');
  }

  async findByEmail(email: string) {
    return this.prismaClient.user.findUnique({
      where: { email },
    });
  }
}
```

### Guards for Authentication

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@hazeljs/core';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    return !!request.headers.authorization;
  }
}

// Use in controller
@Controller('/protected')
@UseGuards(AuthGuard)
export class ProtectedController {
  @Get()
  getProtectedData() {
    return { data: 'secret' };
  }
}
```

### Interceptors for Logging

```typescript
import { Injectable, Interceptor, RequestContext } from '@hazeljs/core';

@Injectable()
export class LoggingInterceptor implements Interceptor {
  async intercept(context: RequestContext, next: () => Promise<unknown>) {
    const start = Date.now();
    console.log(`→ ${context.method} ${context.url}`);
    
    const result = await next();
    
    const duration = Date.now() - start;
    console.log(`← ${context.method} ${context.url} ${duration}ms`);
    
    return result;
  }
}
```

## Troubleshooting

### Common Issues

1. **Decorators not working**
   - Ensure `experimentalDecorators` and `emitDecoratorMetadata` are enabled in tsconfig.json
   - Import `reflect-metadata` at the top of your main file

2. **Validation not working**
   - Install `class-validator` and `class-transformer`
   - Use `@Body(DtoClass)` decorator with your DTO class

3. **Dependency injection failing**
   - Ensure all services are decorated with `@Injectable()` or `@Service()`
   - Check that providers are registered in the module

## Support

- GitHub Issues: [Report bugs](https://github.com/yourusername/hazeljs/issues)
- Discussions: [Ask questions](https://github.com/yourusername/hazeljs/discussions)
- Discord: [Join our community](#)

## License

MIT
