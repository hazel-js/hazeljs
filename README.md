<div align="center">

# HazelJS

**One framework. AI built in. No glue code.**

[![GitHub stars](https://img.shields.io/github/stars/hazel-js/hazeljs?style=social)](https://github.com/hazel-js/hazeljs)
[![CI](https://github.com/hazel-js/hazeljs/actions/workflows/ci.yml/badge.svg)](https://github.com/hazel-js/hazeljs/actions/workflows/ci.yml)
[![Publish Package to NPM](https://github.com/hazel-js/hazeljs/actions/workflows/publish.yml/badge.svg)](https://github.com/hazel-js/hazeljs/actions/workflows/publish.yml)
[![npm version](https://badge.fury.io/js/%40hazeljs%2Fcore.svg)](https://badge.fury.io/js/%40hazeljs%2Fcore)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/core)](https://www.npmjs.com/package/@hazeljs/core)
[![codecov](https://codecov.io/gh/hazel-js/hazeljs/branch/main/graph/badge.svg)](https://codecov.io/gh/hazel-js/hazeljs)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![Discord](https://img.shields.io/discord/1448263814238965833?color=7289da&label=Discord&logo=discord&logoColor=white)](https://discord.gg/your-invite-code)

*Stop the glue code. Build AI backends that feel native — not bolted on.*  
**AI** · **Agents** · **RAG** · **Flow** · **Prompts** — one cohesive stack.

[Get Started](#quick-start) · [Why HazelJS?](#-why-hazeljs) · [Documentation](#-documentation) · [Starter](./hazeljs-starter-example)

---

### 🎯 **Try it in 60 seconds** → `npx @hazeljs/cli g app my-app` | [Starter Example](./hazeljs-starter-example) | [HazelJS CSR Agent Example](https://github.com/hazel-js/hazeljs-csr-agent) | [HazelJS Flow Starter](https://github.com/hazel-js/hazeljs-flow-starter) | [HazelJS RAG Documents Starter](https://github.com/hazel-js/hazeljs-rag-documents-starter) | [HazelJS RAG Graph Starter](https://github.com/hazel-js/hazeljs-rag-graph-starter)
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

### AI Stack (what makes HazelJS stand out)
- 🤖 **[@hazeljs/ai](packages/ai)** — `@AITask` decorator, multi-provider (OpenAI, Anthropic, Gemini, Cohere, Ollama), streaming, caching, type-safe outputs
- 🧠 **[@hazeljs/agent](packages/agent)** — Stateful agents, `@Tool` + `@Delegate`, AgentGraph, SupervisorAgent, human-in-the-loop
- 📚 **[@hazeljs/rag](packages/rag)** — Vector search, GraphRAG, 11 document loaders, Agentic RAG, Memory System
- ⚡ **[@hazeljs/flow](packages/flow)** — Durable workflows: WAIT/resume, idempotency, audit timeline, optional Prisma persistence
- 🔄 **[@hazeljs/flow-runtime](packages/flow-runtime)** — REST API for flows (start, tick, resume), recovery on startup
- 📝 **[@hazeljs/prompts](packages/prompts)** — Versioned prompt templates, override agent/RAG prompts, hot-swap from Redis/DB

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

### Option 1: Use the CLI (Recommended)

```bash
# Create a new app with the CLI
npx @hazeljs/cli g app my-app

# Navigate and start
cd my-app
npm install
npm run dev

# ✨ Your API is live at http://localhost:3000
```

> See [hazeljs-starter-example](./hazeljs-starter-example) for a complete starter generated with `hazel g app`

### Option 2: Manual Setup (One File)

```bash
# Install
npm install @hazeljs/core

# Create your app (one file!)
touch app.ts
```

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

```bash
# Run it
npx ts-node app.ts
# ✨ Done! Your API is live at http://localhost:3000
```

**That's it.** No config files. No boilerplate. Just code.

### Which Option Should I Choose?

- **CLI Generator** (`hazel g app`) - Best for production apps, includes full project structure
- **Manual Setup** - Best for learning, prototyping, or single-file demos

> 💡 **Want more?** 
> - Full starter: [hazeljs-starter-example](./hazeljs-starter-example)
> - AI features: [Full Example App](./example) with AI, RAG, Agents, and more

### AI — `@AITask` decorator

```typescript
import { Controller, Post, Body } from '@hazeljs/core';
import { AITask } from '@hazeljs/ai';

@Controller({ path: '/chat' })
class ChatController {
  @AITask({ provider: 'openai', model: 'gpt-4', prompt: 'Respond helpfully to: {{message}}' })
  @Post()
  async chat(@Body() body: { message: string }) {
    return body.message;
  }
}
```

### The old way vs HazelJS

| The old way | HazelJS |
|-------------|---------|
| NestJS + LangChain + adapters + wiring | One stack. AI built in. |
| 3 config files, manual AI glue | `@AITask` decorator. Done. |
| Express + DIY structure + bolted-on AI | Decorators, DI, agents — out of the box. |

### Agents — `@Agent` + `@Tool`

```typescript
import { Agent, Tool } from '@hazeljs/agent';

@Agent({
  name: 'support-agent',
  systemPrompt: 'You are a helpful customer support agent.',
  enableMemory: true,
  enableRAG: true,
})
export class SupportAgent {
  @Tool({
    description: 'Look up order by ID',
    parameters: [{ name: 'orderId', type: 'string', required: true }],
  })
  async lookupOrder(input: { orderId: string }) {
    return { status: 'shipped', trackingNumber: 'TRACK123' };
  }

  @Tool({
    description: 'Process a refund',
    requiresApproval: true,  // human-in-the-loop
    parameters: [{ name: 'orderId', type: 'string' }, { name: 'amount', type: 'number' }],
  })
  async processRefund(input: { orderId: string; amount: number }) {
    return { success: true, refundId: 'REF123' };
  }
}
```

### RAG — vector search + retrieval

```typescript
import { RAGPipeline, MemoryVectorStore, OpenAIEmbeddings, RecursiveTextSplitter, DirectoryLoader } from '@hazeljs/rag';

const embeddings = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });
const rag = new RAGPipeline({
  vectorStore: new MemoryVectorStore(embeddings),
  embeddingProvider: embeddings,
  textSplitter: new RecursiveTextSplitter({ chunkSize: 800, chunkOverlap: 150 }),
  topK: 5,
});
await rag.initialize();

const docs = await new DirectoryLoader({ dirPath: './knowledge-base', recursive: true }).load();
await rag.addDocuments(docs);

const result = await rag.query('What are the main features?', { topK: 3 });
console.log(result.answer, result.sources);
```

Or use **Agentic RAG** for self-improving retrieval: `AgenticRAGService` with query planning, reflection, and adaptive strategies out of the box.

### Flow — durable workflows

```typescript
import { FlowEngine, Flow, Entry, Node, Edge, buildFlowDefinition } from '@hazeljs/flow';
import type { FlowContext, NodeResult } from '@hazeljs/flow';

@Flow('order-flow', '1.0.0')
class OrderFlow {
  @Entry()
  @Node('validate')
  @Edge('charge')
  async validate(ctx: FlowContext): Promise<NodeResult> {
    return { status: 'ok', output: { orderId: ctx.input.orderId } };
  }

  @Node('charge')
  @Edge('end')
  async charge(ctx: FlowContext): Promise<NodeResult> {
    return { status: 'ok', output: { charged: true } };
  }

  @Node('end')
  async end(ctx: FlowContext): Promise<NodeResult> {
    return { status: 'ok', output: ctx.outputs.charge };
  }
}

const engine = new FlowEngine();
await engine.registerDefinition(buildFlowDefinition(OrderFlow));
const { runId } = await engine.startRun({ flowId: 'order-flow', version: '1.0.0', input: { orderId: '123' } });
```

Use **@hazeljs/flow-runtime** for a REST API (start, tick, resume) or run flows programmatically. **@hazeljs/prompts** lets you version and override prompts for agents and RAG — hot-swap from Redis without restarting.

---

## Installation

```bash
# Core (required)
npm install @hazeljs/core

# AI Stack (standout packages)
npm install @hazeljs/ai @hazeljs/agent @hazeljs/rag @hazeljs/flow @hazeljs/flow-runtime @hazeljs/prompts

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

### Why we built this

We were tired of choosing between a heavy framework (NestJS) and a minimal one (Express), then wiring AI on top. HazelJS is the framework we wished existed: NestJS-style elegance without the weight, AI and RAG built in from day one, and no glue code. If you're building AI backends and want one cohesive stack — this is for you.

---

## 📦 Packages

### AI Stack (standout)
| Package | What it does |
|---------|--------------|
| `@hazeljs/ai` | `@AITask` decorator, multi-provider, streaming, caching, type-safe outputs |
| `@hazeljs/agent` | Stateful agents, `@Tool`/`@Delegate`, AgentGraph, SupervisorAgent, human-in-the-loop |
| `@hazeljs/rag` | Vector search, GraphRAG, 11 loaders, Agentic RAG, Memory System |
| `@hazeljs/flow` | Durable workflows — WAIT/resume, idempotency, audit timeline |
| `@hazeljs/flow-runtime` | REST API for flows, recovery on startup |
| `@hazeljs/prompts` | Versioned prompts, override agent/RAG prompts, hot-swap from Redis |

### Core & Infrastructure
| Package | What it does |
|---------|--------------|
| `@hazeljs/core` | Framework core — DI, routing, middleware |
| `@hazeljs/cli` | Scaffolding and code generation |
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

## 🌟 Show Your Support

**If HazelJS saved you time, give us a star!** ⭐

It helps us reach more developers and keeps the project growing.

[![Star History Chart](https://api.star-history.com/svg?repos=hazel-js/hazeljs&type=Date)](https://star-history.com/#hazel-js/hazeljs&Date)

### Ways to Support

- ⭐ **Star the repo** - Show your support
- 🐛 **Report bugs** - Help us improve
- 💡 **Request features** - Share your ideas
- 📝 **Improve docs** - Help others learn
- 💻 **Contribute code** - Build with us
- 🎨 **Share your project** - Inspire others
- 💬 **Join Discord** - Connect with the community

[See all contributors](./CONTRIBUTORS.md) | [Contribution Guide](./CONTRIBUTING.md)

---

## 🤝 Contributing

We'd love your help. Every star, issue, and PR matters.

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Add tests
5. Open a PR

Read our [Contributing Guide](./CONTRIBUTING.md) for details.

---

## 📞 Support & Community

- 💬 **Discord**: [Join our community](https://discord.com/channels/1448263814238965833/1448263814859456575) - Real-time help
- 💭 **Discussions**: [GitHub Discussions](https://github.com/hazel-js/hazeljs/discussions) - Ask questions
- 🐛 **Issues**: [Report bugs](https://github.com/hazel-js/hazeljs/issues) - Help us improve
- 🎨 **Show & Tell**: [Share your project](https://github.com/hazel-js/hazeljs/discussions) - Get featured!
- 🌟 **Awesome HazelJS**: [Community resources](./awesome-hazeljs) - Curated list

---

## 📝 License

Apache 2.0 — Free for commercial and open-source use.

---

<div align="center">

---

**Built with ❤️ for developers who ship**

### 🚀 Ready to build?

[Get Started](./QUICKSTART.md) · [View Examples](./example) · [Join Discord](https://discord.com/channels/1448263814238965833/1448263814859456575) · [⭐ Star on GitHub](https://github.com/hazel-js/hazeljs)

---

*Building AI backends? A star helps us reach more developers like you.*

**HazelJS** · Making AI backends feel native, not bolted on.

</div>
