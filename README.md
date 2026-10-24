<div align="center">

# HazelJS

**The Agent OS for TypeScript.**  
Operate agents like production systems.

[![GitHub stars](https://img.shields.io/github/stars/hazel-js/hazeljs?style=social)](https://github.com/hazel-js/hazeljs)
[![CI](https://github.com/hazel-js/hazeljs/actions/workflows/ci.yml/badge.svg)](https://github.com/hazel-js/hazeljs/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/%40hazeljs%2Fcore.svg)](https://badge.fury.io/js/%40hazeljs%2Fcore)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/core)](https://www.npmjs.com/package/@hazeljs/core)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

Frameworks help you **build** agents. HazelJS helps you **run** them — durable, governed, local-first.

[Get started](#get-started) · [Agent OS](https://hazeljs.ai/agent-os) · [Docs](https://hazeljs.ai/docs) · [Meridian](https://github.com/hazel-js/hazeljs-meridian-ops)

</div>

---

## Why an Agent OS?

| | |
| --- | --- |
| **Frameworks help you build** | Prompt loops and tools get you to a demo. |
| **Agent OS helps you operate** | Durable runs, Gatekeeper, DNA, and HITL keep agents running for real. |
| **Local-first TypeScript** | `hazel apply` on your laptop. Cloud and Kubernetes are optional. |

You do **not** assemble Nest + LangGraph + a worker fleet. Agents live in the same TypeScript backend as your APIs.

```
Define → Run → Decide → Govern → Survive
```

> **Name collisions:** HazelJS Agent OS is not [Builder Methods Agent OS](https://hazeljs.ai/compare/builder-methods-agent-os), [Agno AgentOS](https://hazeljs.ai/compare/agno-agentos), or [Framers AgentOS](https://hazeljs.ai/compare/agentos-sh).

---

## Get started

Four commands. Install → Apply → Running — survives closing the terminal.

```bash
npm install -g @hazeljs/cli
hazel new agent support-agent
cd support-agent && npm install
hazel apply
```

Guides: [Local Agent OS](https://hazeljs.ai/docs/guides/local-agent-os) · [Agent OS overview](https://hazeljs.ai/docs/guides/agent-os)

### Prefer a full teaching app?

Clone **Meridian** — DNA, Store, Decision, Skillgate, HITL, and local apply in one repo.

```bash
git clone https://github.com/hazel-js/hazeljs-meridian-ops.git
cd hazeljs-meridian-ops
npm install
npm run store:sync      # DNA packages + lockfile
npm run platform:sync   # Apply Definitions / Deployments
npm run dev             # Chat with real @Tool handlers + HITL
```

### HTTP + AI app (`ai-native` template)

Scaffold a **server** on port 3000 (chat, agents, Prisma RAG, ContextService) — not `hazeld`. Use this when you want an HTTP/HCEL backend first; use [Get started](#get-started) or Meridian for local Agent OS (apply / HITL).

```bash
npm install -g @hazeljs/cli
hazel new my-app --template=ai-native
cd my-app
npm install
cp .env.example .env    # add OPENAI_API_KEY
npm run dev
```

Then open:

- App: http://localhost:3000
- Inspector: http://localhost:3000/__hazel
- Health: http://localhost:3000/health

Quick checks:

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is HazelJS?"}'
```

Skeleton API only (no AI scaffold): `hazel new my-api` or `hazel g app my-api`.

---

## What you get

| Layer | Primitives | Job |
| --- | --- | --- |
| **Define & Deploy** | DNA · Store · Apply | Version identity, prompt, skills, and policy. Declare desired state locally. |
| **Run** | Runtime · Agent VM · Organism | Execute the loop. Speculate / undo. Self-organize specialists from a mission. |
| **Decide** | Decision Runtime · Confidence · Policy | Closed-set choose (`retry \| rollback \| escalate`). Confidence informs — never authorizes. |
| **Govern** | Skillgate · Gatekeeper | Curate which APIs become skills. Authorize every tool call (default deny). |
| **Survive** | Durable runs · HITL · Recovery | Crash-safe human approval. Runs outlive process restarts. |

Built on your TypeScript / Node.js backend. Local first. Kubernetes optional — never the product.

---

## Agents in code

```typescript
import { Agent, Tool } from '@hazeljs/agent';

@Agent({
  name: 'support-agent',
  systemPrompt: 'You are a helpful customer support agent.',
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

### Decision Runtime — choose, then govern

LLMs reason. Decision Runtime judges from a closed set. Gatekeeper still authorizes.

```typescript
import { createDecisionRuntime } from '@hazeljs/decision';

const decisions = createDecisionRuntime({ gatekeeper });

const result = await decisions.decide({
  objective: 'Choose the safest remediation',
  state: { errorRate: 0.38, failedHealthChecks: 8 },
  choices: ['retry', 'rollback', 'escalate', 'ignore'] as const,
  risk: 'high',
  execute: true,
});
// result.decision is typed — Gatekeeper still gates side effects
```

### Skillgate — OpenAPI → governed skills

```typescript
import { Skillgate } from '@hazeljs/skillgate';

const gate = Skillgate.fromOpenApi(spec, {
  include: { tags: ['agent'] },
  classify: { writeRequiresApproval: true },
  invoke: { baseUrl: process.env.API_BASE_URL! },
});
gate.register(registry, 'api-concierge');
```

More: [Decision](https://hazeljs.ai/docs/guides/decision) · [Skillgate](https://hazeljs.ai/docs/guides/skillgate) · [Gatekeeper](https://hazeljs.ai/docs/guides/agent-gatekeeper) · [Agent VM](https://hazeljs.ai/docs/packages/agent-vm)

---

## CLI

```bash
# Agent OS
hazel new agent my-desk
hazel apply
hazel agent run | doctor | logs
hazel agent runs list | inspect | resume | approve
hazel store publish | install | list
hazel skillgate from-openapi ./openapi.yaml
hazel gatekeeper validate | simulate
hazel decision run | lab | compare

# HTTP app scaffolding (secondary — not hazeld)
hazel new my-app --template=ai-native
hazel g app my-api
hazel add @hazeljs/auth --setup
```

---

## Examples

| Repo | Learn |
| --- | --- |
| [hazeljs-meridian-ops](https://github.com/hazel-js/hazeljs-meridian-ops) | Flagship Agent OS — DNA, Store, Decision, Skillgate, HITL |
| [hazeljs-skillgate-agent-starter](https://github.com/hazel-js/hazeljs-skillgate-agent-starter) | OpenAPI → governed skills + MCP |
| [hazeljs-mcp-starter](https://github.com/hazel-js/hazeljs-mcp-starter) | `@Tool` as an MCP server |
| [hazeljs-csr-agent](https://github.com/hazel-js/hazeljs-csr-agent) | Support agent example |

---

## Packages

**Agent OS**

| Package | Role |
| --- | --- |
| `@hazeljs/agent` | Runtime — `@Agent` / `@Tool`, DNA, HITL, policy |
| `@hazeljs/decision` | Closed-set Decision Runtime |
| `@hazeljs/skillgate` | OpenAPI → governed skills |
| `@hazeljs/agent-gatekeeper` | Fail-closed tool authorization |
| `@hazeljs/agent-vm` | Reversible tools, speculative undo |
| `@hazeljs/organism` | Mission-defined agent societies |
| `@hazeljs/testing` · `@hazeljs/eval` · `@hazeljs/benchmark` | CI, golden sets, regression |
| `@hazeljs/inspector` · `@hazeljs/mcp` | Timelines · MCP from `@Tool` |

**Around Agent OS** (optional — they support it, they do not compete with it)

| Area | Packages |
| --- | --- |
| AI / RAG / Flow | `@hazeljs/ai` · `@hazeljs/rag` · `@hazeljs/flow` · `@hazeljs/prompts` |
| Backend | `@hazeljs/core` · `@hazeljs/auth` · `@hazeljs/prisma` · GraphQL / gRPC / queues |

```bash
npm install @hazeljs/agent @hazeljs/decision @hazeljs/skillgate @hazeljs/agent-gatekeeper
# CLI
npm install -g @hazeljs/cli
```

Do **not** add `reflect-metadata` yourself — `@hazeljs/core` loads it.

---

## Why not Nest + LangGraph?

| | HazelJS | Nest + LangGraph |
| --- | --- | --- |
| Agents in the same app as APIs | Yes | Glue |
| DNA / Store / local apply | Yes | No |
| Closed-set Decision Runtime | Yes | DIY |
| Governed OpenAPI skills | Skillgate | DIY |
| Fail-closed tool auth | Gatekeeper | DIY |
| Crash-safe HITL | Yes | Partial |

---

## Docs & community

- [hazeljs.ai](https://hazeljs.ai) — site
- [Docs](https://hazeljs.ai/docs) · [Agent OS](https://hazeljs.ai/agent-os) · [Local Agent OS](https://hazeljs.ai/docs/guides/local-agent-os)
- [Quick Start](./QUICKSTART.md) · [Contributing](./CONTRIBUTING.md) · [Troubleshooting](./TROUBLESHOOTING.md)
- [Discord](https://discord.gg/PxNBPzvQk7) · [Issues](https://github.com/hazel-js/hazeljs/issues)

---

## License

Apache 2.0 — free for commercial and open-source use.

---

<div align="center">

**Operate agents like production systems.**

[Get started](#get-started) · [Meridian](https://github.com/hazel-js/hazeljs-meridian-ops) · [Discord](https://discord.gg/PxNBPzvQk7) · [⭐ Star](https://github.com/hazel-js/hazeljs)

</div>
