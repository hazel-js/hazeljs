# HCEL - HazelJS Composable Expression Language

**HCEL** is a TypeScript-native composable expression language for AI operations with full type safety, structured errors, optional retries, result caching, and streaming when the chain ends in a **terminal prompt** operation.

## Quick start

```typescript
import { HazelAI, HCELError, HCELErrorCode } from '@hazeljs/ai';

const ai = HazelAI.create({
  defaultProvider: 'openai',
  model: 'gpt-4o',
});

// Sequential chain
const result = await ai.hazel.prompt('Analyze: {topic}').rag('knowledge-base').execute('climate');

// Streaming: only supported when the **last** operation is `prompt`.
// Earlier ops run to completion, then the final prompt streams token deltas.
for await (const chunk of ai.hazel.prompt('Summarize in bullets')) {
  console.log(chunk);
}

// Non-prompt terminal (e.g. `.rag()` last) → use `.execute()`; `.stream()` throws HCELError STREAMING_NOT_SUPPORTED.
```

## Execution contract

### Retries

When `chain.config.retryPolicy` is set, failed operations with `metadata.retriable === true` (e.g. `prompt`, `rag`, `ml` — not `agent`) are retried with exponential backoff, optional jitter, and `maxAttempts` / delay bounds. On exhaustion, `HCELError` with code `RETRY_EXHAUSTED` is thrown.

```typescript
await ai.hazel
  .prompt('Fragile call')
  .config({
    retryPolicy: {
      maxAttempts: 3,
      initialDelay: 100,
      maxDelay: 2000,
      backoffMultiplier: 2,
    },
  })
  .execute();
```

### Streaming

- **Supported**: last operation is a **prompt** (possibly after non-streaming prefix ops).
- **Not supported**: last op is `rag`, `agent`, `ml`, `parallel`, etc. → `HCELError` code `STREAMING_NOT_SUPPORTED`.

### Adaptive

`.adaptive()` does **not** reorder operations. It records intent on the engine result (`metadata.adaptiveRequested`, `adaptiveChoices`) for observability. Safe scheduling is reserved for future work.

### Result cache and persist (in-process)

- **Caching**: `chain.config.caching` with `enabled`, `ttl` (**seconds**), and optional `store` (`HCELResultCache`) uses a pluggable cache (default in-memory). Keys are derived from operation fingerprints and normalized input.
- **Persist / restore**: `.persist(key?)` stores the successful chain result under `persist:<key>`. `.restore(key)` short-circuits execution when that entry exists (short-TTL dedup / idempotent replay in one process). For durable workflows across restarts, use `asFlowNode()` with `@hazeljs/flow`.

### User memory (`@hazeljs/memory`)

HCEL is separate from the **result cache** above: you can attach a `MemoryService` from `@hazeljs/memory` (backed by `createMemoryStore({ type: 'in-memory' | 'postgres' | 'redis' | 'composite' })`, vector adapters, etc.) and use chain steps that read/write that store.

- **`.memory(memoryService)`** — required before `memoryRecall` / `memorySave` / `memorySearch`.
- **`.context({ userId, sessionId?, ... })`** — `userId` is required for these ops; `sessionId` is forwarded on `memorySave`.
- **`.memoryRecall({ category, limit?, header? })`** — loads items via `getByUserAndCategory` (supports one or many categories), formats them, and prepends to the string passed to the next step. For `prompt`, use an **empty template** (`''`) so that string becomes the user message (or set instructions via `systemPrompt`).
- **`.memorySave({ category, key, source?, confidence? })`** — persists the **previous** step’s string output as a memory item.
- **`.memorySearch({ category?, topK?, minScore?, header? })`** — calls `MemoryService.search`. Stores without `search` return no hits and the input string is unchanged.

```typescript
import { createMemoryStore, MemoryCategory, MemoryService } from '@hazeljs/memory';

const store = createMemoryStore({ type: 'in-memory' }); // or postgres / redis / composite
const memory = new MemoryService(store);
await memory.initialize();

await ai.hazel
  .memory(memory)
  .context({ userId: 'user-1', sessionId: 'session-1' })
  .memoryRecall({ category: MemoryCategory.EPISODIC, limit: 10 })
  // Empty `template` forwards the prior step’s string (memories + `execute()` input) to the model
  .prompt('', { systemPrompt: 'Answer using the memories above when relevant.' })
  .memorySave({ category: MemoryCategory.SEMANTIC_SUMMARY, key: 'last-reply' })
  .execute('What did we discuss?');
```

### Parallel strategy

```typescript
await ai.hazel
  .parallel(
    ai.hazel.prompt('A'),
    ai.hazel.prompt('B'),
    { strategy: 'all' } // or 'any' | 'race' — matches ParallelOperationConfig
  )
  .execute();
```

### Conditionals

- **`.conditional(condition, elseBuilder?)`**: wraps the **preceding** operation(s) branch semantics per builder implementation; prefer **`ifElse`** for explicit then/else.
- **`ifElse(condition, thenBuilder, elseBuilder)`**: builds a single `ConditionalOperation` whose branches are **`SequenceOperation`s** (ordered ops from each builder).

```typescript
const chain = ai.hazel.ifElse(
  (x: string) => x.length > 10,
  ai.hazel.prompt('long'),
  ai.hazel.prompt('short')
);
await chain.execute('hello world');
```

### Errors

`HCELError` includes `code` (`VALIDATION_FAILED`, `OPERATION_FAILED`, `STREAMING_NOT_SUPPORTED`, `RETRY_EXHAUSTED`), `chainId`, `operationId`, `operationType`, and `cause`.

```typescript
try {
  await ai.hazel.rag('kb').stream();
} catch (e) {
  if (e instanceof HCELError && e.code === HCELErrorCode.STREAMING_NOT_SUPPORTED) {
    // expected when last op is not prompt
  }
}
```

## Core operations

### Prompt

```typescript
await ai.hazel.prompt('What is HazelJS?').execute();
await ai.hazel
  .prompt('Analyze: {topic}')
  .model('gpt-4')
  .temperature(0.7)
  .system('You are an expert')
  .execute();
```

### RAG / agent / ML

Same fluent API as before; chain with `.execute(input)`. Use `.config({ retryPolicy })` where transient failures should retry (retriable ops only).

### Multi-agent orchestration (`@hazeljs/agent`)

Beyond a single `.agent(name)`, HCEL can run **compiled pipelines**, **supervisors**, and **custom graphs** (same runtime as `AgentService` / `AgentRuntime`).

- **`.agentPipeline({ pipelineId, agents, graphOptions? })`** — sequential pipeline (`AgentRuntime.pipeline`). Resolves to `GraphExecutionResult` (see `@hazeljs/agent`).
- **`.agentSupervisor({ name, workers, maxRounds?, ... })`** — `SupervisorAgent.run`. Forwards `context.userId` / `context.sessionId` into the run options. Requires an LLM provider on the agent runtime.
- **`.agentGraphCompiled(graphId, compiled, graphOptions?)`** — run a graph from `await ai.createAgentGraph(id).addNode(...).compile()`. `userId` / `sessionId` are merged into `graphOptions.initialData` when present.

Also available on **`HazelAI`**: `agentPipeline()`, `supervisor()`, `createAgentGraph()`, `runAgentGraph()`, and `pipeline()` (lazy handle whose `execute()` returns a `GraphExecutionResult`).

`@Delegate` on agent classes still applies when you execute that agent via `.agent(...)`; it is not a separate HCEL opcode.

TypeScript types for graphs and supervisors are exported from `@hazeljs/ai` as **`agent-orchestration.types`** (`SupervisorConfig`, `GraphExecutionResult`, `CompiledGraph`, etc.) so the AI package builds without requiring deep `@hazeljs/agent` type re-exports; at runtime they match the agent package.

## Configuration

```typescript
await ai.hazel
  .prompt('Process')
  .config({
    adaptive: true, // metadata only today
    retryPolicy: {
      maxAttempts: 3,
      initialDelay: 500,
      maxDelay: 8000,
      backoffMultiplier: 2,
    },
    caching: {
      enabled: true,
      ttl: 60, // seconds
      // store: custom HCELResultCache
    },
    observability: { trace: true, metrics: true, events: true },
  })
  .execute();
```

## Testing

See `__tests__/hcel.test.ts`, `hcel.basic.test.ts`, `hcel.production.test.ts`, `hcel.memory.test.ts`, and `hcel.agent-orchestration.test.ts` for retry (fake timers), streaming guard, `ifElse`, cache hit, persist/restore, memory, agent pipeline/supervisor/graph wiring, and `HCELError`.

## Debugging

```typescript
const chain = ai.hazel.prompt('Analyze').ml('sentiment');
console.log(chain.getSummary());
```

## Out of scope

Full serialization of arbitrary HCEL graphs for cross-process resume belongs in `@hazeljs/flow`, not HCEL’s in-memory cache.

---

HCEL is part of the HazelJS `@hazeljs/ai` package.
