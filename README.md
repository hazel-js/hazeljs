# HazelJS

[![codecov](https://codecov.io/gh/yourusername/hazeljs/branch/main/graph/badge.svg)](https://codecov.io/gh/yourusername/hazeljs)
[![npm version](https://badge.fury.io/js/%40hazeljs%2Fcore.svg)](https://badge.fury.io/js/%40hazeljs%2Fcore)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern, lightweight, enterprise-grade Node.js framework. HazelJS provides a robust architecture for building scalable server-side applications using TypeScript and decorators, with built-in AI capabilities, agent runtime, and RAG support.

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

### AI & Agent Features
- 🤖 **AI Service** - OpenAI, Anthropic, Gemini, Cohere, Ollama integration
- 🧠 **Agent Runtime** - Stateful, long-running AI agents with tools and memory
- 📚 **RAG System** - Vector search, embeddings, and retrieval-augmented generation
- 💾 **Memory Management** - Persistent conversation memory with multiple backends
- 🔧 **Tool System** - Function calling with approval workflows

### Additional Features
- 📊 **Swagger Documentation** - Automatic API docs generation
- 🗄️ **Prisma Integration** - First-class ORM support
- 📦 **Repository Pattern** - Base repository for data access
- ⏰ **Cron Jobs** - Decorator-based scheduled task execution
- 🔐 **JWT Authentication** - Token-based auth module
- 🔍 **Service Discovery** - Microservices registry with load balancing
- 🌐 **WebSocket & SSE** - Real-time communication support
- ⚡ **Serverless** - AWS Lambda & Google Cloud Functions adapters
- 💾 **Multi-tier Caching** - Memory, Redis, and CDN caching
- ✅ **Request Validation** - Automatic validation with class-validator
- 📝 **Structured Logging** - Winston-based logging
- 🎭 **Interceptors** - AOP-style request/response transformation
- 🛡️ **Guards** - Route protection and authorization

## Installation

HazelJS is organized as a monorepo with multiple packages. Install the packages you need:

```bash
# Core framework (required)
npm install @hazeljs/core

# AI & Agent packages
npm install @hazeljs/ai @hazeljs/agent @hazeljs/rag

# Infrastructure packages
npm install @hazeljs/cache @hazeljs/websocket @hazeljs/serverless
npm install @hazeljs/discovery @hazeljs/config @hazeljs/cron

# Data & Auth packages
npm install @hazeljs/prisma @hazeljs/auth @hazeljs/swagger

# CLI tool for scaffolding
npm install -D @hazeljs/cli
```

## Quick Start

```typescript
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

## 📦 Package Structure

HazelJS is organized as a monorepo with the following packages:

### Core
- **@hazeljs/core** - Core framework (DI, routing, decorators, middleware)
- **@hazeljs/cli** - CLI tool for scaffolding and code generation

### AI & Agents
- **@hazeljs/ai** - AI integration (OpenAI, Anthropic, Gemini, Cohere, Ollama)
- **@hazeljs/agent** - AI-native agent runtime with tools, memory, and workflows
- **@hazeljs/rag** - Vector search, embeddings, and RAG capabilities

### Infrastructure
- **@hazeljs/cache** - Multi-tier caching (Memory, Redis, CDN)
- **@hazeljs/websocket** - WebSocket & Server-Sent Events support
- **@hazeljs/serverless** - Serverless adapters (AWS Lambda, Google Cloud Functions)
- **@hazeljs/discovery** - Service discovery and registry for microservices
- **@hazeljs/config** - Type-safe configuration management
- **@hazeljs/cron** - Decorator-based scheduled tasks

### Data & Auth
- **@hazeljs/prisma** - Prisma ORM integration with repository pattern
- **@hazeljs/auth** - JWT authentication and authorization
- **@hazeljs/swagger** - Automatic OpenAPI/Swagger documentation

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

## � Release Process

HazelJS uses automated releases through GitHub Actions with Lerna for monorepo management.

### Automated Release (Recommended)

**Option 1: Manual Workflow Trigger**

1. Go to **Actions** → **Release** in GitHub
2. Click **Run workflow**
3. Select version bump type: `patch`, `minor`, `major`, or `prerelease`
4. Select npm dist-tag: `beta` or `latest`
5. Click **Run workflow**

The workflow will automatically:
- Bump versions across all packages
- Build and test all packages
- Publish to npm with the selected tag
- Create a GitHub release
- Push version changes and tags

**Option 2: Tag-Based Release**

1. Create and push a version tag:
   ```bash
   git tag v0.2.1
   git push origin v0.2.1
   ```

2. GitHub Actions will automatically:
   - Detect the version from the tag
   - Update all package.json files
   - Build and test packages
   - Publish to npm (beta tag for prerelease versions, latest for stable)
   - Create a GitHub release

### Version Bump Types

- **patch**: `0.2.0-beta.1` → `0.2.1` (bug fixes)
- **minor**: `0.2.0-beta.1` → `0.3.0` (new features, backward compatible)
- **major**: `0.2.0-beta.1` → `1.0.0` (breaking changes)
- **prerelease**: `0.2.0` → `0.2.1-beta.0` (beta releases)

### Local Development (Not Recommended for Production)

For testing releases locally:

```bash
# Bump version
npm run version:patch   # or version:minor, version:major

# Build packages
npm run build

# Publish with Lerna
npm run lerna:publish        # Publish with beta tag
npm run lerna:publish:latest # Publish with latest tag
```

### Requirements

- **NPM_TOKEN**: Set as a GitHub secret for npm authentication
- **Lerna**: Installed as a dev dependency for monorepo management
- **GitHub Actions**: Enabled in repository settings

## �📚 Documentation

### Getting Started
- **[Quick Start Guide](./QUICKSTART.md)** - Get started in 5 minutes
- **[Troubleshooting](./TROUBLESHOOTING.md)** - Common issues and solutions
- **[Contributing Guide](./CONTRIBUTING.md)** - How to contribute
- **[Example Application](./example)** - Full working examples

### Package Documentation
- **[Core Framework](./packages/core/README.md)** - Core framework features and APIs
- **[AI Integration](./packages/ai/README.md)** - AI providers and usage
- **[Agent Runtime](./packages/agent/README.md)** - Building AI agents with tools and memory
- **[RAG System](./packages/rag/README.md)** - Vector search and embeddings
- **[Authentication](./packages/auth/README.md)** - JWT authentication and authorization
- **[Caching](./packages/cache/README.md)** - Multi-tier caching (Memory, Redis, CDN)
- **[CLI Tool](./packages/cli/README.md)** - Scaffolding and code generation
- **[Configuration](./packages/config/README.md)** - Type-safe configuration management
- **[Cron Jobs](./packages/cron/README.md)** - Scheduled task execution
- **[Service Discovery](./packages/discovery/README.md)** - Microservices registry
- **[Prisma ORM](./packages/prisma/README.md)** - Database integration with repository pattern
- **[Serverless](./packages/serverless/README.md)** - AWS Lambda & Google Cloud Functions
- **[Swagger](./packages/swagger/README.md)** - Automatic API documentation
- **[WebSocket](./packages/websocket/README.md)** - Real-time communication & SSE

### Guides
- [Dependency Injection](./docs/guides/providers.md)
- [Controllers & Routing](./docs/guides/controllers.md)
- [Exception Filters](./docs/guides/exception-filters.md)
- [Guards & Authorization](./docs/guides/guards.md)
- [Interceptors](./docs/guides/interceptors.md)
- [Middleware](./docs/guides/middleware.md)
- [Pipes & Validation](./docs/guides/pipes.md)
- [Cron Jobs](./docs/guides/cron-jobs.md)
- [Security](./docs/guides/security.md)

## 🚀 What's New in v0.2.0

HazelJS has been significantly enhanced with enterprise-grade features:

### Core Framework Enhancements
- ✅ **Multiple DI Scopes** - Singleton, Transient, Request-scoped providers
- ✅ **Exception Filters** - Centralized error handling
- ✅ **Configuration Module** - Type-safe configuration with validation
- ✅ **Testing Utilities** - Full test module builder with mocking
- ✅ **Advanced Routing** - Wildcards, optional params, API versioning
- ✅ **Global Middleware** - Apply middleware globally or per-route
- ✅ **File Upload** - Native multipart form data support

### Production-Ready Package Improvements
- ✅ **Auth Package** - Configurable JWT with proper secret management, token expiration, and dynamic role verification
- ✅ **Cron Package** - Real cron expression parsing with `node-cron` for accurate scheduling
- ✅ **WebSocket Package** - Full WebSocket server integration with HTTP server wiring
- ✅ **Serverless Package** - Complete request routing through HazelJS router for Lambda & Cloud Functions
- ✅ **RAG Package** - Proper module configuration with static config pattern

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

### Completed ✅
- ✅ Core framework with DI and routing
- ✅ AI integration (OpenAI, Anthropic, Gemini, Cohere, Ollama)
- ✅ Agent runtime with tools and memory
- ✅ RAG and vector search
- ✅ WebSocket & SSE support
- ✅ Service discovery for microservices
- ✅ Serverless adapters
- ✅ Multi-tier caching
- ✅ CLI tool for scaffolding
- ✅ Comprehensive testing utilities

### In Progress 🚧
- GraphQL Integration
- Message Queue Support
- Advanced Metrics & Monitoring
- Rate Limiting
- API Gateway Features

### Planned 📋
- gRPC Support
- Event Sourcing
- CQRS Pattern
- Distributed Tracing
- More AI Provider Integrations

## 📞 Support

- **GitHub Issues**: [Report bugs](https://github.com/yourusername/hazeljs/issues)
- **Discussions**: [Ask questions](https://github.com/yourusername/hazeljs/discussions)
- **Discord**: Coming soon

## 📝 License

MIT - Free to use in commercial and open-source projects

---

**Built with ❤️ for the Node.js community** 