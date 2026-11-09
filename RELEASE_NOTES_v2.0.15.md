# HazelJS v2.0.15 — Autonomous Application Runtime

**Date:** November 9, 2026  
**PR:** https://github.com/hazel-js/hazeljs/pull/40  
**Tag:** `v2.0.15` (publish after version bump)

## Highlights

- **New package `@hazeljs/autonomous`** — Autonomous Application Runtime (AAR) for ordinary `@Injectable()` services.
- **Core decorators** — `@Autonomous`, `@Observe`, `@Capability` (metadata-only in `@hazeljs/core`).
- **CLI** — `hazel add autonomous`; agent runs timeline / dry-run replay / diff helpers.
- **Default deny** — grants + Gatekeeper; HITL binds argument digests; dry-run / `simulate()` never live-execute.

```
Observation ≠ Decision ≠ Policy ≠ Authorization ≠ Execution
```

## Install

```bash
npm install @hazeljs/autonomous@2.0.15 @hazeljs/core@2.0.15 @hazeljs/agent-gatekeeper@2.0.15
# or
hazel add autonomous --setup
```

## Modes

| Mode | Behavior |
|------|----------|
| `disabled` | Off |
| `observe-only` | Record only |
| `suggest` | Recommendations only |
| `approval-required` | HITL before effects |
| `governed-auto` | Execute granted + Gatekeeper-allowed capabilities |

## Docs

- Package README: `packages/autonomous/README.md`
- Guides: `docs/guides/autonomous-*.md`
- Site (after landing deploy): https://hazeljs.ai/docs/packages/autonomous
- Blog: https://hazeljs.ai/blog/hazeljs-autonomous-runtime-2-0-15

## Example

```bash
npm run example:order-ops --workspace=@hazeljs/autonomous
```

## Breaking changes

None for existing Agent / Decision / Gatekeeper apps that do not import AAR.

## Publish checklist

1. Bump changed packages to `2.0.15` (at minimum: `autonomous`, `core`, `cli`; or full line via Lerna).
2. `npm run build` + package tests.
3. Tag `v2.0.15` and push — triggers `.github/workflows/publish.yml`.
4. Publish landing blog + docs for AAR.
5. Optional: Meridian Ops `/api/autonomous/*` teaching surface.
