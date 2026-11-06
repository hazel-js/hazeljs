# Governed learning memory quickstart

Opt-in `GovernedMemoryService` in `@hazeljs/memory`. `MemoryService` / `MemoryItem` are unchanged and never query `governed_memory_records`.

## Lifecycle

```text
capture → candidate → accept | quarantine | reject
accepted → retrieve → correct | forget | promote
```

## Tenant isolation

Authorization filters (`tenantId`, actor scopes, `accepted` status) apply **before** ranking. Cross-tenant retrieval returns empty.

## Hooks

Privacy-critical hooks fail closed when `failClosed: true` (default). Retrieved text is data — it cannot grant roles or change policies.

## KAG promotion

Only `accepted` records may be passed to `KnowledgeGraph.promoteObservation({ validated: true, confidence })` via `toKagObservation()`.

## Deletion

`forget` tombstones content. Audit keeps ids/actions. **Backups are not instantly erased.**

## Store (what ships today)

Runtime store is **`InMemoryGovernedMemoryStore`** (single process / tests).

An additive SQL migration and Prisma model for `governed_memory_records` exist under `packages/memory/prisma/` for apps that want to persist the same shape. **No Prisma / Postgres store adapter is shipped yet** — do not treat multi-instance Postgres as a built-in memory backend.
