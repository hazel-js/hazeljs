# HazelJS v2.0.18 — Governed Learning Memory

**Date:** November 15, 2026  
**Tag:** `v2.0.18`

## Highlights

- **`GovernedMemoryService.learnFromTurn`** — full turn loop: extract → classify → capture → auto-accept high-trust user preferences/facts.
- **`RuleBasedObservationExtractor`** — deterministic, pluggable extractor (no LLM required); swap via `ObservationExtractor`.
- **`PrismaGovernedMemoryStore` / `createPrismaGovernedMemoryStore`** — durable store for `governed_memory_records` (ships via `@hazeljs/memory/prisma`).
- **Classification** — built-in rules mirror `@hazeljs/decision` `classifyMemoryCandidate`; optional duck-typed `classifier` for Decision Plane.
- **Hooks wired** — previously declared `extract` / `consolidate` hooks now run during `learnFromTurn`.
- Completes the 2.0.14 governance roadmap item (Prisma governed memory + learning loop).

This is **application-level learning** (governed durable prefs/facts) — not foundation-model fine-tuning.

## Added

### `@hazeljs/memory`

| API / type | Purpose |
| ---------- | ------- |
| `learnFromTurn(input)` | Extract observations from a conversation turn and persist under governance |
| `RuleBasedObservationExtractor` / `ObservationExtractor` | Default heuristic extractor; pluggable port |
| `defaultClassifyMemoryCandidate` | Built-in persist / review / quarantine / discard |
| `PrismaGovernedMemoryStore` / `createPrismaGovernedMemoryStore` | Postgres-backed governed store |
| `LearnFromTurnInput` / `LearnFromTurnResult` / `TurnObservation` | Turn-level types |
| `MemoryCandidateClassifier` | Optional classifier injection (e.g. Decision Plane) |
| `MemoryHookTurn` on hook context | Turn payload for extract/consolidate hooks |

### Classification policy

| Action | Meaning |
| ------ | ------- |
| `persist` | Auto-accept high-trust **user** preferences/facts |
| `review` | Keep as `candidate` |
| `quarantine` | Store but never retrieve into prompts |
| `discard` | Skip persistence |

### Context integration

Use `createGovernedMemoryContributor` with `@hazeljs/context` so only **accepted** rows enter the assembled prompt. Never substitutes `tenantId` for `userId`.

## Install

```bash
npm install @hazeljs/memory@2.0.18
# optional peers for the full loop:
npm install @hazeljs/context@2.0.18 @hazeljs/decision@2.0.18
```

## Usage

```ts
import {
  GovernedMemoryService,
  InMemoryGovernedMemoryStore,
  createGovernedMemoryContributor,
} from '@hazeljs/memory';
import { ContextService } from '@hazeljs/context';

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
// learned.accepted → high-trust prefs; quarantined never retrieved

const contributor = createGovernedMemoryContributor(memory, {
  resolveAuth: (req) => ({
    tenantId: req.tenantId,
    actorId: req.userId ?? 'anonymous',
    allowedScopes: ['customer', 'org'],
  }),
});

const context = new ContextService({
  strategy: 'auto',
  sources: ['memory'],
  contributors: [contributor],
});
```

Durable Postgres:

```ts
import {
  createPrismaGovernedMemoryStore,
  getMemoryPrismaClient,
} from '@hazeljs/memory/prisma';

const prisma = getMemoryPrismaClient(process.env.DATABASE_URL);
const store = createPrismaGovernedMemoryStore(prisma);
const memory = new GovernedMemoryService({ store });
```

## Docs & blog

- Package guide: https://hazeljs.ai/docs/packages/memory#governed-learning-memory-opt-in
- Context contributor: https://hazeljs.ai/docs/packages/context#governed-memory-contributor
- Blog: https://hazeljs.ai/blog/governed-learning-memory-learn-from-turn
- Repo guide: `docs/guides/governed-memory.md`
- Offline lab: [governed-memory-agent](https://github.com/hazel-js/hazeljs-meridian-ops/tree/main/examples/governed-memory-agent)

## Breaking changes

None. Governed learning remains **opt-in**. `MemoryService` / `memory_items` are unchanged and never query `governed_memory_records`.

## Out of scope (this release)

- Online fine-tuning / weight updates
- Automatic behavioural pattern mining beyond preference/fact heuristics
- Merging memory `review` into Gatekeeper HITL UI

## Publish checklist

1. Version bump to `2.0.18` (all `@hazeljs/*` via `npm run version:bump -- 2.0.18`)
2. Tag `v2.0.18` and push — triggers `.github/workflows/publish.yml`
3. GitHub Release with these notes
