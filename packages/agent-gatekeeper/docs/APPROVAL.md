# Human approval

Gatekeeper uses an `ApprovalProvider` interface rather than a workflow engine. Integrate with existing HITL (`IApprovalStore`, `HumanTaskService`) instead of duplicating it.

## Request contents

- Approval ID, invocation ID, run ID
- Agent and tenant identity
- Tool name and sanitized argument summary
- Reason, matching policy IDs/versions
- Creation / expiration timestamps
- Risk classification
- Idempotency key
- Invocation fingerprint

## States

`pending` → `approved` | `rejected` | `expired` → `consumed`

No execution if an approval is missing, expired, rejected, mismatched, or already consumed.

## Fingerprints

Tokens are scoped to `agentId + toolName + tenantId + canonical input`. Changing sensitive arguments invalidates prior approval.

## Resume

```ts
await approvalProvider.resolve(approvalId, 'approved', 'operator-1');

await gatekeeper.execute({
  context: { ...context, approvalToken: approvalId },
  tool,
});
```

## Providers

- `InMemoryApprovalProvider` — tests and single-process only. Not visible to other replicas.
- `createRedisApprovalProvider(redis)` — **production default for horizontal scale**. Create, resolve, and consume work on any Node process sharing the same Redis.
- `createApprovalStoreProvider(store)` — `@hazeljs/agent` `IApprovalStore` (e.g. `RedisApprovalStore`). Persists the full Gatekeeper record in `metadata.gatekeeperRequest`.
- `createHumanTaskProvider(humanTasks)` — durable HITL `HumanTaskService` (file/SQL). Get/resolve are shared. Prefer Redis for atomic consume across replicas.

`simulate()` never creates a real approval request.
