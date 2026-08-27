<div align="center">

# HazelJS

**Agent OS for TypeScript backends.** Durable AI agents in the same DI/HTTP app as your APIs.

[![GitHub stars](https://img.shields.io/github/stars/hazel-js/hazeljs?style=social)](https://github.com/hazel-js/hazeljs)
[![CI](https://github.com/hazel-js/hazeljs/actions/workflows/ci.yml/badge.svg)](https://github.com/hazel-js/hazeljs/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/%40hazeljs%2Fcore.svg)](https://badge.fury.io/js/%40hazeljs%2Fcore)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/core)](https://www.npmjs.com/package/@hazeljs/core)
[![codecov](https://codecov.io/gh/hazel-js/hazeljs/branch/main/graph/badge.svg)](https://codecov.io/gh/hazel-js/hazeljs)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

Ship agents like packages — **DNA**, **Skillgate**, crash-safe **HITL**, **Agent VM** reversible tools — without Nest + LangGraph + workers.  
Framework packages (HCEL, RAG, workflows) are there when you need them. They are not the wedge.

[Agent OS](https://hazeljs.ai/agent-os) · [Get Started](#quick-start) · [Docs](https://hazeljs.ai/docs) · [Meridian](https://github.com/hazel-js/hazeljs-meridian-ops)

---

### 🎯 **Try it** → clone [Meridian](https://github.com/hazel-js/hazeljs-meridian-ops) (flagship) · or `npx @hazeljs/cli g app my-app --template=ai-native` (HTTP + HCEL scaffold)

</div>

---

## What HazelJS is

HazelJS is a TypeScript backend whose **primary product is Agent OS**: durable AI agents inside the same app as your APIs. Package them (DNA), govern writes (Skillgate), authorize every tool (Gatekeeper), survive crashes (HITL), and undo speculative work (Agent VM).

| Audience | Story |
| --- | --- |
| **Backend teams putting AI in APIs** | Durable agents in your TypeScript backend — DNA, HITL, Skillgate, local apply (same DI as HTTP) |
| **Agent platform teams** | Agent OS control plane — Store, Definitions / Deployments, reconcile; K8s optional |

You do **not** assemble Nest + LangGraph + a worker fleet. The Agent Runtime is the kernel; Agent OS is how you ship it.

### Agent OS

- 🧬 **DNA packages** — prompt + policy + contracts as versioned packages (DNA ≠ tool implementations)
- 🚪 **Skillgate** — curated OpenAPI / REST → governed agent skills (reads by default, writes need approval)
- 🛡️ **Gatekeeper** — fail-closed authorization on every tool call (not a prompt guardrail)
- ⏸️ **Crash-safe HITL** — `durableSuspend` / `approveAndResume`; process survives restarts
- 🌀 **Confidence loop** — plan → execute → critique → validate (`options.loop`)
- 🖥️ **Inspector timelines** — live SSE + JSON replay at `/__hazel`
- 🧪 **`describeAgent` CI** — latency / cost / tool-trajectory gates via `@hazeljs/testing`
- ⚙️ **Agent VM** — `@Reversible` / `@Compensate`, speculative branches, atomic undo

### Also in the stack (when you need them)

- ⚡ **HCEL** — fluent prompt → RAG → agent → ML chains (`@hazeljs/ai`)
- 📚 **RAG / GraphRAG** — loaders, vector stores, agentic retrieval (`@hazeljs/rag`)
- 🔁 **Flow** — durable WAIT / resume workflows (`@hazeljs/flow`)
- 🏗️ **Core** — modules, controllers, DI, routing (`@hazeljs/core`)

---

## Quick Start

### Option 1: Meridian (Agent OS flagship)

The teaching app for DNA, Store, Skillgate, HITL, and local apply.

```bash
git clone https://github.com/hazel-js/hazeljs-meridian-ops.git
cd hazeljs-meridian-ops
npm install
npm run store:sync      # DNA packages + lockfile
npm run platform:sync   # Apply Definitions / Deployments (does not restart Node)
npm run dev             # Chat with real @Tool handlers + HITL
```

Docs: [Agent OS](https://hazeljs.ai/agent-os) · [Agent OS guide](https://hazeljs.ai/docs/guides/agent-os) · [Skillgate](https://hazeljs.ai/docs/guides/skillgate)

### Option 2: CLI template (HTTP + HCEL / RAG scaffold)

Useful for framework onboarding. **Not** a substitute for Meridian if you need DNA / Store / Skillgate / HITL.

```bash
npx @hazeljs/cli g app my-app --template=ai-native
cd my-app
npm install
cp .env.example .env    # add OPENAI_API_KEY
docker-compose up -d
npm run dev
```

Skeleton API only: `npx @hazeljs/cli g app my-app`

### Option 3: One file

```bash
npm install @hazeljs/core
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
}

bootstrap();
```

Do **not** add `reflect-metadata` to your app. `@hazeljs/core` installs and loads it.

---

## Agent OS in code

### Agents — `@Agent` + `@Tool` + HITL

```typescript
import { Agent, Tool } from '@hazeljs/agent';

@Agent({
  name: 'support-agent',
  systemPrompt: 'You are a helpful customer support agent.',
  enableMemory: true,
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
    requiresApproval: true,
    parameters: [
      { name: 'orderId', type: 'string' },
      { name: 'amount', type: 'number' },
    ],
  })
  async processRefund(input: { orderId: string; amount: number }) {
    return { success: true, refundId: 'REF123' };
  }
}
```

Confidence loop, contracts, and recovery:

```typescript
await runtime.execute('support-agent', goal, {
  loop: { maxIterations: 8, successScore: 95 },
  contract: { name: 'refund', outputIncludes: 'refund', maxLatencyMs: 8000 },
  recovery: { maxRetries: 3, fallbackAgent: 'safe-agent' },
});
```

### Skillgate — OpenAPI → governed skills

```typescript
import { Skillgate } from '@hazeljs/skillgate';
import { ToolRegistry } from '@hazeljs/agent';

const gate = Skillgate.fromOpenApi(spec, {
  include: { tags: ['agent'] },
  classify: { writeRequiresApproval: true },
  invoke: { baseUrl: process.env.API_BASE_URL! },
});

const registry = new ToolRegistry();
gate.register(registry, 'api-concierge');
```

### Agent VM — reversible tools + speculation

```typescript
import { Agent, Tool } from '@hazeljs/agent';
import { Reversible, Compensate, createAgentVmRuntime } from '@hazeljs/agent-vm';

const vm = createAgentVmRuntime({ stateManager });

@Agent({ name: 'ops' })
class OpsAgent {
  @Tool({ name: 'hold', description: 'Hold a resource' })
  @Reversible({ compensate: 'hold' })
  async hold(input: { id: string }) {
    return { holdId: `h-${input.id}` };
  }

  @Compensate('hold')
  async releaseHold(effect: { output: { holdId: string } }) {
    await releaseResource(effect.output.holdId);
  }
}

await vm.coordinator.undoRun(runId); // newest-first compensation
```

### Testing — `describeAgent`

```typescript
import { describeAgent, runAgentSuite, expectTools } from '@hazeljs/testing';

const suite = describeAgent('Support Agent', ({ test }) => {
  test('Refund flow', async ({ run }) => {
    const result = await run('I want a refund for order 123');
    expectTools(result, ['lookupOrder']);
  });
});

await runAgentSuite(suite, { execute: (input) => runtime.execute('support-agent', input) });
```

---

## Framework layer (HCEL, RAG, Flow)

Use these when you are building HTTP APIs, retrieval, or workflows alongside Agent OS — not instead of it.

### HCEL — fluent AI orchestration

```typescript
import { HazelAI } from '@hazeljs/ai';

const ai = HazelAI.create({ defaultProvider: 'openai', model: 'gpt-4o' });
const result = await ai.hazel
  .prompt('Summarize this issue: {{input}}')
  .rag('engineering-docs')
  .agent('support-specialist')
  .execute(userTicket);
```

### RAG

```typescript
import { RAGPipeline, MemoryVectorStore, OpenAIEmbeddings } from '@hazeljs/rag';

const embeddings = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });
const rag = new RAGPipeline({
  vectorStore: new MemoryVectorStore(embeddings),
  embeddingProvider: embeddings,
  topK: 5,
});
await rag.initialize();
const result = await rag.query('What are the main features?');
```

### Flow — durable workflows

```typescript
import { FlowEngine, Flow, Entry, Node, Edge, buildFlowDefinition } from '@hazeljs/flow';

@Flow('order-flow', '1.0.0')
class OrderFlow {
  @Entry()
  @Node('validate')
  @Edge('charge')
  async validate() {
    return { status: 'ok', output: 1 };
  }

  @Node('charge')
  async charge() {
    return { status: 'ok', output: { charged: true } };
  }
}
```

---

## Installation

```bash
# Core (required for HTTP / DI apps)
npm install @hazeljs/core

# Agent OS
npm install @hazeljs/agent @hazeljs/skillgate @hazeljs/agent-gatekeeper @hazeljs/agent-vm
npm install @hazeljs/testing @hazeljs/eval @hazeljs/benchmark @hazeljs/inspector

# AI / RAG / workflows (optional)
npm install @hazeljs/ai @hazeljs/rag @hazeljs/flow @hazeljs/prompts

# CLI
npm install -D @hazeljs/cli
```

Do **not** add `reflect-metadata` to your app. `@hazeljs/core` installs and loads it. Generated apps (`hazel new` / `hazel g app`) do not list it in `package.json`.

---

## Packages

### Agent OS

| Package | What it does |
| --- | --- |
| `@hazeljs/agent` | Agent Runtime kernel — `@Agent` / `@Tool`, DNA, HITL, loop, policies, `AgentOS` facade |
| `@hazeljs/skillgate` | OpenAPI / REST → governed skills (allowlist, classify, approval) |
| `@hazeljs/agent-gatekeeper` | Fail-closed authorization on every tool call |
| `@hazeljs/agent-vm` | Reversible tools, speculative branches, atomic undo |
| `@hazeljs/testing` | `describeAgent` CI suites (latency / cost / tools) |
| `@hazeljs/eval` | Golden datasets, RAG + trajectory metrics |
| `@hazeljs/benchmark` | Benchmark suites + regression compare (`hazel benchmark`) |
| `@hazeljs/inspector` | DevTools UI, agent timelines, durable run list |
| `@hazeljs/mcp` | Expose `@Tool` handlers as an MCP server |

### AI & data

| Package | What it does |
| --- | --- |
| `@hazeljs/ai` | Multi-provider LLMs, streaming, HCEL |
| `@hazeljs/rag` | Vector search, GraphRAG, loaders, agentic RAG |
| `@hazeljs/ml` | Feature store, experiments, drift detection |
| `@hazeljs/guardrails` | PII, injection, toxicity, output validation |
| `@hazeljs/memory` | Persistent long-term memory |
| `@hazeljs/prompts` | Versioned prompts, hot-swap from Redis / DB |
| `@hazeljs/flow` | Durable WAIT / resume workflows |
| `@hazeljs/observability` | OpenTelemetry traces, cost, reasoning spans |

### Framework

| Package | What it does |
| --- | --- |
| `@hazeljs/core` | DI, routing, modules, middleware |
| `@hazeljs/cli` | `hazel new`, generators, `hazel agent` / `hazel skillgate` |
| `@hazeljs/auth` / `@hazeljs/oauth` | JWT + OAuth |
| `@hazeljs/prisma` / `@hazeljs/typeorm` | ORM + repositories |
| `@hazeljs/swagger` | OpenAPI from modules |
| _+ more_ | Cache, Queue, Cron, Kafka, PubSub, Messaging, Saga, Discovery, Gateway, Serverless |

---

## Why HazelJS?

Competitor libraries excel at orchestration graphs. HazelJS differentiates on **shipping agents inside a real backend** and on **lifecycle OS** those libraries leave as glue.

| | HazelJS | Nest + LangGraph | Express + DIY |
| --- | --- | --- | --- |
| **Agents in the same app as APIs** | Yes | Glue | Glue |
| **DNA packages / Store / apply** | Yes | No | No |
| **Governed OpenAPI skills** | Skillgate | DIY | DIY |
| **Crash-safe HITL** | Yes | Partial | DIY |
| **Reversible / speculative tools** | Agent VM | No | DIY |
| **CI agent suites** | `describeAgent` | DIY | DIY |

---

## Documentation

- **[hazeljs.ai](https://hazeljs.ai/docs)** — full docs
- **[Agent OS guide](https://hazeljs.ai/docs/guides/agent-os)** — DNA, HITL, Skillgate, local apply
- **[Quick Start](./QUICKSTART.md)** · **[Troubleshooting](./TROUBLESHOOTING.md)** · **[Contributing](./CONTRIBUTING.md)**
- **[Meridian](https://github.com/hazel-js/hazeljs-meridian-ops)** — flagship teaching app
- Package READMEs: [`agent`](./packages/agent) · [`skillgate`](./packages/skillgate) · [`agent-vm`](./packages/agent-vm) · [`agent-gatekeeper`](./packages/agent-gatekeeper) · [`testing`](./packages/testing)

---

## Show your support

**If HazelJS saved you time, give us a star.** ⭐

[![Star History Chart](https://api.star-history.com/svg?repos=hazel-js/hazeljs&type=Date)](https://star-history.com/#hazel-js/hazeljs&Date)

- ⭐ Star the repo · 🐛 [Report bugs](https://github.com/hazel-js/hazeljs/issues) · 💬 [Discord](https://discord.gg/PxNBPzvQk7)
- [Contributing Guide](./CONTRIBUTING.md) · [Contributors](./CONTRIBUTORS.md)

---

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Add tests
5. Open a PR

Read our [Contributing Guide](./CONTRIBUTING.md) for details.

---

## Support

- 💬 **Discord**: [Join](https://discord.gg/PxNBPzvQk7)
- 💭 **Discussions**: [GitHub Discussions](https://github.com/hazel-js/hazeljs/discussions)
- 🐛 **Issues**: [Report bugs](https://github.com/hazel-js/hazeljs/issues)

---

## License

Apache 2.0 — Free for commercial and open-source use.

---

<div align="center">

**Built with ❤️ for developers who ship agents in production**

[Get Started](#quick-start) · [Meridian](https://github.com/hazel-js/hazeljs-meridian-ops) · [Join Discord](https://discord.gg/PxNBPzvQk7) · [⭐ Star on GitHub](https://github.com/hazel-js/hazeljs)

**HazelJS** · Agent OS for TypeScript backends.

</div>
