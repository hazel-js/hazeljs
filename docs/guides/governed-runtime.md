# External runtime governance quickstart

Opt-in APIs in `@hazeljs/agent-gatekeeper` under `createGovernedRuntime`. Existing `AgentGatekeeper.evaluate` / `execute` and approval `consume` are unchanged.

## Boundary

```text
External harness request
  → trusted caller context (server-built)
  → advisory risk classification (Decision Plane)
  → Gatekeeper policy
  → HITL approval (fingerprint + optional argumentDigest)
  → tool attempt ledger (idempotency)
  → executor
```

## Capability manifest

Governed mode rejects adapters with `hostedComputerUse` or `hostedShell`, or without `toolMediation`, before `start`.

## Horizontal scale (what ships today)

- Approvals: existing Redis approval provider; governed wrapper takes a Redis lock (`RedisDistributedLock`) before consume.
- Tool attempts: `RedisToolAttemptLedger` for multi-instance; `MemoryToolAttemptLedger` for tests.
- Run lifecycle: **`MemoryGovernedRunStore`** (in-process). There is no governed SQL run store adapter yet (`createSqlDurableRunStore` in `@hazeljs/agent` is a separate Agent OS run API).
- Cancel is `requested` until the adapter acknowledges. Dropped streams stay `unknown`.

## OpenAI Agents

`createOpenAiAgentsRuntimeAdapter()` dynamically imports `@openai/agents`. Missing package or live flag → `ExternalRuntimeUnavailableError`. SDK `approve()` is not Hazel authorization.

Live tests: `HAZEL_OPENAI_AGENTS_LIVE=1` and `OPENAI_API_KEY`.
