# HazelJS Example Application

A lightweight, modular Node.js framework for building scalable applications with TypeScript.

## Features

### Core Features
- **Decorator-based API** - Clean and intuitive API using TypeScript decorators
- **Advanced Dependency Injection** - Singleton, Transient, and Request scopes
- **Request Validation** - Automatic request validation using class-validator
- **OpenAPI/Swagger** - Automatic API documentation generation
- **Middleware Support** - Global and route-specific middleware
- **Interceptor Support** - AOP-style interceptors for cross-cutting concerns
- **Type Safety** - Full TypeScript support with type inference

### New in v0.2.0 🎉
- **Exception Filters** - Centralized error handling
- **Configuration Module** - Type-safe configuration with validation
- **Testing Utilities** - Full test module builder with mocking
- **Advanced Routing** - Wildcards, optional params, API versioning
- **File Upload** - Native multipart form data support
- **Scoped Providers** - Request-scoped dependency injection

## Demo Module

Check out the `/demo` module to see all new v0.2.0 features in action:
- Optional route parameters (`:id?`)
- Wildcard routes (`/*`)
- Request-scoped providers
- Configuration service usage
- API versioning (v1, v2)

## Installation

```bash
npm install @hazeljs/core
```

## Quick Start

1. Create a module:
```typescript
import { HazelModule } from '@hazeljs/core';

@HazelModule({
  imports: [],
  providers: []
})
export class AppModule {}
```

2. Create a controller:
```typescript
import { Controller, Get, Post, Body, Param } from '@hazeljs/core';

@Controller({ path: '/users' })
export class UserController {
  @Get('/:id')
  async getUser(@Param('id') id: string) {
    return { id };
  }

  @Post()
  async createUser(@Body(CreateUserDto) user: CreateUserDto) {
    return user;
  }
}
```

3. Create a DTO with validation:
```typescript
import { IsString, IsEmail } from 'class-validator';
import { Expose } from 'class-transformer';

export class CreateUserDto {
  @Expose()
  @IsString()
  @IsEmail()
  email: string;

  @Expose()
  @IsString()
  name: string;
}
```

4. Bootstrap your application:
```typescript
import { HazelApp } from '@hazeljs/core';
import { SwaggerModule } from '@hazeljs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = new HazelApp(AppModule);
  SwaggerModule.setRootModule(AppModule);
  await app.listen(3000);
  console.log('Application is running on http://localhost:3000');
}

bootstrap();
```

## Core Features

### Decorators

- `@HazelModule()` - Define a module
- `@Controller()` - Define a controller
- `@Injectable()` - Define a service
- `@Get()`, `@Post()`, `@Put()`, `@Delete()` - HTTP method decorators
- `@Body()`, `@Param()`, `@Query()` - Parameter decorators
- `@UseGuards()` - Apply guards
- `@UsePipes()` - Apply pipes
- `@UseInterceptors()` - Apply interceptors

### Validation

```typescript
import { ValidationPipe } from '@hazeljs/core';

@Controller({ path: '/users' })
@UsePipes(ValidationPipe)
export class UserController {
  @Post()
  async createUser(@Body(CreateUserDto) user: CreateUserDto) {
    return user;
  }
}
```

### Guards

```typescript
import { Injectable, CanActivate } from '@hazeljs/core';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: RequestContext): boolean {
    // Your auth logic here
    return true;
  }
}
```

### Interceptors

```typescript
import { Injectable, Interceptor } from '@hazeljs/core';

@Injectable()
export class LoggingInterceptor implements Interceptor {
  intercept(context: RequestContext, next: () => Promise<unknown>) {
    console.log('Before...');
    const result = next();
    console.log('After...');
    return result;
  }
}
```

### Swagger Documentation

```typescript
import { Swagger, ApiOperation } from '@hazeljs/swagger';

@Swagger({
  title: 'User API',
  description: 'User management endpoints',
  version: '1.0.0'
})
@Controller({ path: '/users' })
export class UserController {
  @ApiOperation({
    summary: 'Create user',
    description: 'Creates a new user',
    responses: {
      '200': {
        description: 'User created successfully'
      }
    }
  })
  @Post()
  async createUser(@Body(CreateUserDto) user: CreateUserDto) {
    return user;
  }
}
```

## Project Structure

```
example/
  ├── src/
  │   ├── app.module.ts       # Root module
  │   ├── index.ts            # Application entry point
  │   ├── user/               # User module
  │   ├── auth/               # Authentication module
  │   ├── rag/                # RAG (Retrieval-Augmented Generation) examples
  │   ├── ai/                 # AI integration examples
  │   ├── microservices/      # Microservices examples
  │   ├── serverless/         # Serverless examples
  │   ├── realtime/           # Real-time features (WebSocket, SSE)
  │   ├── cache/              # Caching examples
  │   ├── cron/               # Scheduled tasks
  │   └── demo/               # Feature demonstrations
  ├── package.json
  └── tsconfig.json
```

## Advanced Features

### RAG (Retrieval-Augmented Generation)

HazelJS includes built-in support for RAG patterns with the `@hazeljs/rag` package.

#### Simple RAG Example

```typescript
import { RAGService } from '@hazeljs/rag';
import { Injectable } from '@hazeljs/core';

@Injectable()
export class KnowledgeService {
  constructor(private ragService: RAGService) {}

  async indexDocument(content: string, metadata: any) {
    // Index documents for retrieval
    return this.ragService.index({
      content,
      metadata,
    });
  }

  async search(query: string) {
    // Semantic search
    return this.ragService.search(query, {
      topK: 5,
      minScore: 0.7,
    });
  }

  async ask(question: string) {
    // Full RAG pipeline: retrieve + generate
    return this.ragService.ask(question, {
      topK: 3,
    });
  }
}
```

#### Decorator-Based RAG

```typescript
import {
  Embeddable,
  VectorColumn,
  SemanticSearch,
  HybridSearch,
  AutoEmbed,
} from '@hazeljs/rag';
import { Controller, Get, Post, Body, Query } from '@hazeljs/core';

// Embeddable Entity
@Embeddable({
  fields: ['title', 'description', 'content'],
  strategy: 'concat',
  model: 'text-embedding-3-small',
})
class Article {
  id!: string;
  title!: string;
  description!: string;
  content!: string;

  @VectorColumn()
  embedding!: number[];
}

// Controller with RAG
@Controller('/documents')
export class DocumentController {
  constructor(private ragService: RAGService) {}

  @Post()
  @AutoEmbed()
  async uploadDocument(@Body() doc: { title: string; content: string }) {
    // Document automatically chunked and embedded
    const ids = await this.ragService.index({
      content: `${doc.title}\n\n${doc.content}`,
      metadata: { title: doc.title, type: 'document' },
    });
    return { success: true, ids };
  }

  @Get('/search')
  @SemanticSearch()
  async search(@Query('q') query: string) {
    const results = await this.ragService.search(query, {
      topK: 5,
      minScore: 0.7,
      includeMetadata: true,
    });
    return { query, results };
  }
}
```

**RAG Features:**
- Semantic search with vector embeddings
- Hybrid search (vector + keyword)
- Multi-query retrieval
- Contextual compression
- Self-query with metadata filtering
- Time-weighted retrieval
- Automatic document chunking
- Multiple embedding models support

See `src/rag/` for complete examples.

### AI Integration

HazelJS provides seamless AI integration with popular providers:

```typescript
import { AITask } from '@hazeljs/ai';

@Injectable()
export class ContentService {
  @AITask({
    name: 'summarize',
    prompt: 'Summarize the following text: {{text}}',
    provider: 'openai',
    model: 'gpt-4',
    outputType: 'string'
  })
  async summarize(text: string): Promise<string> {
    // AI-powered summarization
  }
}
```

### Microservices

Built-in service discovery and communication:

```typescript
import { ServiceRegistry, InjectServiceClient } from '@hazeljs/discovery';

@ServiceRegistry({
  name: 'user-service',
  port: 3000,
  healthCheckPath: '/health',
})
export class AppModule {}

@Injectable()
export class OrderService {
  constructor(
    @InjectServiceClient('user-service') 
    private userClient: ServiceClient
  ) {}
  
  async getUser(id: string) {
    return this.userClient.get(`/users/${id}`);
  }
}
```

### Real-time Features

WebSocket and Server-Sent Events support:

```typescript
import { WebSocketGateway, SubscribeMessage } from '@hazeljs/websocket';

@WebSocketGateway()
export class ChatGateway {
  @SubscribeMessage('message')
  handleMessage(client: Socket, payload: any) {
    return { event: 'message', data: payload };
  }
}
```

## Testing

```typescript
import { Test } from '@hazeljs/core';

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UserController],
      providers: [UserService]
    }).compile();

    controller = module.get(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
```

## License

MIT 