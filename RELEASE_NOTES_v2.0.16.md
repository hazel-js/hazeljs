# HazelJS v2.0.16 — Dependency maintenance & upgrade safety

**Date:** November 11, 2026  
**Tag:** `v2.0.16`

## Highlights

- **Safe dependency refresh** across the monorepo (patch/minor within declared ranges).
- **Zod 4** for AI / agent / gatekeeper / decision / eval / autonomous packages.
- **Vitest 3** for `@hazeljs/flow` and `@hazeljs/flow-runtime`.
- **OpenTelemetry stack aligned** in `@hazeljs/observability` (SDK 2.12 + OTLP exporter 0.223, API pinned to 1.9.1).
- **Upgrade-smoke integration suite** so Zod / OTEL / flow-runtime regressions are caught in CI.

## Fixed / upgraded

### Dependencies

| Area              | Change                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lockfile / ranges | Within-range updates including `axios`, `bullmq`, `ioredis`, `openai`, `stripe`, `graphql`, `@casl/ability`, `@grpc/*`, `prettier`, `typescript-eslint`, `ws`, `tsx`, `typeorm` |
| Zod               | `^3.25` → `^4.6.7` in `ai`, `agent`, `agent-gatekeeper`, `decision`, `eval`, `autonomous`                                                                                       |
| Vitest            | `^2.1.9` → `^3.2.7` (+ `@vitest/coverage-v8`) in `flow`, `flow-runtime`                                                                                                         |
| OpenTelemetry     | Exporter `^0.223.0`, resources/SDK `^2.12.1`; root pin `@opentelemetry/api@1.9.1` (SDK peer requires `<1.10`)                                                                   |

### Code fixes for Zod 4

- Replaced deprecated `zod-to-json-schema` with native `z.toJSONSchema(..., { target: 'openapi-3.0' })` in:
  - `@hazeljs/ai` tool registry / `generateObject` path
  - `@hazeljs/agent` tool registry
- Updated `z.ZodTypeAny` → `z.ZodType`
- Decision plane structured-schema typing updated for Zod 4 enum / strict object APIs

### Tests & CI confidence

- New `tests/integration/upgrade-smoke.integration.test.ts`:
  1. Zod 4 schema → OpenAPI JSON Schema via `@hazeljs/ai`
  2. Gatekeeper Zod input validation (allow + reject)
  3. Decision plane structured answers (valid + invalid)
  4. Unmocked OpenTelemetry provider start / span / stop
  5. `flow` → `flow-runtime` (`createFlowEngine` + `runUntilSettled`)
- Integration Jest / TypeScript 6 config hardened (`experimentalDecorators`, `moduleResolution: bundler`, `ignoreDeprecations: "6.0"`)

## Install

```bash
npm install @hazeljs/core@2.0.16
# or refresh the packages you use, e.g.
npm install @hazeljs/ai@2.0.16 @hazeljs/agent@2.0.16 @hazeljs/agent-gatekeeper@2.0.16 @hazeljs/decision@2.0.16
npm install @hazeljs/flow@2.0.16 @hazeljs/flow-runtime@2.0.16 @hazeljs/observability@2.0.16
```

## Breaking changes

- **Zod 3 → 4** for consumers that depend on Zod schemas from `@hazeljs/ai`, `@hazeljs/agent`, `@hazeljs/agent-gatekeeper`, or `@hazeljs/decision`. Upgrade your app’s `zod` to `^4.6.7` (or compatible 4.x). See https://zod.dev/v4/changelog
- **`zod-to-json-schema` removed** from `@hazeljs/ai` / `@hazeljs/agent` — use `z.toJSONSchema` from Zod 4 if you mirrored that path locally.
- Vitest 3 is a **devDependency** change for `flow` / `flow-runtime` only (no runtime API break for library consumers).

## Deferred (not in this release)

- TypeScript 7, ESLint 9, Jest 30
- OpenAI / Anthropic / Stripe / BullMQ / ioredis **major** bumps

## Publish checklist

1. Version bump to `2.0.16` (all `@hazeljs/*` via `npm run version:bump -- 2.0.16`)
2. `npm ci && npm run build && npm test && npm run test:integration`
3. Tag `v2.0.16` and push — triggers `.github/workflows/publish.yml`
4. GitHub Release with these notes
