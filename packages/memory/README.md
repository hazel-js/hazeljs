# @hazeljs/memory

**Pluggable user memory for HazelJS.** Profile, preferences, behavioral patterns, emotional state, episodic and semantic memory — one interface, multiple backends. Share the same store between RAG and agents in-process.

[![npm version](https://img.shields.io/npm/v/@hazeljs/memory.svg)](https://www.npmjs.com/package/@hazeljs/memory)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/memory)](https://www.npmjs.com/package/@hazeljs/memory)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

**Storage:** By default the package uses **in-memory storage** (no dependencies). For durable persistence, use the Prisma store (same pattern as `@hazeljs/flow`) or plug in Postgres, Redis, or vector backends.

## Features

- **One interface, multiple backends** — In-memory (default), Postgres (raw or Prisma), Redis, vector episodic, composite
- **Memory categories** — Profile, preference, behavioral, emotional, episodic, semantic_summary
- **Explicit vs inferred** — Store user-stated facts and system-inferred patterns separately
- **Optional TTL** — e.g. for emotional state or short-lived context
- **Composite store** — Route by category to primary + optional episodic/vector store
- **RAG & agent integration** — Use `createHazelMemoryStoreAdapter` from `@hazeljs/rag/memory-hazel` to back `MemoryManager`; share one store across `RAGPipelineWithMemory` and `AgentRuntime`

## Installation

```bash
pnpm add @hazeljs/memory
```

No database or env vars are required for the default in-memory mode.

## Quick Start

### In-memory (default, no dependencies)

```typescript
import { createDefaultMemoryStore, MemoryService } from '@hazeljs/memory';

const store = createDefaultMemoryStore();
const service = new MemoryService(store);
await service.initialize();

// Use service to get/set memory by userId, category, etc.
```

### PostgreSQL with Prisma

When you use Prisma in your app (e.g. like `@hazeljs/flow` and `@hazeljs/flow-runtime`), use the Prisma store:

```typescript
import { createPrismaMemoryStore, getMemoryPrismaClient } from '@hazeljs/memory/prisma';
import { MemoryService } from '@hazeljs/memory';

const prisma = getMemoryPrismaClient(process.env.DATABASE_URL);
const store = createPrismaMemoryStore(prisma);
const service = new MemoryService(store);
await service.initialize();
```

**Build:** Run `pnpm prisma:generate` (or `prisma generate`) before `pnpm build` so the Prisma client is generated. Migrate with `pnpm prisma:migrate` from the package directory.

## Persistence

| Backend | Module / Factory | Use case |
|--------|-------------------|----------|
| **In-memory** | `createDefaultMemoryStore()` | Development, tests, no DB |
| **Prisma** | `createPrismaMemoryStore(prisma)` from `@hazeljs/memory/prisma` | Production, same app DB as flow/core |
| **Postgres (raw)** | `PostgresStore` — pass a `pg` pool with a `query` method (see `postgres.store.ts`) | Existing Postgres without Prisma |
| **Redis** | `RedisStore` — pass an ioredis-style client | High-throughput, shared across processes |
| **Vector episodic** | `VectorEpisodicStore` | Episodic/semantic vector search |
| **Composite** | `CompositeMemoryStore` | Route by category to primary + optional episodic store |

## Memory categories

| Category | Description |
|----------|-------------|
| `profile` | User identity and static attributes |
| `preference` | Stated preferences (e.g. language, theme) |
| `behavioral` | Inferred behavior patterns |
| `emotional` | Emotional state (often with TTL) |
| `episodic` | Event-based memories (what happened when) |
| `semantic_summary` | Summarized or semantic facts |

See types in `src/types/`.

## Integration with @hazeljs/rag and @hazeljs/agent

To back RAG (and agent) memory with `@hazeljs/memory` so RAG and agents share the same user context in-process:

```bash
pnpm add @hazeljs/rag @hazeljs/memory
```

```typescript
import { MemoryManager, RAGPipelineWithMemory } from '@hazeljs/rag';
import { createHazelMemoryStoreAdapter } from '@hazeljs/rag/memory-hazel';
import { MemoryService, createDefaultMemoryStore } from '@hazeljs/memory';

const hazelStore = createDefaultMemoryStore();
const memoryService = new MemoryService(hazelStore);
const ragStore = createHazelMemoryStoreAdapter(memoryService);
const memoryManager = new MemoryManager(ragStore);

// Pass the same MemoryManager to RAG and to every AgentRuntime
const rag = new RAGPipelineWithMemory(config, memoryManager, llmFunction);
// agentRuntime = new AgentRuntime({ ..., memoryManager });
```

See [@hazeljs/rag README](../rag/README.md) (Memory System / Using @hazeljs/memory as the backend) for full details.

## Scripts

- `prisma:generate` — Generate Prisma client
- `prisma:migrate` — Run migrations (dev)
- `prisma:deploy` — Deploy migrations (prod)
- `prisma:studio` — Open Prisma Studio (when using Prisma store)
- `test` — Run tests

## License

Apache 2.0 © [HazelJS](https://hazeljs.ai)

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.
