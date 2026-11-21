# Agent Runtime Conformance

A **HazelJS hazeld project** plus Jest — `@Agent` / `@Tool` in `agent.ts`, same load path as `hazel apply`.

## Layout

```text
agent.ts             @Agent + @Tool (loaded by hazeld projectRoot)
app/                 hazeld factory + spawnable main + scripted LLM
fake-orders/         External refund API — HazelJS core @Controller app
tests/               Jest — baseline in-process; crash via SIGKILL of app/main.ts
```

## What is HazelJS vs not

| Piece         | Implementation                                                                              |
| ------------- | ------------------------------------------------------------------------------------------- |
| Agent         | `agent.ts` — `@Agent` + `@Tool({ requiresApproval: true })`                                 |
| Worker        | `HazeldServer` with `projectRoot` → `loadProjectAgent`                                      |
| Control       | `@hazeljs/agent` `controlRequest` for crash process tests                                   |
| Durable store | Agent OS file store via hazeld `durableDir`                                                 |
| Fake orders   | `@hazeljs/core` `HazelApp` + `@Controller` / `@Service` (external to Agent OS; file-backed) |

No `skillHandlers` map, custom worker HTTP, or scenario harness.

## Commands

```bash
cd hazeljs
npm run build --workspace=@hazeljs/agent --workspace=@hazeljs/agent-gatekeeper
cd benchmarks/agent-runtime && npm install

npm run test:smoke    # baseline + integrity + 10-step smoke bench
npm run test:crash    # SIGKILL hazeld (POSIX)
npm run test:bench    # 10/100/1000 durable steps + concurrent + 25 refund cycles
npm run test:full     # conformance + load benches → results/latest.{json,md}
```

After a run, open the narrative report:

```bash
cat results/latest.md
```

## Claim

Under this fake order idempotency/reconciliation contract, the refund workflow recovered from the tested worker crash without a second refund — when the crash tests pass. Not a universal exactly-once guarantee.

See [capability-map.md](./capability-map.md).
