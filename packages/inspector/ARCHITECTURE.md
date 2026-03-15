# HazelJS Inspector Architecture

## Overview

The inspector is a metadata explorer and runtime topology viewer for HazelJS. It uses a pluggable registry, package-specific plugins, and core framework utilities to collect and expose framework metadata.

## Registry Design

- **HazelInspectorRegistry** – Central registry for inspector plugins
- **HazelInspectorPlugin** – Interface: `name`, `supports(context)`, `inspect(context)`
- Plugins register via `registry.register(plugin)`
- `runAll(context)` invokes each plugin's `inspect()`, aggregates results, deduplicates by `id`

## Metadata Model

- **InspectorEntry** – Union of entry types (route, module, provider, cron, queue, websocket, decorator, etc.)
- **InspectorSnapshot** – `{ collectedAt, entries, summary }`
- **GroupedSnapshot** – Entries grouped by kind for UI consumption

## Supported Decorator Categories

| Package | Decorators | Metadata Keys |
|---------|------------|---------------|
| @hazeljs/core | @Controller, @Get/@Post/etc, @Injectable, @UseGuards, @UsePipes | hazel:controller, hazel:routes, hazel:inject |
| @hazeljs/cron | @Cron | Symbol('cron:jobs') |
| @hazeljs/queue | @Queue | Symbol('queue:processors') |
| @hazeljs/websocket | @Realtime, @Subscribe, @OnConnect | hazel:realtime, hazel:subscribe |

## Extension Points

1. **Custom plugins** – Implement `HazelInspectorPlugin` and register with the registry
2. **Core utilities** – Use `collectControllersFromModule`, `collectModulesFromModule`, `getModuleMetadata` from @hazeljs/core
3. **Optional packages** – Plugins use `try/require` for optional deps (cron, queue, websocket)

## Data Flow

```
HazelApp → addEarlyHandler('/__hazel', handler)
         → handler matches path (/, /inspect, /routes, ...)
         → HazelInspectorService.collectSnapshot(context)
         → HazelInspectorRegistry.runAll(context)
         → each plugin.inspect(context) → InspectorEntry[]
         → aggregate, cache, return JSON or serve UI
```

## Security

- Dev-only by default (`developmentOnly: true`)
- Sensitive metadata keys redacted (`hiddenMetadataKeys`)
- No secrets in responses
