# @hazeljs/flow

[![npm version](https://img.shields.io/npm/v/@hazeljs/flow.svg)](https://www.npmjs.com/package/@hazeljs/flow)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/flow)](https://www.npmjs.com/package/@hazeljs/flow)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

Durable execution graph engine ("workflow OS kernel") with Prisma persistence. Fully independent of Hazel core.

## Features

- Flow definitions (nodes + edges)
- Flow runs with stateful execution
- Postgres persistence via Prisma
- Audit event timeline
- Retry/backoff, timeouts
- Idempotency keys
- WAIT state + resume
- Postgres advisory locks for concurrency safety

## Installation

```bash
pnpm add @hazeljs/flow
```

## Setup

1. Set `DATABASE_URL` in your environment
2. Run migrations:

```bash
pnpm prisma:migrate   # dev
# or
pnpm prisma:deploy    # production
```

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

## Scripts

- `prisma:generate` - Generate Prisma client
- `prisma:migrate` - Run migrations (dev)
- `prisma:deploy` - Deploy migrations (prod)
- `prisma:studio` - Open Prisma Studio
- `test` - Run Vitest tests

## License

Apache 2.0 © [HazelJS](https://hazeljs.com)
