# Agent OS evolution — migration notes

Additive APIs only. Existing apps that do not call the new entry points keep today's paths.

## What stays unchanged

- `DecisionRuntime.decide`, `DecisionService`, `DecisionResult` (confidence remains a required number; failures still throw)
- `DecisionCache` keying and the opt-in `request.cache` flag
- `AgentGatekeeper.evaluate` / `execute`, policy precedence, `invocationFingerprint`
- `InMemoryApprovalProvider` and `createRedisApprovalProvider` `consume` implementations
- `BudgetTracker`, `policiesFromPolicyRules`, Skillgate classification
- `ToolExecutor` when `authorizationGate` is unset or set to today's gate
- `MemoryService` / `MemoryItem` and unscoped `get` / `update` / `delete` by id
- `createMemoryContributor` (`userId ?? tenantId`) as shipped
- `createSqlDurableRunStore` and worker-lease defaults (Agent OS runs — not the governed runtime store)
- Zynli Flows, work inbox, wholesale digests, store-plugin transport

## New opt-in entry points

| API                                              | Package                     | Persistence that ships                                                                            |
| ------------------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------- |
| `defineDecision` / `createDecisionPlane`         | `@hazeljs/decision`         | `MemoryDecisionCacheStore` / `RedisDecisionCacheStore`                                            |
| `createGovernedRuntime` / governed tool executor | `@hazeljs/agent-gatekeeper` | Redis lock + ledger; **in-memory** `MemoryGovernedRunStore` (no governed SQL adapter yet)         |
| `GovernedMemoryService` / `learnFromTurn`        | `@hazeljs/memory`           | `InMemoryGovernedMemoryStore` **or** `createPrismaGovernedMemoryStore` (`@hazeljs/memory/prisma`) |

## Database

Optional additive Prisma model + SQL under `packages/memory/prisma/` for `governed_memory_records`. Use `createPrismaGovernedMemoryStore` when you need durable governed memory. Existing `memory_items` rows are untouched. `MemoryService` startup does not query the new table.

## Approvals

Governed paths set optional `argumentDigest` and wrap consume with `withGovernedApproval` + `RedisDistributedLock` / `MemoryDistributedLock`. Existing HITL tokens that omit the digest keep fingerprint-only validation.

## Adoption order

1. Decision Plane for routing / risk labels (no write path change).
2. GovernedRuntime beside existing tool gates for destructive tools.
3. Governed memory via `learnFromTurn` for preferences that need correct/forget with CAS (in-memory or Prisma store).
4. Wire `createGovernedMemoryContributor` into `ContextService` instead of `createMemoryContributor` when actor scoping matters.
