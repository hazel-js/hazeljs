# @hazeljs/organism

**Deploy a mission, not an agent topology.**

In conventional multi-agent systems, developers define the organization. In HazelJS Agentic Organisms, developers define the mission and operating boundaries — the organization emerges dynamically at runtime. Built on Agent OS (`@hazeljs/agent`) and `@hazeljs/core`.

[![npm version](https://img.shields.io/npm/v/@hazeljs/organism.svg)](https://www.npmjs.com/package/@hazeljs/organism)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/organism)](https://www.npmjs.com/package/@hazeljs/organism)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Why @hazeljs/organism?

Static agent graphs force you to pre-design teams for every incident type. Organism flips that: you ship genes (capability templates), a constitution, and resource limits; need detection spawns, reuses, or specializes agents as signals arrive.

**Perfect for:**

- Ops / commerce platforms that must react to spikes without hard-coding agent teams
- Product teams embedding a self-organizing runtime above Agent OS
- Simulations and policy-bound remediations with `simulate()`, inspect, and emergency stop

## Features

- 🎯 **Mission-first runtime** — Objective and success criteria drive behavior, not a fixed topology
- 🧬 **Genes & birth** — Reusable capability templates; spawn / reuse / specialize under limits
- 👁️ **Perception** — Environment signals → need detection → dynamic agent teams
- 📜 **Constitution** — Rules no agent may override (PII, refund caps, etc.)
- 💰 **Economy** — Finite token / money / tool budgets with utility and reputation
- 🔁 **Lifecycle** — Survival, reproduction, mutation, and generation evaluation
- 🏪 **Market (Phase 4)** — Resource bidding, clearing, and peer negotiation
- 🧪 **Simulation & inspect** — `simulate()`, inspect/graph, events, genealogy
- 📦 **Product embedding** — `createOpsOrganism`, signal bridges, `OrganismHostRegistry`

## Installation

```bash
npm install @hazeljs/organism @hazeljs/agent @hazeljs/core
```

Enable `experimentalDecorators` (and typically `emitDecoratorMetadata`) in `tsconfig.json`.

## Quick Start

```typescript
import { createOrganism } from '@hazeljs/organism';

const organism = await createOrganism({
  mission: {
    id: 'support',
    objective: 'Operate customer support while maintaining 90% CSAT',
    successCriteria: [{ name: 'csat', operator: 'gte', target: 90 }],
  },
  genes: [
    {
      id: 'support-gene',
      capabilities: ['customer-support', 'commerce'],
    },
    {
      id: 'analysis-gene',
      capabilities: ['analytics', 'analysis'],
    },
  ],
  constitution: {
    id: 'commerce',
    rules: [
      {
        id: 'privacy',
        rule: 'Never expose customer personally identifiable information',
        severity: 'critical',
      },
      {
        id: 'refund-limit',
        rule: 'Refunds above $200 require human approval',
        severity: 'high',
      },
    ],
  },
  limits: {
    maxAgents: 10,
    maxGenerationDepth: 3,
    maxChildrenPerAgent: 3,
    maxSpawnRatePerMinute: 5,
    maxTotalCostPerHour: 10,
  },
  signalNeedMappings: [
    {
      signalType: 'refunds.increased',
      need: 'refund-analysis',
      requiredCapabilities: ['analytics', 'commerce'],
      urgency: 0.9,
      confidence: 0.9,
    },
  ],
  debug: true,
});

await organism.start();

await organism.observe({
  type: 'refunds.increased',
  source: 'analytics',
  severity: 0.9,
  data: { baseline: 0.04, current: 0.071 },
});

const state = await organism.inspect();
console.log(state.agents);
```

## Decorators

```typescript
import { Mission, Organism, AgentGene, Constitution, Environment } from '@hazeljs/organism';

@Mission({ id: 'ops', objective: 'Keep the store healthy' })
class OpsMission {}

@AgentGene({ id: 'commerce', capabilities: ['commerce', 'support'] })
class CommerceGene {}

@Organism({ mission: OpsMission, genes: [CommerceGene] })
class StoreOrganism {}
```

## Core Concepts

| Term | Meaning |
|------|---------|
| **Mission** | What the organism is trying to achieve |
| **Organism** | Autonomous runtime pursuing the mission |
| **Gene** | Reusable capability template for spawning agents |
| **Agent** | Ephemeral worker created inside the organism |
| **Environment** | External signals the organism observes |
| **Constitution** | Rules no agent may override |
| **Economy** | Finite token / money / tool budgets |

## Safety Defaults

- `maxAgents`, `maxGenerationDepth`, `maxSpawnRatePerMinute`, `maxTotalCostPerHour`
- Capability reuse before birth
- Constitution enforcement on spawn / refund / PII
- `pause()` / `resume()` / `terminate()` / `emergencyStop()`

## Embedding in Product Platforms

Prefer the host / ops APIs instead of wrapping the runtime yourself:

```typescript
import {
  createOpsOrganism,
  OrganismHostRegistry,
  toEnvironmentSignal,
  toIncidentEnvironmentSignal,
} from '@hazeljs/organism';

const registry = new OrganismHostRegistry();

const host = await registry.getOrCreate(undefined, () =>
  createOpsOrganism({
    mission: { id: 'ops', objective: 'Keep the business healthy' },
    genes: [{ id: 'generalist', capabilities: ['operations'] }],
    incidentTypes: ['refund_spike'],
    simulation: true,
  })
);

await host.start();
await host.observe(toEnvironmentSignal({ type: 'refund.created', source: 'store' }));
await host.observe(toIncidentEnvironmentSignal({ incidentType: 'refund_spike' }));
```

Inject `OrganismRepository` for persistence. Full guide: [`docs/embedding.md`](./docs/embedding.md).

## CLI

```bash
hazel organism list
hazel organism inspect <id>
hazel organism agents <id>
hazel organism genealogy <id>
hazel organism resources <id>
hazel organism events <id>
hazel organism pause <id>
hazel organism resume <id>
hazel organism stop <id>
```

## Examples

See [`examples/ecommerce-organism`](./examples/ecommerce-organism) for a runnable demo.

## Docs

- [`docs/architecture.md`](./docs/architecture.md) — runtime design
- [`docs/embedding.md`](./docs/embedding.md) — product-platform integration
- [`docs/`](./docs/) — full documentation set

## License

Apache-2.0

## Links

- [npm](https://www.npmjs.com/package/@hazeljs/organism)
- [HazelJS](https://hazeljs.ai)
- [GitHub](https://github.com/hazel-js/hazeljs/tree/main/packages/organism)
