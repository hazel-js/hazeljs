# @hazeljs/flow-runtime

[![npm version](https://img.shields.io/npm/v/@hazeljs/flow-runtime.svg)](https://www.npmjs.com/package/@hazeljs/flow-runtime)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/flow-runtime)](https://www.npmjs.com/package/@hazeljs/flow-runtime)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

Standalone HTTP service for [@hazeljs/flow](https://www.npmjs.com/package/@hazeljs/flow) workflows. Expose flows via REST so other systems can start runs, tick, resume waiting runs, and read status and timeline—or invoke the runtime from your app with `runFlowRuntime({ flows, port, databaseUrl?, services })` so you don't reimplement the server.

## Features

- **REST API** — Start runs, tick, resume, get run status and timeline, list flows, health check
- **In-memory by default** — No database required; set `DATABASE_URL` (or pass `databaseUrl`) only when you want durable persistence
- **Fallback to in-memory** — If `DATABASE_URL` is missing or the connection fails, the runtime uses in-memory storage and logs a message
- **Recovery** — On startup, picks up any `RUNNING` runs (when using Prisma storage) and ticks them so they continue after a restart
- **Programmatic API** — Call `runFlowRuntime({ port, databaseUrl?, flows, services? })` from your app to register your own flows and optional services (logger, slack, etc.) while the package owns the HTTP server

## Requirements

- **Node.js** — 20+
- **@hazeljs/flow** — Required peer; install with `pnpm add @hazeljs/flow`
- **PORT** — Optional; default `3000`
- **DATABASE_URL** — Optional; if set and connection succeeds, uses Prisma storage for durability and recovery. If unset or connection fails, uses in-memory storage.

## Installation

```bash
pnpm add @hazeljs/flow-runtime @hazeljs/flow
```

## Run as a standalone process

```bash
# From monorepo root
pnpm flow:runtime

# Or from this package
pnpm dev    # watch mode
pnpm start  # after build: node dist/main.js
```

Uses default demo flows. With no `DATABASE_URL`, runs in-memory. Set `DATABASE_URL` for Postgres persistence and recovery.

## Run from your app (programmatic)

Register your own flows and optional services; the package runs the HTTP server and recovery:

```typescript
import { runFlowRuntime } from '@hazeljs/flow-runtime';
import { buildFlowDefinition } from '@hazeljs/flow';
import { OrderFlow } from './flows/OrderFlow';

await runFlowRuntime({
  port: 3000,
  databaseUrl: process.env.DATABASE_URL,  // optional; in-memory if omitted or connection fails
  flows: [buildFlowDefinition(OrderFlow)],
  services: { logger: myLogger, slack: slackClient },  // optional; injected into flow context
});
```

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/runs/start` | Start a flow run (body: `flowId`, `version`, `input`) |
| `POST` | `/v1/runs/:runId/tick` | Advance a running run one step |
| `POST` | `/v1/runs/:runId/resume` | Resume a waiting run (body: payload for the wait) |
| `GET` | `/v1/runs/:runId` | Get run status |
| `GET` | `/v1/runs/:runId/timeline` | Get run event timeline |
| `GET` | `/v1/flows` | List registered flows |
| `GET` | `/health` | Health check |

## Example

See [hazeljs-flow-example](https://github.com/hazel-js/hazeljs-flow-example) for a full app that registers order, approval, and fraud-detection flows and starts the runtime with `runFlowRuntime(...)`.

## License

Apache 2.0 © [HazelJS](https://hazeljs.com)
