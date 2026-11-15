# Governed learning memory quickstart

Opt-in `GovernedMemoryService` in `@hazeljs/memory`. `MemoryService` / `MemoryItem` are unchanged and never query `governed_memory_records`.

## Lifecycle

```text
capture → candidate → accept | quarantine | reject
accepted → retrieve → correct | forget | promote
```

### Full turn loop (`learnFromTurn`)

```text
extract hooks → ObservationExtractor → consolidate hooks
  → classify (DecisionPlane or built-in) → capture → auto-accept persist
```

```typescript
import {
  GovernedMemoryService,
  InMemoryGovernedMemoryStore,
  createGovernedMemoryContributor,
} from '@hazeljs/memory';

const memory = new GovernedMemoryService({
  store: new InMemoryGovernedMemoryStore(),
});

const auth = {
  tenantId: 'merchant-123',
  actorId: 'customer-42',
  allowedScopes: ['customer', 'org'],
};

const learned = await memory.learnFromTurn({
  auth,
  tenantId: auth.tenantId,
  subjectId: auth.actorId,
  userText: 'I prefer email for refund updates.',
  assistantText: 'Understood.',
  sessionId: 'sess-1',
});
// learned.accepted → high-trust user preferences/facts
// learned.reviewed → candidates awaiting accept
// learned.quarantined → never retrieved

const hits = await memory.retrieve({
  auth,
  subjectId: auth.actorId,
  text: 'email',
});
```

Wire into `@hazeljs/context`:

```typescript
const contributor = createGovernedMemoryContributor(memory, {
  resolveAuth: (req) => ({
    tenantId: req.tenantId,
    actorId: req.userId ?? 'anonymous',
    allowedScopes: ['customer', 'org'],
  }),
});
```

## Classification policy

When no `classifier` is injected, built-in rules mirror `@hazeljs/decision` `classifyMemoryCandidate`:

| Action       | Meaning                               |
| ------------ | ------------------------------------- |
| `persist`    | Auto-accept user preferences/facts    |
| `review`     | Keep as `candidate`                   |
| `quarantine` | Store as quarantined; never retrieved |
| `discard`    | Skip persistence                      |

Optional: inject a duck-typed `classifier` that wraps `classifyMemoryCandidate` from `@hazeljs/decision`.

## Tenant isolation

Authorization filters (`tenantId`, actor scopes, `accepted` status) apply **before** ranking. Cross-tenant retrieval returns empty.

## Hooks

Privacy-critical hooks fail closed when `failClosed: true` (default).

| Hook                  | When                                                 |
| --------------------- | ---------------------------------------------------- |
| `extract`             | Start of `learnFromTurn` (can reject the whole turn) |
| `consolidate`         | Per draft observation before classify                |
| `capture` / `persist` | Inside `capture()`                                   |
| `retrieve`            | Inside `retrieve()`                                  |

Retrieved text is data — it cannot grant roles or change policies.

## KAG promotion

Only `accepted` records may be passed to `KnowledgeGraph.promoteObservation({ validated: true, confidence })` via `toKagObservation()`.

## Deletion

`forget` tombstones content. Audit keeps ids/actions. **Backups are not instantly erased.**

## Stores

| Store                         | Import                                                         | Use                    |
| ----------------------------- | -------------------------------------------------------------- | ---------------------- |
| `InMemoryGovernedMemoryStore` | `@hazeljs/memory`                                              | Tests / single process |
| `PrismaGovernedMemoryStore`   | `@hazeljs/memory/prisma` via `createPrismaGovernedMemoryStore` | Durable Postgres       |

```typescript
import { createPrismaGovernedMemoryStore, getMemoryPrismaClient } from '@hazeljs/memory/prisma';
import { GovernedMemoryService } from '@hazeljs/memory';

const prisma = getMemoryPrismaClient(process.env.DATABASE_URL);
const store = createPrismaGovernedMemoryStore(prisma);
const memory = new GovernedMemoryService({ store });
```

Apply the additive migration under `packages/memory/prisma/migrations/` for `governed_memory_records`.
