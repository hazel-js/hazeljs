<div align="center">

# HazelJS

**The Node.js framework that gets out of your way — so you can build what matters.**

[![GitHub stars](https://img.shields.io/github/stars/hazel-js/hazeljs?style=social)](https://github.com/hazel-js/hazeljs)
[![npm version](https://badge.fury.io/js/%40hazeljs%2Fcore.svg)](https://badge.fury.io/js/%40hazeljs%2Fcore)
[![codecov](https://codecov.io/gh/hazel-js/hazeljs/branch/main/graph/badge.svg)](https://codecov.io/gh/hazel-js/hazeljs)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

*Tired of boilerplate? Want to ship AI-powered apps without the complexity?*  
**HazelJS** gives you enterprise-grade architecture with a lightweight footprint — decorators, DI, and built-in AI that just works.

[Get Started](#quick-start) · [Why HazelJS?](#-why-hazeljs) · [Documentation](#-documentation)

</div>

---

## ✨ What makes it different

You've built APIs before. You know the drill: wire up routing, configure middleware, glue together auth, validation, logging... *again*. HazelJS is the framework we wished existed — **NestJS-style elegance** without the weight, **Express simplicity** with structure that scales, and **AI built in** from day one.

### Core
- 🏗️ **Modular Architecture** — Organize code into reusable modules
- 🎯 **Decorator-based API** — Clean, intuitive, joy to write
- 💉 **Advanced Dependency Injection** — Singleton, Transient, Request scopes
- 🔄 **Full TypeScript** — Type-safe from the ground up
- 🛣️ **Advanced Routing** — Wildcards, optional params, versioning
- 🎨 **Global Middleware** — Flexible, with exclusions

### AI-Native (yes, really)
- 🤖 **AI Service** — OpenAI, Anthropic, Gemini, Cohere, Ollama
- 🧠 **Agent Runtime** — Stateful agents with tools and memory
- 📚 **RAG System** — Vector search, embeddings, retrieval-augmented generation
- 💾 **Memory Management** — Persistent conversation memory
- 🔧 **Tool System** — Function calling with approval workflows

### Production-ready
- 📊 **Swagger** — Auto API docs
- 🗄️ **Prisma** — First-class ORM
- 🔐 **JWT Auth** — Token-based auth module
- 🌐 **WebSocket & SSE** — Real-time out of the box
- ⚡ **Serverless** — Lambda & Cloud Functions adapters
- 💾 **Multi-tier Caching** — Memory, Redis, CDN

---

## Quick Start

*From zero to running in 60 seconds.*

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

async function bootstrap() {
  const app = new HazelApp(AppModule);
  await app.listen(3000);
  console.log('🚀 Running at http://localhost:3000');
}

bootstrap();
```

**That's it.** No config files. No boilerplate. Just code.

---

## Installation

```bash
# Core (required)
npm install @hazeljs/core

# AI & Agents
npm install @hazeljs/ai @hazeljs/agent @hazeljs/rag

# Infrastructure
npm install @hazeljs/cache @hazeljs/websocket @hazeljs/serverless
npm install @hazeljs/discovery @hazeljs/config @hazeljs/cron @hazeljs/queue

# Data & Auth
npm install @hazeljs/prisma @hazeljs/auth @hazeljs/swagger

# CLI (scaffolding)
npm install -D @hazeljs/cli
```

---

## Database Setup

```bash
npm run db:up
# Add DATABASE_URL to .env
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio   # Optional: visual DB browser
```

---

## 🎯 Why HazelJS?

**Because building backend apps shouldn't feel like wrestling a framework.**

| | HazelJS | NestJS | Express |
|---|---|---|---|
| **Bundle size** | Lightweight | Heavier | Minimal |
| **Built-in AI** | ✅ Yes | ❌ No | ❌ No |
| **Learning curve** | Gentle | Steep | Easy |
| **Structure** | Decorators + DI | Decorators + DI | DIY |
| **TypeScript** | Native | Native | Manual |
| **Boilerplate** | Minimal | Moderate | None (but you write it) |

**vs NestJS** — Same elegance, less weight. No Express/Fastify dependency. AI and RAG built in. Simpler to onboard.

**vs Express** — Get structure without the ceremony. Decorators, DI, validation, and testing utilities out of the box.

---

## 📦 Packages

| Package | What it does |
|---------|--------------|
| `@hazeljs/core` | Framework core — DI, routing, middleware |
| `@hazeljs/cli` | Scaffolding and code generation |
| `@hazeljs/ai` | AI providers (OpenAI, Anthropic, Gemini, etc.) |
| `@hazeljs/agent` | Agent runtime with tools and memory |
| `@hazeljs/rag` | Vector search and RAG |
| `@hazeljs/auth` | JWT authentication |
| `@hazeljs/prisma` | Prisma ORM + repository pattern |
| `@hazeljs/swagger` | Auto OpenAPI docs |
| *+ more* | Cache, WebSocket, Serverless, Cron, Queue, Discovery |

---

## 📚 Documentation

- **[Quick Start Guide](./QUICKSTART.md)** — Get running in 5 minutes
- **[Troubleshooting](./TROUBLESHOOTING.md)** — Common issues
- **[Contributing](./CONTRIBUTING.md)** — How to contribute
- **[Examples](./example)** — Full working apps

**Guides:** [DI](docs/guides/providers.md) · [Controllers](docs/guides/controllers.md) · [Guards](docs/guides/guards.md) · [Middleware](docs/guides/middleware.md) · [Pipes](docs/guides/pipes.md) · [Cron](docs/guides/cron-jobs.md) · [Security](docs/guides/security.md)

---

## 🚀 What's New in v0.2.0

- ✅ Multiple DI scopes, exception filters, config module
- ✅ Testing utilities, advanced routing, global middleware
- ✅ File upload, API versioning, CORS & logging
- ✅ Auth, Cron, WebSocket, Serverless, RAG — all production-ready

*100% backward compatible.*

---

## 🤝 Contributing

We'd love your help. Every star, issue, and PR matters.

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Add tests
5. Open a PR

---

## 📞 Support

- **Issues**: [Report bugs](https://github.com/hazel-js/hazeljs/issues)
- **Discussions**: [Ask questions](https://github.com/hazel-js/hazeljs/discussions)
- **Discord**: [Discord](https://discord.com/channels/1448263814238965833/1448263814859456575)

---

## 📝 License

Apache 2.0 — Free for commercial and open-source use.

---

<div align="center">

**Built with ❤️ for developers who ship**

*If HazelJS helps you build something cool — [give us a star ⭐](https://github.com/hazel-js/hazeljs)*

</div>
