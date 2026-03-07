# Flow examples

Examples for `@hazeljs/flow` and the flow-runtime service.

## In-memory (no database)

```bash
npm run flow:in-memory
```

Uses the flow engine with default in-memory storage. No `DATABASE_URL` required.

## With Prisma persistence

```bash
export DATABASE_URL="postgresql://..."
npm run flow:with-prisma
```

Requires Postgres and the flow schema (run migrations from `packages/flow`).

## Flow-runtime service + client

**1. Start the flow-runtime** (requires `DATABASE_URL`):

```bash
# From example directory
npm run flow:runtime

# Or from monorepo root
pnpm flow:runtime
```

**2. Run the client** (hits the runtime HTTP API):

```bash
npm run flow:runtime:client
```

Optionally set `FLOW_RUNTIME_URL` (default `http://localhost:3000`).

The client lists flows, starts a run, then calls `POST /v1/runs/:runId/tick` until the run completes.
