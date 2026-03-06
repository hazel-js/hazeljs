# @hazeljs/prompts

**Centralized, versioned prompt management for HazelJS AI, RAG, and Agent packages.**

Define typed prompt templates with named `{variable}` placeholders, store them in a global registry, and swap any prompt at startup — without touching the code that uses them.

[![npm version](https://img.shields.io/npm/v/@hazeljs/prompts.svg)](https://www.npmjs.com/package/@hazeljs/prompts)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/prompts)](https://www.npmjs.com/package/@hazeljs/prompts)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **Typed templates** — `PromptTemplate<{ var1, var2 }>` enforces the variable shape at compile time
- **Global registry** — `PromptRegistry.register()` at import time; `get()` anywhere, zero overhead
- **Override any prompt** — swap built-in `@hazeljs/agent` and `@hazeljs/rag` prompts at startup with `override()`
- **Versioning** — every template carries a `version`; retrieve a specific version with `get(key, version)`
- **5 storage backends** — Memory, File, Redis, Database (generic adapter), MultiStore (fan-out)
- **Hot-swap** — update prompts in Redis/DB and reload without restarting the process
- **Zero runtime dependencies** — the core package has no production dependencies

---

## Installation

```bash
npm install @hazeljs/prompts
```

Optional peer dependencies for store backends:

```bash
npm install ioredis          # RedisStore
npm install @prisma/client   # DatabaseStore with Prisma
```

---

## Quick Start

### 1. Define and register a template

```typescript
import { PromptTemplate, PromptRegistry } from '@hazeljs/prompts';

const answerPrompt = new PromptTemplate<{ context: string; question: string }>(
  `Answer the question using only the context below. Be concise.

Context: {context}

Question: {question}

Answer:`,
  { name: 'RAG Answer', version: '1.0.0' },
);

// Register under a namespaced key — safe to call at module load time
PromptRegistry.register('myapp:rag:answer', answerPrompt);
```

### 2. Render at runtime

```typescript
import { PromptRegistry } from '@hazeljs/prompts';

const tpl = PromptRegistry.get<{ context: string; question: string }>('myapp:rag:answer');

const prompt = tpl.render({
  context: 'HazelJS is a TypeScript-first framework for AI-native applications.',
  question: 'What is HazelJS?',
});

// Pass `prompt` to your LLM of choice
```

### 3. Override at startup

```typescript
import { PromptRegistry, PromptTemplate } from '@hazeljs/prompts';

// Runs before any agent or RAG pipeline is created
PromptRegistry.override(
  'myapp:rag:answer',
  new PromptTemplate<{ context: string; question: string }>(
    `You are a helpful assistant. Use the context to answer.\nContext: {context}\nQ: {question}\nA:`,
    { name: 'Custom Answer', version: '2.0.0' },
  ),
);
```

---

## PromptTemplate

`PromptTemplate<TVariables>` is the core primitive. It holds a template string and metadata, and exposes a single `.render()` method.

```typescript
import { PromptTemplate } from '@hazeljs/prompts';

// Typed — TypeScript enforces the variable shape
const tpl = new PromptTemplate<{ name: string; tier: string }>(
  'Hello {name}, you are on the {tier} plan.',
  { name: 'Welcome Message', version: '1.0.0' },
);

const text = tpl.render({ name: 'Alice', tier: 'pro' });
// "Hello Alice, you are on the pro plan."
```

**Placeholder rules:**
- Syntax: `{variableName}` (alphanumeric + underscore)
- Missing variable → placeholder left as-is (`{missing}` stays `{missing}`)
- Extra variables in `.render()` are silently ignored

### PromptMetadata

```typescript
interface PromptMetadata {
  name: string;          // Human-readable display name
  version?: string;      // Semver string — enables get(key, version)
  description?: string;  // Optional description
}
```

---

## PromptRegistry

A global static class — no instantiation needed. Prompts registered in one module are immediately available across the entire process.

### Key naming convention

Use a colon-separated `package:scope:action` scheme to avoid collisions:

```
rag:graph:entity-extraction
agent:supervisor:routing
myapp:checkout:upsell-prompt
```

### Sync API

```typescript
import { PromptRegistry } from '@hazeljs/prompts';

// Register (no-op if key already exists — safe for default prompts)
PromptRegistry.register('myapp:qa:answer', template);

// Override (always replaces — use at application startup)
PromptRegistry.override('myapp:qa:answer', customTemplate);

// Get latest version (throws if not registered)
const tpl = PromptRegistry.get('myapp:qa:answer');

// Get a specific version
const v1 = PromptRegistry.get('myapp:qa:answer', '1.0.0');

// Check existence
PromptRegistry.has('myapp:qa:answer');          // → boolean
PromptRegistry.has('myapp:qa:answer', '1.0.0'); // → boolean for version

// List all registered keys
PromptRegistry.list(); // → string[]

// List all cached versions for a key
PromptRegistry.versions('myapp:qa:answer'); // → ['1.0.0', '2.0.0']

// Remove a prompt (useful in tests)
PromptRegistry.unregister('myapp:qa:answer');
PromptRegistry.unregister('myapp:qa:answer', '1.0.0'); // specific version only

// Clear all (tests only)
PromptRegistry.clear();
```

### Async Store API

Use these when store backends are configured:

```typescript
// Load from store, falling back through configured stores in order
const tpl = await PromptRegistry.getAsync('myapp:qa:answer');
const tplV2 = await PromptRegistry.getAsync('myapp:qa:answer', '2.0.0');

// Persist a single prompt to all configured stores
await PromptRegistry.save('myapp:qa:answer');

// Persist all registered prompts
await PromptRegistry.saveAll();

// Load all prompts from the primary store into the cache
await PromptRegistry.loadAll();           // does not overwrite existing cache entries
await PromptRegistry.loadAll(true);       // overwrite = true
```

---

## Store Backends

### MemoryStore

In-memory only — useful for testing and explicit in-process prompt libraries:

```typescript
import { MemoryStore, PromptRegistry } from '@hazeljs/prompts';

PromptRegistry.configure([new MemoryStore()]);
```

### FileStore

Persists prompts to a JSON file on disk:

```typescript
import { FileStore, PromptRegistry } from '@hazeljs/prompts';

PromptRegistry.configure([new FileStore({ filePath: './prompts/library.json' })]);

await PromptRegistry.saveAll();  // write to disk
await PromptRegistry.loadAll();  // read from disk on startup
```

### RedisStore

Stores prompts in Redis — ideal for multi-instance deployments and hot-swap:

```typescript
import Redis from 'ioredis';
import { RedisStore, PromptRegistry } from '@hazeljs/prompts';

const redis = new Redis({ host: 'localhost', port: 6379 });

PromptRegistry.configure([
  new RedisStore({ client: redis, keyPrefix: 'hazel:prompts:' }),
]);

// Load on startup
await PromptRegistry.loadAll();

// Hot-swap: update a prompt and push it to Redis without restarting
PromptRegistry.override('myapp:qa:answer', updatedTemplate);
await PromptRegistry.save('myapp:qa:answer');
```

### DatabaseStore

Stores prompts in any relational database via a generic adapter:

```typescript
import { DatabaseStore, PromptRegistry } from '@hazeljs/prompts';
import type { DatabaseAdapter, PromptEntry } from '@hazeljs/prompts';

// Implement the adapter for your ORM (Prisma example)
class PrismaPromptAdapter implements DatabaseAdapter {
  constructor(private readonly prisma: PrismaClient) {}

  async get(key: string, version?: string): Promise<PromptEntry | undefined> {
    const row = await this.prisma.prompt.findFirst({ where: { key } });
    if (!row) return undefined;
    return { key: row.key, template: row.template, metadata: JSON.parse(row.metadata) };
  }

  async set(entry: PromptEntry): Promise<void> {
    await this.prisma.prompt.upsert({
      where: { key: entry.key },
      create: { key: entry.key, template: entry.template, metadata: JSON.stringify(entry.metadata) },
      update: { template: entry.template, metadata: JSON.stringify(entry.metadata) },
    });
  }

  async getAll(): Promise<PromptEntry[]> {
    const rows = await this.prisma.prompt.findMany();
    return rows.map(r => ({ key: r.key, template: r.template, metadata: JSON.parse(r.metadata) }));
  }
}

PromptRegistry.configure([
  new DatabaseStore({ adapter: new PrismaPromptAdapter(new PrismaClient()) }),
]);
```

### MultiStore

Fan-out store that writes to all backends simultaneously and reads from the first that has the key. Use for high-availability (Redis primary + file fallback):

```typescript
import { MultiStore, FileStore, RedisStore, PromptRegistry } from '@hazeljs/prompts';
import Redis from 'ioredis';

PromptRegistry.configure([
  new MultiStore([
    new RedisStore({ client: new Redis(process.env.REDIS_URL) }),
    new FileStore({ filePath: './prompts/fallback.json' }),
  ]),
]);

await PromptRegistry.saveAll(); // writes to both stores
```

### Configuring stores

```typescript
// Replace all stores at once
PromptRegistry.configure([storeA, storeB]);

// Append without replacing
PromptRegistry.addStore(storeC);

// Inspect configured stores
PromptRegistry.storeNames(); // → ['RedisStore', 'FileStore']
```

---

## Overriding Built-In Package Prompts

`@hazeljs/agent` and `@hazeljs/rag` register their internal prompts under predictable keys. Override them at application startup to tune behaviour without forking:

```typescript
import { PromptRegistry, PromptTemplate } from '@hazeljs/prompts';

// Tune the GraphRAG entity extraction prompt for a legal document corpus
PromptRegistry.override(
  'rag:graph:entity-extraction',
  new PromptTemplate<{ text: string }>(
    `Extract legal entities (parties, clauses, obligations, dates) from this text.
Return JSON: { entities: [...], relationships: [...] }

Text: {text}`,
    { name: 'Legal Entity Extraction', version: '1.0.0' },
  ),
);

// Customise the supervisor routing prompt used by SupervisorAgent
PromptRegistry.override(
  'agent:supervisor:routing',
  new PromptTemplate<{ task: string; workers: string }>(
    `You are a project manager. Decompose the task and assign each subtask to the best worker.
Workers: {workers}
Task: {task}
Respond with JSON: [{ "worker": "...", "subtask": "..." }]`,
    { name: 'Custom Supervisor', version: '2.0.0' },
  ),
);
```

---

## Use Cases

### Prompt A/B testing

Register two versions and switch between them without a deploy:

```typescript
PromptRegistry.register('myapp:qa:answer', promptV1);

// Later — override with new version and save to Redis
PromptRegistry.override('myapp:qa:answer', promptV2);
await PromptRegistry.save('myapp:qa:answer');
```

### Multi-tenant prompts

Load tenant-specific prompts from the database at request time:

```typescript
async function getPromptForTenant(tenantId: string, key: string) {
  const tenantKey = `tenant:${tenantId}:${key}`;
  if (PromptRegistry.has(tenantKey)) return PromptRegistry.get(tenantKey);
  return await PromptRegistry.getAsync(tenantKey); // falls back to DB store
}
```

### Exposing tools via MCP

Use registry-driven prompts inside `@Tool()` methods and expose them as MCP tools:

```typescript
import { PromptRegistry } from '@hazeljs/prompts';
import { Tool, ToolRegistry } from '@hazeljs/agent';
import { createMcpServer } from '@hazeljs/mcp';

class SupportAgent {
  @Tool({
    description: 'Triage a support issue and return urgency and category.',
    parameters: [
      { name: 'issue', type: 'string', description: 'Issue description', required: true },
    ],
  })
  async triage(input: { issue: string }) {
    const tpl = PromptRegistry.get<{ issue: string }>('support:ticket:triage');
    const prompt = tpl.render(input);
    return await callLLM(prompt);
  }
}

const registry = new ToolRegistry();
registry.registerAgentTools('support', new SupportAgent());
createMcpServer({ registry }).listenStdio();
```

---

## API Reference

### `PromptTemplate<TVariables>`

| Method / Property | Description |
|---|---|
| `new PromptTemplate(template, metadata)` | Create a new template |
| `.template` | Raw template string (read-only) |
| `.metadata` | `PromptMetadata` object (read-only) |
| `.render(variables: TVariables)` | Interpolate placeholders and return the rendered string |

### `PromptRegistry` (static)

| Method | Description |
|---|---|
| `register(key, template)` | Register if key not already set |
| `override(key, template)` | Always register (overwrites existing) |
| `get(key, version?)` | Sync get — throws if not found |
| `has(key, version?)` | Returns `boolean` |
| `list()` | Returns all registered keys |
| `versions(key)` | Returns all cached version strings for a key |
| `unregister(key, version?)` | Remove from cache |
| `clear()` | Remove all from cache |
| `configure(stores)` | Replace store list |
| `addStore(store)` | Append a store |
| `storeNames()` | Names of configured stores |
| `getAsync(key, version?)` | Async get — falls back to stores |
| `save(key, version?)` | Persist one prompt to all stores |
| `saveAll()` | Persist all prompts to all stores |
| `loadAll(overwrite?)` | Load all from primary store into cache |

### `PromptStore` interface

```typescript
interface PromptStore {
  name: string;
  get(key: string, version?: string): Promise<PromptEntry | undefined>;
  set(entry: PromptEntry): Promise<void>;
  getAll(): Promise<PromptEntry[]>;
}
```

---

## License

Apache 2.0

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

## Links

- [Documentation](https://hazeljs.com/docs/packages/prompts)
- [GitHub](https://github.com/hazeljs/hazeljs)
- [Issues](https://github.com/hazeljs/hazeljs/issues)
- [Discord](https://discord.com/channels/1448263814238965833/1448263814859456575)
