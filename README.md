# HazelJS

[![codecov](https://codecov.io/gh/yourusername/hazeljs/branch/main/graph/badge.svg)](https://codecov.io/gh/yourusername/hazeljs)
[![npm version](https://badge.fury.io/js/%40hazeljs%2Fcore.svg)](https://badge.fury.io/js/%40hazeljs%2Fcore)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern, lightweight, enterprise-grade Node.js. HazelJS provides a robust architecture for building scalable server-side applications using TypeScript and decorators, with built-in AI capabilities.

## ✨ Features

### Core Features
- 🏗️ **Modular Architecture** - Organize code into reusable modules
- 🎯 **Decorator-based API** - Clean, intuitive programming model
- 💉 **Advanced Dependency Injection** - Singleton, Transient, and Request scopes
- 🔄 **Full TypeScript Support** - Type-safe from the ground up
- 🛣️ **Advanced Routing** - Wildcards, optional params, versioning
- 🎨 **Global Middleware** - Flexible middleware system with exclusions
- 📦 **Module System** - Import and export modules easily

### New in v0.2.0 🎉
- ⚡ **Enhanced DI Container** - Multiple scopes, circular dependency detection
- 🎯 **Exception Filters** - Centralized error handling
- ⚙️ **Configuration Module** - Type-safe config with validation
- 🧪 **Testing Utilities** - Full test module builder
- 📤 **File Upload Support** - Native multipart form data handling
- 🔀 **API Versioning** - URI, Header, and Media Type strategies
- 🌐 **CORS & Logging** - Built-in middleware

### Additional Features
- 📊 **Swagger Documentation** - Automatic API docs generation
- 🗄️ **Prisma Integration** - First-class ORM support
- 📦 **Repository Pattern** - Base repository for data access
- 🤖 **AI Service** - Built-in OpenAI and Ollama integration
- ⏰ **Cron Jobs** - Decorator-based scheduled task execution
- 🔐 **JWT Authentication** - Token-based auth module
- ✅ **Request Validation** - Automatic validation with class-validator
- 📝 **Structured Logging** - Winston-based logging
- 🎭 **Interceptors** - AOP-style request/response transformation
- 🛡️ **Guards** - Route protection and authorization

## Installation

HazelJS is organized as a monorepo with multiple packages. Install the packages you need:

```bash
# Core framework (required)
npm install @hazeljs/core reflect-metadata

# Additional packages (optional)
npm install @hazeljs/ai @hazeljs/cache @hazeljs/websocket @hazeljs/serverless
npm install @hazeljs/prisma @hazeljs/auth @hazeljs/config @hazeljs/swagger
npm install @hazeljs/cron

# CLI tool for scaffolding
npm install -D @hazeljs/cli
```

## Quick Start

```typescript
import 'reflect-metadata';
import { HazelApp, HazelModule, Controller, Get } from '@hazeljs/core';

@Controller({ path: '/hello' })
class HelloController {
  @Get()
  hello() {
    return { message: 'Hello, World!' };
  }
}

@HazelModule({
  controllers: [HelloController],
})
class AppModule {}

// Start the server
async function bootstrap() {
  const app = new HazelApp(AppModule);
  await app.listen(3000);
  console.log('Application is running on http://localhost:3000');
}

bootstrap();
```

## Database Setup

1. Start the database:
```bash
npm run db:up
```

2. Create a `.env` file with your database URL:
```
DATABASE_URL="postgresql://hazeljs:hazeljs123@localhost:5432/hazeljs?schema=public"
```

3. Generate Prisma client:
```bash
npm run prisma:generate
```

4. Create and apply migrations:
```bash
npm run prisma:migrate
```

5. View database with Prisma Studio:
```bash
npm run prisma:studio
```

6. Reset database (if needed):
```bash
npm run prisma:reset
```

7. Stop the database:
```bash
npm run db:down
```

```bash
npm version patch  # for bug fixes (0.0.x)
```
# or
```bash
npm version minor  # for new features (0.x.0)
```
# or
```bash
npm version major  # for breaking changes (x.0.0)
```

## Package Structure

HazelJS is organized as a monorepo with the following packages:

- **@hazeljs/core** - Core framework (DI, routing, decorators, middleware)
- **@hazeljs/ai** - AI integration (OpenAI, Anthropic, Gemini, Cohere)
- **@hazeljs/cache** - Multi-tier caching (Memory, Redis, CDN)
- **@hazeljs/websocket** - WebSocket & SSE support
- **@hazeljs/serverless** - Serverless adapters (Lambda, Cloud Functions)
- **@hazeljs/prisma** - Prisma ORM integration
- **@hazeljs/auth** - JWT authentication
- **@hazeljs/config** - Configuration management
- **@hazeljs/swagger** - API documentation
- **@hazeljs/cron** - Scheduled tasks
- **@hazeljs/cli** - CLI tool for scaffolding

## Available Scripts

### Monorepo Scripts
- `npm run build` - Build all packages
- `npm run build:packages` - Build all packages
- `npm run test` - Run tests in all packages
- `npm run lint` - Lint all packages
- `npm run lint:fix` - Fix linting issues in all packages

### Database Scripts
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio
- `npm run prisma:reset` - Reset database
- `npm run db:up` - Start database
- `npm run db:down` - Stop database
- `npm run db:logs` - View database logs

## 📚 Documentation

- **[Quick Start Guide](./QUICKSTART.md)** - Get started in 5 minutes
- **[Improvements & Features](./IMPROVEMENTS.md)** - Detailed technical documentation
- **[Upgrade Summary](./UPGRADE_SUMMARY.md)** - What's new in v0.2.0
- **[Example Application](./example)** - Full working example

### Key Guides

- [Dependency Injection](./IMPROVEMENTS.md#1-enhanced-dependency-injection-container-)
- [Exception Filters](./IMPROVEMENTS.md#2-exception-filters-system-)
- [Configuration Module](./IMPROVEMENTS.md#3-configuration-module-)
- [Testing](./IMPROVEMENTS.md#4-testing-utilities-)
- [Advanced Routing](./IMPROVEMENTS.md#5-advanced-routing-)
- [Middleware](./IMPROVEMENTS.md#6-global-middleware-system-)
- [File Uploads](./IMPROVEMENTS.md#7-file-upload-support-)

## 🚀 What's New in v0.2.0

HazelJS has been significantly enhanced with enterprise-grade features:

- ✅ **Multiple DI Scopes** - Singleton, Transient, Request-scoped providers
- ✅ **Exception Filters** - Centralized error handling
- ✅ **Configuration Module** - Type-safe configuration with validation
- ✅ **Testing Utilities** - Full test module builder with mocking
- ✅ **Advanced Routing** - Wildcards, optional params, API versioning
- ✅ **Global Middleware** - Apply middleware globally or per-route
- ✅ **File Upload** - Native multipart form data support

**All improvements are 100% backward compatible!**

## 🎯 Why HazelJS?

### vs NestJS
- ✅ Lighter weight (smaller bundle size)
- ✅ Built-in AI service integration
- ✅ Simpler learning curve
- ✅ Native Prisma integration
- ✅ No Express/Fastify dependency

### vs Express
- ✅ Decorator-based API
- ✅ Dependency injection
- ✅ Built-in validation
- ✅ Type safety
- ✅ Modular architecture
- ✅ Testing utilities

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📊 Project Status

- **Core Features**: ✅ Stable
- **DI System**: ✅ Enterprise-grade
- **Routing**: ✅ Advanced
- **Testing**: ✅ Full support
- **Documentation**: ✅ Comprehensive
- **Production Ready**: ✅ Yes

## 🗺️ Roadmap

### Phase 2 (Planned)
- WebSocket Gateway
- GraphQL Integration
- CLI Tool
- Platform Abstraction
- More Examples

### Phase 3 (Future)
- Microservices Support
- Message Queues
- Caching Layer
- Rate Limiting
- Metrics & Monitoring

## 📞 Support

- **GitHub Issues**: [Report bugs](https://github.com/yourusername/hazeljs/issues)
- **Discussions**: [Ask questions](https://github.com/yourusername/hazeljs/discussions)
- **Discord**: Coming soon

## 📝 License

MIT - Free to use in commercial and open-source projects

---

**Built with ❤️ for the Node.js community** 