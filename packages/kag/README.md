# @hazeljs/kag

**Entities, facts, and relationships — with provenance you can audit.**

Knowledge-Augmented Generation for HazelJS — typed knowledge graphs, time-scoped facts, contradictions, and explainable multi-hop reasoning. Use when the question is “why did X change?” over structured domain state, not “which PDF page mentions X?”

KAG does **not** duplicate GraphRAG internals. Import document-derived graphs via `importGraph()`; community detection and vector search stay in `@hazeljs/rag`.

[![npm version](https://img.shields.io/npm/v/@hazeljs/kag.svg)](https://www.npmjs.com/package/@hazeljs/kag)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/kag)](https://www.npmjs.com/package/@hazeljs/kag)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## KAG vs RAG

|          | KAG                                                | RAG                         |
| -------- | -------------------------------------------------- | --------------------------- |
| Question | What entities, facts, and relationships do I know? | What passages are relevant? |
| Unit     | Entity / relation / fact                           | Document chunk              |
| Strength | Multi-hop structured reasoning                     | Semantic similarity         |

## Features

- **Typed primitives** — `KnowledgeEntity` / `KnowledgeRelation` / `KnowledgeFact` with confidence + provenance
- **Tenant-partitioned store** — `InMemoryKnowledgeStore` (Neo4j/Postgres via `KnowledgeStore` ports later)
- **Entity resolution** — `exact` / `normalized` / `semantic` / `custom`; no auto-merge below threshold
- **Temporal + contradictions** — `asOf`, ranked conflicts, policy `keep` | `rank` | `reject`
- **Industry-pluggable planner** — generic by default; opt in with `COMMERCE_INDUSTRY_PROFILE` (or your own)
- **Explainable answers** — `ask({ explain: true })` returns evidence paths (not model CoT)
- **Agent OS port** — inject as `AgentRuntimeConfig.kagService`; DNA may declare `context.kag.enabled`

## Installation

```bash
npm install @hazeljs/kag @hazeljs/core
```

## Quick Start

```typescript
import { KnowledgeGraph, COMMERCE_INDUSTRY_PROFILE } from '@hazeljs/kag';

const knowledge = new KnowledgeGraph({
  tenantId: 'merchant-123',
  graph: 'commerce',
  industry: COMMERCE_INDUSTRY_PROFILE, // opt-in commerce vocabulary
});

await knowledge.entity({
  id: 'merchant-123',
  type: 'merchant',
  properties: { name: 'Demo Restaurant' },
});
await knowledge.entity({
  id: 'order-456',
  type: 'order',
  properties: { total: 120 },
});
await knowledge.relate({
  from: 'merchant-123',
  to: 'order-456',
  type: 'HAS_ORDER',
});

const result = await knowledge.ask('Why was settlement lower yesterday?', {
  explain: true,
});
// { answer, evidence, sources, confidence, explanation }
```

## Entities, Relationships, Facts

Typed primitives with optional `confidence`, `source` provenance, and `validFrom` / `validUntil`.

## Entity Resolution

`EntityResolver` strategies: `exact`, `normalized`, `semantic` (when embed is provided), `custom`. Uncertain matches stay as candidates below `mergeThreshold` (default 0.9).

## Temporal Knowledge, Confidence, Contradictions

- Query with `asOf` or `currentFacts()` / `changes(from, to)`
- Path confidence aggregates with `min` (default) or `product`
- Contradictions are retained; ranked by authority → timestamp → confidence → priority
- Policy `reject` throws `KnowledgeConflictError`

## Knowledge Queries & RAG Integration

`HeuristicQueryPlanner` is industry-agnostic by default (generic causal/temporal/comparison intents). Opt into a domain with `industry: COMMERCE_INDUSTRY_PROFILE` (or your own `IndustryProfile`). Pass `{ rag: true }` with an injected `KnowledgeRetriever` to fuse document passages.

## Memory Integration

`promoteObservation({ validated: true, confidence })` is explicit. No automatic promotion from `@hazeljs/memory`.

## Agent Integration

Inject `KagService` as `AgentRuntimeConfig.kagService`. DNA may declare `context.kag.enabled`.

## Security

Every store call requires `KnowledgeScope.tenantId`. Optional `KnowledgeAuthorizer` or `createCaslKnowledgeAuthorizer(can)`.

## Production Guide

- Start with `InMemoryKnowledgeStore`; design against `KnowledgeStore` for Neo4j/Postgres later
- Always set tenant scope; add authorizer for entity-level access
- Prefer `explain: true` for enterprise audit trails (evidence, not model CoT)

## Related

- Docs: [hazeljs.ai/docs/packages/kag](https://hazeljs.ai/docs/packages/kag)
- Blog: [RAG vs CAG vs KAG](https://hazeljs.ai/blog/rag-vs-cag-vs-kag)
- Lab: [meridian-ops `example:kag`](https://github.com/hazel-js/hazeljs-meridian-ops/tree/main/examples/kag-commerce-agent)
- `@hazeljs/rag` — GraphRAG import source + document retrieval
- `@hazeljs/cag` — stable cached context
- `@hazeljs/context` — unified planner
- `@hazeljs/memory` — user continuity (promote explicitly)

## License

Apache 2.0 © [HazelJS](https://hazeljs.ai)

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.
