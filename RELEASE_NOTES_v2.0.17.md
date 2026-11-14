# HazelJS v2.0.17 — Decorator DNA auto-load

**Date:** November 14, 2026  
**Tag:** `v2.0.17`

## Highlights

- **`@Agent({ dna: true | path })`** — opt-in DNA auto-load on `registerAgentInstance` (no store/platform sync required for that agent).
- **`applyAgentDna` / `loadDnaFile` / `resolveAgentDnaPath`** in `@hazeljs/agent` — apply prompt, description, model, and merge PolicyEngine rules **without** replacing `@Tool` handlers.
- **`bindGatekeeper`** merges DNA policies into the Gatekeeper bundle (agents already registered + later `onDnaApplied` events).
- **`AgentModule.forRoot({ projectRoot })`** / `AgentRuntimeConfig.projectRoot` resolve `dna/{name}.dna.json`.

## Added

### `@hazeljs/agent`

| API / option                                                                                            | Purpose                                                                                  |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `AgentConfig.dna`                                                                                       | `true` → `{projectRoot}/dna/{name}.dna.json`; string → absolute or project-relative path |
| `loadDnaFile` / `resolveAgentDnaPath` / `policyRulesFromDna` / `applyAgentDna` / `loadAndApplyAgentDna` | Framework DNA helpers (replaces app-level loaders)                                       |
| `AgentRuntime.getAgentDna` / `getAllAgentDna` / `onDnaApplied`                                          | Inspect applied DNA; Gatekeeper (and apps) can subscribe                                 |
| `projectRoot` on module + runtime config                                                                | Convention path resolution                                                               |

Decorator DNA merges PolicyEngine rules by id (keeps `defaultPiiMaskPolicies`) and does **not** register tool stubs.

### `@hazeljs/agent-gatekeeper`

- `bindGatekeeper(runtime, bundle)` now calls `mergeDnaPolicies` for DNA already on the runtime and for DNA applied later via `onDnaApplied`.

## Teaching apps (not published)

- **CampusAI** — full agent uses `@Agent({ dna: true })`.
- **Meridian Ops** — `safe-desk` uses decorator DNA; fleet agents keep store/platform overlay (both paths documented).

## Install

```bash
npm install @hazeljs/agent@2.0.17 @hazeljs/agent-gatekeeper@2.0.17
# or refresh the monorepo packages you use
npm install @hazeljs/core@2.0.17
```

## Breaking changes

None. Decorator DNA is **opt-in**; existing `@Agent` classes without `dna` behave as before. Overlay / store / platform paths are unchanged.

## Usage

```ts
@Agent({
  name: 'safe-desk',
  dna: true, // → {projectRoot}/dna/safe-desk.dna.json
  maxSteps: 4,
})
class SafeDeskAgent {
  @Tool({ name: 'lookupOrder', /* ... */ })
  async lookupOrder(input: { orderId: string }) { /* handlers stay in TS */ }
}

AgentModule.forRoot({
  projectRoot: process.cwd(),
  runtime: { /* ... */, projectRoot: process.cwd() },
});
```

## Publish checklist

1. Version bump to `2.0.17` (all `@hazeljs/*` via `npm run version:bump -- 2.0.17`)
2. Tag `v2.0.17` and push — triggers `.github/workflows/publish.yml`
3. GitHub Release with these notes
