# Agentic RAG Setup Guide

## Installation

### 1. Install Dependencies

```bash
# From the root of the monorepo
cd packages/rag
npm install
```

> `reflect-metadata` is pulled in transitively via `@hazeljs/core` and is loaded automatically by the framework — you do **not** need to install or import it yourself.

### 2. Enable Decorators in TypeScript

Ensure your `tsconfig.json` has the following settings:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"]
  }
}
```

### 3. reflect-metadata

The `@hazeljs/core` package automatically imports `reflect-metadata`, so you don't need to import it manually in your application code.

## Running Examples

### Basic Example

```bash
cd example
export OPENAI_API_KEY="your-api-key"
npx ts-node src/rag/agentic/agentic-rag-basic.example.ts
```

### Advanced Example

```bash
cd example
export OPENAI_API_KEY="your-api-key"
npx ts-node src/rag/agentic/agentic-rag-advanced.example.ts
```

### Agent Integration Example

```bash
cd example
export OPENAI_API_KEY="your-api-key"
npx ts-node src/rag/agentic/agentic-rag-agent-integration.example.ts
```

## Troubleshooting

### Error: Property 'defineMetadata' does not exist on type 'typeof Reflect'

**Solution**: `@hazeljs/core` imports `reflect-metadata` automatically. If you still see this error:

- Make sure you're using the latest version of `@hazeljs/core`
- Verify `reflect-metadata` is present in your `node_modules` (it should be installed transitively by `@hazeljs/core`); if not, `npm install` from the project root will pull it in.

### Error: Unable to resolve signature of method decorator

**Solution**: Enable experimental decorators in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### Error: Cannot find module '@hazeljs/rag'

**Solution**: Build the RAG package first:

```bash
cd packages/rag
npm run build
```

## Building the Package

```bash
cd packages/rag
npm install
npm run build
```

This will compile the TypeScript code and generate the `dist` folder with all the compiled JavaScript and type definitions.

## Usage in Your Project

```typescript
import {
  AgenticRAGService,
  QueryPlanner,
  SelfReflective,
  AdaptiveRetrieval,
  HyDE,
  MultiHop,
  CorrectiveRAG,
  ContextAware,
  QueryRewriter,
  SourceVerification,
  ActiveLearning,
  Cached,
} from '@hazeljs/rag';

// Your code here
```

## Next Steps

1. ✅ Install dependencies
2. ✅ Configure TypeScript
3. ✅ Set up environment variables
4. ✅ Run examples
5. ✅ Build your own agentic RAG application

For more information, see:

- [Agentic RAG Documentation](./src/agentic/AGENTIC_RAG.md)
- [Examples README](../example/src/rag/agentic/README.md)
