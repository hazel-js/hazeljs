# @hazeljs/inspector

Framework-aware runtime inspector for HazelJS. Explore metadata, routes, modules, providers, cron jobs, queues, WebSocket gateways, and more at runtime.

## Features

- **Metadata explorer** – Inspect what HazelJS has registered (routes, modules, providers, decorators)
- **Package-specific plugins** – Optional support for @hazeljs/cron, @hazeljs/queue, @hazeljs/websocket
- **DevTools UI** – Overview dashboard, search, filters, detail views, runtime stats
- **JSON API** – Consume inspector data programmatically
- **Agent OS timelines** – SSE live stream + JSON replay for agent execution steps
- **Agent Runs** – Durable `AgentRunRepository` list/detail/cancel + in-process metrics/cost strip

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

### Agent OS timeline (with `@hazeljs/agent`)

When agents are registered, Inspector exposes live debugging endpoints:

| Endpoint                             | Description                                                   |
| ------------------------------------ | ------------------------------------------------------------- |
| `GET /__hazel/agents/:name/stream`   | SSE stream of timeline steps while the agent runs             |
| `GET /__hazel/agents/:name/timeline` | JSON replay of recorded timeline steps                        |
| `POST /__hazel/agents/:name/run`     | Run the agent from the UI (optional input prompt)             |
| `GET /__hazel/runs`                  | List durable `AgentRun` records (`agentName`, `status` query) |
| `GET /__hazel/runs/:runId`           | Run detail + timeline steps for that execution                |
| `POST /__hazel/runs/:runId/cancel`   | Cancel in-flight + mark run cancelled                         |
| `GET /__hazel/agents/metrics`        | In-process metrics / cost summary                             |

In the Agents panel, use **Run** (executes + streams) or **Timeline** (loads history and opens the live SSE feed).  
Open **Agent Runs** for durable repository records and the cost/metrics strip.

```bash
# Replay last timeline
curl http://localhost:3000/__hazel/agents/support-agent/timeline

# Live SSE (EventSource-compatible)
curl -N http://localhost:3000/__hazel/agents/support-agent/stream
```

## Configuration

| Option                  | Default      | Description                                 |
| ----------------------- | ------------ | ------------------------------------------- |
| `enableInspector`       | `true`       | Enable the inspector                        |
| `inspectorBasePath`     | `'/__hazel'` | Base path for all inspector endpoints       |
| `exposeUi`              | `true`       | Serve the DevTools UI at the base path      |
| `exposeJson`            | `true`       | Expose JSON endpoints                       |
| `developmentOnly`       | `true`       | Disable in production (NODE_ENV=production) |
| `maxSnapshotCacheAgeMs` | `5000`       | Cache snapshot for 5 seconds                |

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
  inspect: async (ctx) => [{ id: 'custom:1', kind: 'route', packageName: '@my/package' /* ... */ }],
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
