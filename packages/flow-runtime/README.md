# @hazeljs/flow-runtime

Standalone deployable flow runtime service. Uses Fastify and @hazeljs/flow.

## Requirements

- `DATABASE_URL` - Postgres connection string
- `PORT` - Optional, default 3000

## Run

```bash
# From monorepo root
pnpm flow:runtime

# Or from this package
pnpm dev
```

## API

- `POST /v1/runs/start` - Start a flow run
- `POST /v1/runs/:runId/resume` - Resume a waiting run
- `GET /v1/runs/:runId` - Get run status
- `GET /v1/runs/:runId/timeline` - Get run event timeline
- `GET /v1/flows` - List registered flows
- `GET /health` - Health check
