# Provider capability matrix

Verified against the Agent OS evolution code currently in tree.

## Decision Plane

| Provider                              | Status      | Notes                                               |
| ------------------------------------- | ----------- | --------------------------------------------------- |
| rules                                 | available   | Deterministic first-match                           |
| structured                            | available   | Injected `StructuredObjectGenerator`                |
| jev (plane)                           | inject_only | Unconfigured → `unavailable` / `jev_not_configured` |
| createJevDecisionProvider (legacy)    | inject_only | Still **throws** when unconfigured                  |
| openai-decisions                      | unavailable | No public OpenAI schema/SDK; stub only              |
| createOpenAiDecisionProvider (legacy) | available   | Injected generateObject adapter — not Decisions API |

## External runtimes

| Adapter             | toolMediation  | cancel ack             | approval continuation  | hosted computer use       | Status                                                              |
| ------------------- | -------------- | ---------------------- | ---------------------- | ------------------------- | ------------------------------------------------------------------- |
| LocalRuntimeAdapter | yes            | yes                    | yes                    | no                        | available                                                           |
| OpenAiAgentsRuntime | yes (required) | documented AbortSignal | RunState interruptions | rejected in governed mode | unavailable without `@openai/agents` + `HAZEL_OPENAI_AGENTS_LIVE=1` |

## Memory

| Store                                  | Multi-instance | Notes                                                         |
| -------------------------------------- | -------------- | ------------------------------------------------------------- |
| InMemoryGovernedMemoryStore            | no             | Ships with `GovernedMemoryService` (tests + single process)   |
| Prisma `governed_memory_records` table | n/a            | Additive schema/migration only — **no store adapter shipped** |
