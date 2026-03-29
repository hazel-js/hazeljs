# @hazeljs/worker

**CPU-intensive task offloading via Node.js worker threads.**

Offload CPU-heavy work (embeddings, OCR, data transforms, report generation) from the main event loop into a managed pool of worker threads. Framework-native integration with decorators, DI, and Inspector.

[![npm version](https://img.shields.io/npm/v/@hazeljs/worker.svg)](https://www.npmjs.com/package/@hazeljs/worker)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/worker)](https://www.npmjs.com/package/@hazeljs/worker)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **Worker pool** – Managed pool of Node.js worker threads (size based on CPU count)
- **@WorkerTask decorator** – Mark classes as task handlers with timeout and concurrency
- **WorkerExecutor** – Injectable service to execute tasks from controllers and services
- **Task discovery** – Auto-discover tasks from DI container or explicit `taskRegistry`
- **Graceful shutdown** – SIGTERM/SIGINT handlers, waits for in-flight tasks
- **Inspector integration** – Tasks visible at `/__hazel/workers` when Inspector is installed

## Installation

```bash
npm install @hazeljs/worker @hazeljs/core
```

## Quick Start

### 1. Define a Task

Create a class with `@WorkerTask` and a `run(payload)` method:

```typescript
import { WorkerTask } from '@hazeljs/worker';

@WorkerTask({
  name: 'generate-embeddings',
  timeout: 15000,
  maxConcurrency: 4,
})
export class GenerateEmbeddingsTask {
  async run(payload: { text: string[] }) {
    // CPU-intensive work runs in a worker thread
    return expensiveEmbeddingGeneration(payload.text);
  }
}
```

### 2. Configure the Module

Provide a **task registry** (task name → path to compiled handler) or **task directory**:

```typescript
import { HazelModule } from '@hazeljs/core';
import { WorkerModule } from '@hazeljs/worker';
import path from 'path';

@HazelModule({
  imports: [
    WorkerModule.forRoot({
      taskRegistry: {
        'generate-embeddings': path.join(__dirname, 'dist/tasks/generate-embeddings.task.js'),
      },
      poolSize: 4,
      timeout: 30000,
    }),
  ],
  providers: [GenerateEmbeddingsTask],
})
export class AppModule {}
```

### 3. Execute Tasks

Inject `WorkerExecutor` and run tasks:

```typescript
import { Controller, Get } from '@hazeljs/core';
import { WorkerExecutor } from '@hazeljs/worker';

@Controller('/api')
export class EmbeddingsController {
  constructor(private readonly workerExecutor: WorkerExecutor) {}

  @Get('/embed')
  async embed() {
    const { result, durationMs } = await this.workerExecutor.execute(
      'generate-embeddings',
      { text: ['hello world'] }
    );
    return { embeddings: result, durationMs };
  }
}
```

## Task Path Resolution

Worker threads run in a separate V8 isolate. The worker must **load** your task code via `require(path)`. You provide paths in one of two ways:

### Option A: Explicit taskRegistry

```typescript
WorkerModule.forRoot({
  taskRegistry: {
    'generate-embeddings': path.join(__dirname, 'dist/tasks/generate-embeddings.task.js'),
    'parse-document': path.join(__dirname, 'dist/tasks/parse-document.task.js'),
  },
})
```

### Option B: Convention (taskDirectory)

```typescript
WorkerModule.forRoot({
  taskDirectory: path.join(__dirname, 'dist/worker-tasks'),
  taskFileExtension: '.js',  // optional; default '.js'. Use '.task.js' for generate-embeddings.task.js
  // Task name 'generate-embeddings' → dist/worker-tasks/generate-embeddings.js
})
```

Paths are resolved as `taskDirectory + taskName + taskFileExtension`. Add your `@WorkerTask` classes as **providers** so discovery can find them. Discovery merges with `taskRegistry` or builds paths from `taskDirectory` + discovered names.

## Module Options

```typescript
interface WorkerModuleOptions {
  poolSize?: number;                    // Default: os.cpus().length - 1
  taskRegistry?: Record<string, string>;
  taskDirectory?: string;
  taskFileExtension?: string;           // Default: '.js' (e.g. '.task.js' for name.task.js)
  timeout?: number;                     // Default: 30000
  isGlobal?: boolean;                   // Default: true
  gracefulShutdownTimeout?: number;    // Default: 10000
}
```

## API Reference

### @WorkerTask Decorator

```typescript
@WorkerTask({
  name: string;           // Unique task identifier
  timeout?: number;       // Per-task timeout (ms)
  maxConcurrency?: number; // Per-task concurrency limit
})
export class MyTask {
  async run(payload: TInput): Promise<TOutput> {
    // ...
  }
}
```

### WorkerExecutor

```typescript
// Execute a task
const { result, durationMs } = await workerExecutor.execute<T>(
  'task-name',
  payload,
  { timeout?: number }
);

// Check if task exists
workerExecutor.hasTask('task-name');

// List registered tasks
workerExecutor.getTaskNames();
```

### Errors

- `WorkerTaskNotFoundError` — Task not in registry
- `WorkerTaskTimeoutError` — Task exceeded timeout
- `WorkerPoolExhaustedError` — No available worker in pool
- `WorkerExecutionFailedError` — Task threw in worker
- `WorkerSerializationError` — Payload serialization failed

## Use Cases

This package is for **CPU-bound work**, not HTTP scaling or clustering:

- Embeddings and ML preprocessing
- Data transforms and file/document processing
- OCR, parsing, media processing
- Report generation
- Other workloads that would block the Node.js event loop

## Best Practices

1. **Use for CPU work only** — I/O-bound work belongs on the main thread
2. **Keep payloads small** — Data is serialized between threads
3. **Provide taskRegistry** — Explicit paths avoid resolution issues
4. **Compile to JS** — Point to `dist/` output, not `.ts` source
5. **Handle errors** — Wrap `execute()` in try/catch

## Testing

```bash
npm test
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

Apache 2.0 © [HazelJS](https://hazeljs.ai)

## Links

- [Documentation](https://hazeljs.ai/docs/packages/worker)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Issues](https://github.com/hazel-js/hazeljs/issues)
- [Discord](https://discord.gg/xe495BvE)
