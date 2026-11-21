# Capability map

| Capability                    | Status             | Evidence                                                          |
| ----------------------------- | ------------------ | ----------------------------------------------------------------- |
| Agent runtime + durable HITL  | implemented+tested | `HazeldServer`, `approve` / `runtime.execute`                     |
| File durable store (default)  | implemented+tested | hazeld `durableDir` → `createDurableRunStore`                     |
| Process crash recover         | implemented+tested | `tests/crash.test.ts` SIGKILL + `controlRequest recover`          |
| Gatekeeper approval integrity | implemented+tested | `tests/integrity.test.ts` governed executor                       |
| MCP Tasks                     | missing            | `@hazeljs/mcp` has client/server tools only                       |
| `@hazeljs/agent-vm`           | N/A for this suite | Optional effects/speculation — not needed for HITL crash evidence |

## Composition

```text
agent.ts (@Agent / @Tool) → HazeldServer projectRoot → AgentOS / AgentRuntime
                          → createDurableRunStore (file)
                          → HumanTaskService (HITL)
External: fake-orders HazelApp (@Controller) + file persistence
```

## Crash semantics

Process death (`SIGKILL`) of suite-spawned hazeld only. Fake orders + durable dir remain. Mid-flight without safe HITL checkpoint → `NODE_RECOVER_NO_CHECKPOINT` / Failed (Agent OS policy).
