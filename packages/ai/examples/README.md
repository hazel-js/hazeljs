# HazelJS Unified AI Platform Examples

This directory contains examples demonstrating the HazelJS Unified AI Platform.

## Running the Examples

Since this is a TypeScript package, you need to compile the examples first:

```bash
# From the packages/ai directory
npm run build

# Compile specific examples
npx tsc examples/simple-demo.ts --outDir dist --target es2020 --module commonjs --esModuleInterop true
npx tsc examples/unified-platform-example.ts --outDir dist --target es2020 --module commonjs --esModuleInterop true
```

Then run the compiled JavaScript:

```bash
# Simple demo (works without API keys)
node dist/examples/simple-demo.js

# Full demo (requires API keys)
node dist/examples/unified-platform-example.js
```

## Examples

### 1. Simple Demo (`simple-demo.ts`)

A basic demonstration that works without requiring API keys:
- Shows platform initialization
- Demonstrates workflow functionality
- Shows assistant creation
- Lists all available methods

**Run:**
```bash
node dist/examples/simple-demo.js
```

### 2. Unified Platform Demo (`unified-platform-example.ts`)

A comprehensive demo showing all features:
- Chat and streaming
- Classification and sentiment analysis
- Scoring
- Workflow execution
- Assistant with memory
- Metrics tracking

**Requirements:**
- Set `OPENAI_API_KEY` environment variable for OpenAI
- Or set `ANTHROPIC_API_KEY` for Claude
- Or install and run Ollama for local models

**Run:**
```bash
export OPENAI_API_KEY=your-key-here
node dist/examples/unified-platform-example.js
```

## Configuration

The examples use environment variables for configuration:

```bash
# OpenAI
export OPENAI_API_KEY=your-openai-key

# Anthropic Claude
export ANTHROPIC_API_KEY=your-anthropic-key

# Google Gemini
export GOOGLE_API_KEY=your-gemini-key

# Ollama (local models)
# No API key needed, just install and run Ollama
```

## Features Demonstrated

### Core AI Operations
- **Chat**: Simple conversation with AI
- **Stream**: Real-time streaming responses
- **Classification**: Categorize text into labels
- **Sentiment**: Analyze text sentiment (positive/negative/neutral)
- **Scoring**: Rate items against criteria

### Advanced Features
- **Workflow**: Chain multiple steps together
- **Assistant**: Memory-enabled conversations
- **RAG**: Document Q&A (requires @hazeljs/rag)
- **Agent**: Execute specialized agents (requires @hazeljs/agent)

### Platform Features
- **Metrics**: Track usage and performance
- **Multi-provider**: Switch between AI providers
- **Type Safety**: Full TypeScript support
- **Dependency Injection**: NestJS integration

## Troubleshooting

### TypeScript Compilation Errors
Make sure you're compiling from the `packages/ai` directory:
```bash
cd packages/ai
npx tsc examples/simple-demo.ts --outDir dist --target es2020 --module commonjs --esModuleInterop true
```

### Provider Not Available
If you get "Provider X is not registered or available":
1. Check that the required environment variables are set
2. For Ollama, make sure it's installed and running: `ollama serve`

### Missing Dependencies
If you get module not found errors:
```bash
cd packages/ai
npm install
npm run build
```

## Next Steps

1. Try the simple demo to see basic functionality
2. Set up API keys and try the full demo
3. Check the source code to understand implementation details
4. Explore the facades for specific use cases
5. Read the main documentation for advanced usage
