# @hazeljs/memory

Pluggable user memory for HazelJS: profile, preferences, behavioral patterns, emotional state, episodic and semantic memory with multi-store support.

## Default: in-memory (no dependencies)

```ts
import { createDefaultMemoryStore, MemoryService } from '@hazeljs/memory';

const store = createDefaultMemoryStore();
const service = new MemoryService(store);
await service.initialize();
```

## PostgreSQL with Prisma (same pattern as @hazeljs/flow)

When you use Prisma in your app (e.g. like flow and flow-runtime), use the Prisma store:

```ts
import { createPrismaMemoryStore, getMemoryPrismaClient } from '@hazeljs/memory/prisma';
import { MemoryService } from '@hazeljs/memory';

const prisma = getMemoryPrismaClient(process.env.DATABASE_URL);
const store = createPrismaMemoryStore(prisma);
const service = new MemoryService(store);
await service.initialize();
```

**Build:** Run `pnpm prisma:generate` (or `prisma generate`) before `pnpm build` so the Prisma client is generated. Migrate with `pnpm prisma:migrate` from the package directory.

## Other stores

- **PostgresStore** (raw `pg` pool) — see `postgres.store.ts`; pass a pool with a `query` method.
- **RedisStore** — pass an ioredis-style client.
- **VectorEpisodicStore** — for episodic/semantic vector search.
- **CompositeMemoryStore** — route by category to primary + optional episodic store.

## Memory categories

Profile, preference, behavioral, emotional, episodic, semantic_summary. See types in `src/types/`.
