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

### 🎯 **Try it** → clone [Meridian](https://github.com/hazel-js/hazeljs-meridian-ops) · or `npx @hazeljs/cli agent new my-desk --template=agent-os`

</div>

---

## What HazelJS is

HazelJS is a TypeScript backend whose **primary product is Agent OS**: durable AI agents inside the same app as your APIs. Package them (DNA), govern writes (Skillgate), authorize every tool (Gatekeeper), survive crashes (HITL), and undo speculative work (Agent VM).

| Audience                             | Story                                                                                           |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| **Backend teams putting AI in APIs** | Durable agents in your TypeScript backend — DNA, HITL, Skillgate, local apply (same DI as HTTP) |
| **Agent platform teams**             | Agent OS control plane — Store, Definitions / Deployments, reconcile; K8s optional              |

You do **not** assemble Nest + LangGraph + a worker fleet. The Agent Runtime is the kernel; Agent OS is how you ship it.

### Agent OS — ship

- 🧬 **DNA packages** — prompt + policy + contracts as versioned packages (DNA ≠ tool implementations)
- 🚪 **Skillgate** — curated OpenAPI / REST → governed agent skills (reads by default, writes need approval)
- 🛡️ **Gatekeeper** — fail-closed authorization on every tool call (not a prompt guardrail)
- ⏸️ **Crash-safe HITL** — `durableSuspend` / `approveAndResume`; process survives restarts
- ⚙️ **Agent VM** — `@Reversible` / `@Compensate`, speculative branches, atomic undo
- 🖥️ **Inspector timelines** — live SSE + JSON replay at `/__hazel`

### Agent OS — run, test, improve

- 🌀 **Confidence loop** — plan → execute → critique → validate (`options.loop`)
- 📜 **Contracts + recovery** — `options.contract` / `options.recovery` (`RETRYING` / `BLOCKED`, fallback agent)
- 🧭 **Policy engine** — allow / deny / mask / require approval on tools
- ⏪ **Time travel** — fork a timeline, edit a step, continue (`runtime.getTimeTravel()`)
- ♻️ **Hot-reload DNA** — `runtime.hotReloadDna()` / `hazel agent install` without restart
- 🧪 **`describeAgent` CI** — latency / cost / tool-trajectory gates (`@hazeljs/testing`)
- 📊 **Eval + benchmark** — golden datasets (`@hazeljs/eval`) and `hazel benchmark`
- 💸 **Cost routing** — `options.costRoute` / `CostOptimizer`
- 🗳️ **Consensus** — `runConsensus` (majority / weighted / unanimous)
- 🪞 **Digital twin / canary** — `runDigitalTwin` / `shouldRunCanary`
- 🧠 **Memory graph** — `AgentMemoryGraph` + GraphRAG bridge
- 🔌 **MCP** — same `@Tool` handlers as an MCP server (`@hazeljs/mcp`)
- 🤝 **A2A** — agent card + JSON-RPC (`A2AServer`, `buildAgentCard`)

### Also in the stack (when you need them)

- ⚡ **HCEL** — fluent prompt → RAG → agent → ML chains (`@hazeljs/ai`)
- 📚 **RAG / GraphRAG** — loaders, vector stores, agentic retrieval (`@hazeljs/rag`)
- 🔁 **Flow** — durable WAIT / resume workflows (`@hazeljs/flow`)
- 🏗️ **Core** — modules, controllers, DI, routing (`@hazeljs/core`)
- 🔐 **Auth, data, realtime** — JWT / OAuth, Prisma / TypeORM, GraphQL / gRPC, queues, Kafka, WebSocket — **same app as the agents**

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

### Option 2: Agent OS scaffold

Smaller than Meridian. DNA + HITL templates — not an HTTP/HCEL demo.

```bash
npx @hazeljs/cli agent new my-desk --template=agent-os
# templates: bare | agent-os | skillgate
cd my-desk && npm install && npm run dev
```

### Option 3: CLI template (HTTP + HCEL / RAG scaffold)

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

### Option 4: One file

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

Confidence loop, contracts, recovery, and cost routing:

```typescript
await runtime.execute('support-agent', goal, {
  loop: { maxIterations: 8, successScore: 95 },
  contract: { name: 'refund', outputIncludes: 'refund', maxLatencyMs: 8000 },
  recovery: { maxRetries: 3, fallbackAgent: 'safe-agent' },
  costRoute: { maxCostUsd: 0.05, qualityBias: 0 },
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

### Policy, DNA reload, time travel

```typescript
import { PolicyEngine, exportAgentDna } from '@hazeljs/agent';

runtime.setPolicyEngine(
  new PolicyEngine([
    { id: 'mask-pii', tool: '*', effect: 'mask', maskFields: ['ssn', 'email'] },
    { id: 'refund-hitl', tool: 'processRefund', effect: 'require_approval' },
  ])
);

runtime.hotReloadDna(
  exportAgentDna({
    name: 'support-agent',
    systemPrompt: 'Be concise. Never refund without lookup.',
  })
);

const tt = runtime.getTimeTravel();
const fork = tt.fork(executionId);
tt.edit(fork.forkId, { stepId: fork.steps[0].id, kind: 'prompt', value: 'Retry with order 123' });
```

### MCP — same `@Tool` handlers in Cursor / Claude Desktop

```typescript
import { ToolRegistry } from '@hazeljs/agent';
import { createMcpServer } from '@hazeljs/mcp';

const registry = new ToolRegistry();
registry.registerAgentTools('support', new SupportAgent());

createMcpServer({
  name: 'hazel-support-agent',
  version: '1.0.0',
  toolRegistry: registry,
}).listenStdio();
```

### A2A — agent card + JSON-RPC

```typescript
import { A2AServer, buildAgentCard } from '@hazeljs/agent';

const a2a = new A2AServer(runtime, { defaultAgent: 'support-agent' });

app.get('/.well-known/agent.json', (_req, res) => {
  res.json(buildAgentCard(runtime, { url: 'https://api.example.com/a2a' }));
});

app.post('/a2a', async (req, res) => {
  res.json(await a2a.handleRequest(req.body));
});
```

### Consensus, canary, evolution

```typescript
import { runConsensus, runDigitalTwin, shouldRunCanary, evolveSystemPrompt } from '@hazeljs/agent';

const { agreed, value } = runConsensus(
  [
    { agentId: 'a', value: 'refund' },
    { agentId: 'b', value: 'refund' },
    { agentId: 'c', value: 'deny' },
  ],
  'majority'
);

if (shouldRunCanary(0.1)) {
  await runDigitalTwin({
    runPrimary: () => runtime.execute('support-agent', goal),
    runTwin: () => runtime.execute('support-agent-canary', goal),
  });
}

const evolved = await evolveSystemPrompt({ currentPrompt, failures });
```

---

## CLI

```bash
# Agent OS
hazel agent new my-desk --template=agent-os   # also: bare | skillgate
hazel agent install ./packages/support.dna.json
hazel agent run / doctor / logs
hazel agent runs list | inspect | cancel | resume | approve
hazel store publish | install | list
hazel skillgate from-openapi ./openapi.yaml
hazel gatekeeper validate | simulate | explain
hazel benchmark
hazel eval

# App scaffolding (framework)
hazel g app my-api
hazel g controller users
hazel add @hazeljs/auth --setup
```

---

## Examples & starters

**Agent OS (start here)**

| Repo                                                                                           | What you learn                                      |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| [hazeljs-meridian-ops](https://github.com/hazel-js/hazeljs-meridian-ops)                       | Flagship — DNA, Store, Skillgate, HITL, local apply |
| [hazeljs-skillgate-agent-starter](https://github.com/hazel-js/hazeljs-skillgate-agent-starter) | OpenAPI → governed skills + MCP                     |
| [hazeljs-mcp-starter](https://github.com/hazel-js/hazeljs-mcp-starter)                         | `@Tool` as an MCP server                            |
| [hazeljs-csr-agent](https://github.com/hazel-js/hazeljs-csr-agent)                             | Support agent example                               |

**Quality, safety, workflows**

| Repo                                                                                                   | What you learn                                  |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| [hazeljs-guardrails-ai-starter](https://github.com/hazel-js/hazeljs-guardrails-ai-starter)             | PII, injection, toxicity                        |
| [hazeljs-inspector-dashboard-example](https://github.com/hazel-js/hazeljs-inspector-dashboard-example) | Timelines at `/__hazel`                         |
| [hazeljs-flow-starter](https://github.com/hazel-js/hazeljs-flow-starter)                               | Durable WAIT / resume flows                     |
| [hazeljs-integrations](https://github.com/hazel-js/hazeljs-integrations)                               | Vendor kits (Shopify, …) — not in this monorepo |

Vendor connectors live in **hazeljs-integrations**, so framework releases stay decoupled from SaaS API churn.

---

## Framework layer (HCEL, RAG, Flow)

Use these when you are building HTTP APIs, retrieval, or workflows **alongside** Agent OS — not instead of it.

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

Agents sit next to REST, GraphQL, gRPC, auth, Prisma/TypeORM, queues, and WebSocket in the same `HazelApp`. You do not stand up a second Nest or Express process for the product API.

---

## Installation

```bash
# Core (required for HTTP / DI apps)
npm install @hazeljs/core

# Agent OS
npm install @hazeljs/agent @hazeljs/skillgate @hazeljs/agent-gatekeeper @hazeljs/agent-vm
npm install @hazeljs/testing @hazeljs/eval @hazeljs/benchmark @hazeljs/inspector @hazeljs/mcp

# AI / RAG / workflows (optional)
npm install @hazeljs/ai @hazeljs/rag @hazeljs/flow @hazeljs/prompts

# CLI
npm install -D @hazeljs/cli
```

Do **not** add `reflect-metadata` to your app. `@hazeljs/core` installs and loads it. Generated apps (`hazel new` / `hazel g app` / `hazel agent new`) do not list it in `package.json`.

---

## Packages

### Agent OS

| Package                     | What it does                                                                |
| --------------------------- | --------------------------------------------------------------------------- |
| `@hazeljs/agent`            | Kernel — `@Agent` / `@Tool`, DNA, HITL, loop, policy, A2A, `AgentOS` facade |
| `@hazeljs/skillgate`        | OpenAPI / REST → governed skills (allowlist, classify, approval)            |
| `@hazeljs/agent-gatekeeper` | Fail-closed authorization on every tool call                                |
| `@hazeljs/agent-vm`         | Reversible tools, speculative branches, atomic undo                         |
| `@hazeljs/organism`         | Mission-defined self-organizing agent societies (Agentic Organism Runtime)  |
| `@hazeljs/testing`          | `describeAgent` CI suites (latency / cost / tools)                          |
| `@hazeljs/eval`             | Golden datasets, RAG + trajectory metrics                                   |
| `@hazeljs/benchmark`        | Benchmark suites + regression compare (`hazel benchmark`)                   |
| `@hazeljs/inspector`        | DevTools UI, agent timelines, durable run list                              |
| `@hazeljs/mcp`              | Expose `@Tool` handlers as an MCP server                                    |

### AI & data

| Package                  | What it does                                  |
| ------------------------ | --------------------------------------------- |
| `@hazeljs/ai`            | Multi-provider LLMs, streaming, HCEL          |
| `@hazeljs/rag`           | Vector search, GraphRAG, loaders, agentic RAG |
| `@hazeljs/ml`            | Feature store, experiments, drift detection   |
| `@hazeljs/guardrails`    | PII, injection, toxicity, output validation   |
| `@hazeljs/memory`        | Persistent long-term memory                   |
| `@hazeljs/prompts`       | Versioned prompts, hot-swap from Redis / DB   |
| `@hazeljs/flow`          | Durable WAIT / resume workflows               |
| `@hazeljs/observability` | OpenTelemetry traces, cost, reasoning spans   |

### Framework

| Package                                                   | What it does                                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `@hazeljs/core`                                           | DI, routing, modules, middleware                                                   |
| `@hazeljs/cli`                                            | `hazel agent`, Store, Skillgate, Gatekeeper, generators                            |
| `@hazeljs/auth` / `@hazeljs/oauth`                        | JWT + OAuth                                                                        |
| `@hazeljs/prisma` / `@hazeljs/typeorm`                    | ORM + repositories                                                                 |
| `@hazeljs/swagger` / `@hazeljs/graphql` / `@hazeljs/grpc` | HTTP / GraphQL / gRPC surfaces                                                     |
| _+ more_                                                  | Cache, Queue, Cron, Kafka, PubSub, Messaging, Saga, Discovery, Gateway, Serverless |

---

## Why HazelJS?

Competitor libraries excel at orchestration graphs. HazelJS differentiates on **shipping agents inside a real backend** and on **lifecycle OS** those libraries leave as glue.

|                                    | HazelJS         | Nest + LangGraph | Express + DIY |
| ---------------------------------- | --------------- | ---------------- | ------------- |
| **Agents in the same app as APIs** | Yes             | Glue             | Glue          |
| **DNA packages / Store / apply**   | Yes             | No               | No            |
| **Governed OpenAPI skills**        | Skillgate       | DIY              | DIY           |
| **Crash-safe HITL**                | Yes             | Partial          | DIY           |
| **Reversible / speculative tools** | Agent VM        | No               | DIY           |
| **CI agent suites**                | `describeAgent` | DIY              | DIY           |
| **Time travel / DNA hot-reload**   | Yes             | DIY              | DIY           |
| **MCP + A2A from `@Tool`**         | Yes             | Glue             | DIY           |

---

## Documentation

- **[hazeljs.ai](https://hazeljs.ai/docs)** — full docs
- **[Agent OS guide](https://hazeljs.ai/docs/guides/agent-os)** — DNA, HITL, Skillgate, local apply
- **[Skillgate](https://hazeljs.ai/docs/guides/skillgate)** — OpenAPI → governed skills
- **[Quick Start](./QUICKSTART.md)** · **[Troubleshooting](./TROUBLESHOOTING.md)** · **[Contributing](./CONTRIBUTING.md)**
- **[Meridian](https://github.com/hazel-js/hazeljs-meridian-ops)** — flagship teaching app
- Package READMEs: [`agent`](./packages/agent) · [`skillgate`](./packages/skillgate) · [`agent-vm`](./packages/agent-vm) · [`agent-gatekeeper`](./packages/agent-gatekeeper) · [`organism`](./packages/organism) · [`testing`](./packages/testing) · [`mcp`](./packages/mcp)

Hosted DNA marketplace and fleet remain product layers. File-backed Store + local apply is what you use today.

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
