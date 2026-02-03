# Agentic RAG Setup Guide

## Installation

### 1. Install Dependencies

The Agentic RAG decorators require `reflect-metadata` for decorator metadata support.

```bash
# From the root of the monorepo
cd packages/rag
npm install

# Or install reflect-metadata directly
npm install reflect-metadata@^0.2.1
```

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

**Solution**: This should not occur if you're using `@hazeljs/core` which automatically imports `reflect-metadata`. If you still see this error:
- Ensure `reflect-metadata` is installed: `npm install reflect-metadata`
- Make sure you're using the latest version of `@hazeljs/core`

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
