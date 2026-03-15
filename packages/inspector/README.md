# @hazeljs/inspector

Framework-aware runtime inspector for HazelJS. Explore metadata, routes, modules, providers, cron jobs, queues, WebSocket gateways, and more at runtime.

## Features

- **Metadata explorer** – Inspect what HazelJS has registered (routes, modules, providers, decorators)
- **Package-specific plugins** – Optional support for @hazeljs/cron, @hazeljs/queue, @hazeljs/websocket
- **DevTools UI** – Overview dashboard, search, filters, detail views, runtime stats
- **JSON API** – Consume inspector data programmatically

## Installation

```bash
npm install @hazeljs/inspector @hazeljs/core
```

## Quick Start

Add `InspectorModule.forRoot()` to your app:

```typescript
import { HazelModule } from '@hazeljs/core';
import { InspectorModule } from '@hazeljs/inspector';

@HazelModule({
  imports: [
    InspectorModule.forRoot({
      inspectorBasePath: '/__hazel',
      developmentOnly: true,
      exposeUi: true,
    }),
    // ... other modules
  ],
})
export class AppModule {}
```

Then run your app and open:

- **`http://localhost:3000/__hazel`** – DevTools UI
- **`http://localhost:3000/__hazel/inspect`** – Full snapshot (JSON)
- **`http://localhost:3000/__hazel/routes`** – Routes only
- **`http://localhost:3000/__hazel/modules`** – Modules only
- **`http://localhost:3000/__hazel/providers`** – Providers only
- **`http://localhost:3000/__hazel/jobs`** – Cron jobs (if @hazeljs/cron is installed)
- **`http://localhost:3000/__hazel/queues`** – Queue processors (if @hazeljs/queue is installed)
- **`http://localhost:3000/__hazel/websocket`** – WebSocket gateways (if @hazeljs/websocket is installed)
- **`http://localhost:3000/__hazel/stats`** – Runtime stats (memory, uptime)

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `enableInspector` | `true` | Enable the inspector |
| `inspectorBasePath` | `'/__hazel'` | Base path for all inspector endpoints |
| `exposeUi` | `true` | Serve the DevTools UI at the base path |
| `exposeJson` | `true` | Expose JSON endpoints |
| `developmentOnly` | `true` | Disable in production (NODE_ENV=production) |
| `maxSnapshotCacheAgeMs` | `5000` | Cache snapshot for 5 seconds |

## Security

- **Dev-only by default** – When `developmentOnly: true` and `NODE_ENV=production`, the inspector is disabled
- **Sensitive data** – Metadata is redacted for known keys (`password`, `secret`, `token`, etc.)
- **Explicit opt-in** – Set `developmentOnly: false` and `enableInspector: true` to use in production (not recommended)

## Custom Plugins

Register your own inspector plugin:

```typescript
import { HazelInspectorRegistry, type HazelInspectorPlugin } from '@hazeljs/inspector';

const myPlugin: HazelInspectorPlugin = {
  name: 'my-plugin',
  supports: (ctx) => true,
  inspect: async (ctx) => [
    { id: 'custom:1', kind: 'route', packageName: '@my/package', /* ... */ },
  ],
};

// Register during bootstrap (e.g. in a provider that runs early)
registry.register(myPlugin);
```

## Architecture

- **Registry** – Pluggable inspector plugins
- **Core plugin** – Routes, modules, providers, decorators (uses `collectControllersFromModule`, `collectModulesFromModule` from @hazeljs/core)
- **Optional plugins** – Cron, queue, websocket (loaded when packages are installed)
- **Service** – Aggregates results, caches snapshot
- **Transport** – HTTP handler for `/__hazel/*`

## License

Apache-2.0
