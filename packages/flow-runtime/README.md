# @hazeljs/flow-runtime

[![npm version](https://img.shields.io/npm/v/@hazeljs/flow-runtime.svg)](https://www.npmjs.com/package/@hazeljs/flow-runtime)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/flow-runtime)](https://www.npmjs.com/package/@hazeljs/flow-runtime)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

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

## License

Apache 2.0 © [HazelJS](https://hazeljs.com)
