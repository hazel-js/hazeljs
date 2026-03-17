# @hazeljs/flow

[![npm version](https://img.shields.io/npm/v/@hazeljs/flow.svg)](https://www.npmjs.com/package/@hazeljs/flow)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/flow)](https://www.npmjs.com/package/@hazeljs/flow)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

Durable execution graph engine ("workflow OS kernel"). Fully independent of Hazel core.

**Storage:** By default the engine uses **in-memory storage** (no database). For durable persistence, install `@prisma/client` and use the Prisma storage adapter (see [Persistence](#persistence)).

## Features

- Flow definitions (nodes + edges)
- Flow runs with stateful execution
- **In-memory by default**; optional Postgres persistence via Prisma
- Audit event timeline
- Retry/backoff, timeouts
- Idempotency keys
- WAIT state + resume
- Optional Postgres advisory locks when using Prisma storage

## Installation

```bash
pnpm add @hazeljs/flow
```

No database or env vars are required for the default in-memory mode.

## Usage

### Decorator-based (recommended)

```typescript
import { FlowEngine, Flow, Entry, Node, Edge, buildFlowDefinition } from '@hazeljs/flow';
import type { FlowContext, NodeResult } from '@hazeljs/flow';

@Flow('my-flow', '1.0.0')
class MyFlow {
  @Entry()
  @Node('start')
  @Edge('end')
  async start(): Promise<NodeResult> {
    return { status: 'ok', output: 1 };
  }

  @Node('end')
  async end(ctx: FlowContext): Promise<NodeResult> {
    return { status: 'ok', output: ctx.outputs.start };
  }
}

const engine = new FlowEngine();
const def = buildFlowDefinition(MyFlow);
await engine.registerDefinition(def);

const { runId } = await engine.startRun({
  flowId: 'my-flow',
  version: '1.0.0',
  input: {},
});

let run = await engine.getRun(runId);
while (run?.status === 'RUNNING') {
  run = await engine.tick(runId);
}
```

### Functional builder (alternative)

```typescript
import { FlowEngine, flow } from '@hazeljs/flow';

const def = flow('my-flow', '1.0.0')
  .entry('start')
  .node('start', async (ctx) => ({ status: 'ok', output: 1 }))
  .node('end', async (ctx) => ({ status: 'ok', output: ctx.outputs.start }))
  .edge('start', 'end')
  .build();
```

## Persistence

By default the engine uses in-memory storage. To persist runs and definitions to Postgres:

1. Install Prisma client: `pnpm add @prisma/client`
2. Set `DATABASE_URL` and run migrations (from this package’s `prisma/` schema).
3. Create the engine with Prisma storage:

```typescript
import { FlowEngine, buildFlowDefinition } from '@hazeljs/flow';
import { createPrismaStorage, createFlowPrismaClient } from '@hazeljs/flow/prisma';

const prisma = createFlowPrismaClient();
const engine = new FlowEngine({ storage: createPrismaStorage(prisma) });
// ... register definitions, start runs, etc.
```

The migration SQL in `prisma/migrations/` is only needed when you use this adapter.

## Scripts

- `prisma:generate` - Generate Prisma client
- `prisma:migrate` - Run migrations (dev)
- `prisma:deploy` - Deploy migrations (prod)
- `prisma:studio` - Open Prisma Studio
- `test` - Run Vitest tests

## License

Apache 2.0 © [HazelJS](https://hazeljs.ai)
