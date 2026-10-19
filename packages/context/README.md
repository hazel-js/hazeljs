# @hazeljs/context

**One planner. Four context layers.**

Unified Agent Context Engine for HazelJS — plans and assembles context from CAG, RAG, KAG, and Memory under a token budget. Each layer stays independently useful; this package is the planner + assembler, not a replacement.

[![npm version](https://img.shields.io/npm/v/@hazeljs/context.svg)](https://www.npmjs.com/package/@hazeljs/context)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/context)](https://www.npmjs.com/package/@hazeljs/context)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

| Source          | Package                             | Role                       |
| --------------- | ----------------------------------- | -------------------------- |
| cache / CAG     | `@hazeljs/cag`                      | Stable, reusable context   |
| RAG             | `@hazeljs/rag`                      | Query-relevant passages    |
| knowledge / KAG | `@hazeljs/kag`                      | Entities, facts, relations |
| Memory          | `@hazeljs/memory` (or agent memory) | Continuity & preferences   |

## Features

- **Strategies** — `auto` | `all` | `explicit` with source aliases (`cache`→`cag`, `knowledge`→`kag`)
- **Duck-typed ports** — wire `@hazeljs/cag` / `rag` / `kag` / `memory` without hard couples
- **Labeled assembly** — contributors soft-fail independently so one outage does not blank the prompt
- **Token budget** — assemble under a shared limit with plan rationale for observability
- **Agent OS port** — inject as `AgentRuntimeConfig.contextService`; DNA may declare `context.strategy` / `sources`

## Installation

```bash
npm install @hazeljs/context @hazeljs/core
# optional peers as needed:
npm install @hazeljs/cag @hazeljs/kag @hazeljs/rag @hazeljs/memory
```

## Quick Start

```typescript
import { ContextModule, ContextService } from '@hazeljs/context';

ContextModule.forRoot({
  strategy: 'auto',
  sources: ['cache', 'rag', 'knowledge', 'memory'],
  cag: cagService, // duck-typed @hazeljs/cag
  rag: ragService, // duck-typed @hazeljs/rag
  kag: kagService, // duck-typed @hazeljs/kag
  memory: memoryService,
});

const assembled = await context.assemble({
  query: 'Why was settlement lower given our refund policy?',
  tenantId: 'merchant-123',
  userId: 'ops-1',
});

// assembled.text → labeled blocks for the LLM
// assembled.plan.rationale → why each source was chosen
```

## Strategies

- **`auto`** — heuristic selection from the query (policy → CAG, why/entity → KAG, preference → memory, lookup → RAG; complex queries combine)
- **`all`** — every registered contributor
- **`explicit`** — only `sources`

Aliases: `cache`→`cag`, `knowledge`→`kag`.

## Agent OS

Inject as `AgentRuntimeConfig.contextService`. DNA may declare:

```json
{
  "context": {
    "strategy": "auto",
    "sources": ["cache", "rag", "knowledge", "memory"]
  }
}
```

Individual `context.cag` / `rag` / `kag` / `memory` flags remain valid.

## Related

- Docs: [hazeljs.ai/docs/packages/context](https://hazeljs.ai/docs/packages/context)
- Blog: [RAG vs CAG vs KAG](https://hazeljs.ai/blog/rag-vs-cag-vs-kag)
- Lab: [meridian-ops `example:context`](https://github.com/hazel-js/hazeljs-meridian-ops/tree/main/examples/context-auto-agent)
- `@hazeljs/cag` · `@hazeljs/rag` · `@hazeljs/kag` · `@hazeljs/memory`

## License

Apache 2.0 © [HazelJS](https://hazeljs.ai)

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.
