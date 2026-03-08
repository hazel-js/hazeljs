# Memory Examples

This directory contains comprehensive examples demonstrating the memory features of `@hazeljs/rag`.

## Examples

### 1. Basic Memory (`basic-memory-example.ts`)

Demonstrates core memory features:
- ✅ Conversation tracking
- ✅ Entity memory
- ✅ Fact storage and retrieval
- ✅ Working memory (temporary context)
- ✅ Memory search
- ✅ Statistics and monitoring

**Run:**
```bash
npm run example:memory:basic
```

### 2. RAG with Memory (`rag-with-memory-example.ts`)

Shows how to integrate memory with RAG for context-aware responses:
- ✅ Hybrid memory storage (buffer + vector)
- ✅ Document retrieval with conversation context
- ✅ Automatic fact extraction
- ✅ Conversation summarization
- ✅ Multi-turn conversations with memory

**Run:**
```bash
npm run example:memory:rag
```

**Requirements:**
- Set `OPENAI_API_KEY` environment variable

### 3. Chatbot with Memory (`chatbot-with-memory-example.ts`)

Complete chatbot implementation with memory:
- ✅ Context-aware conversations
- ✅ Entity tracking (people, companies, etc.)
- ✅ Preference learning
- ✅ Memory search
- ✅ Interactive mode (optional)

**Run:**
```bash
npm run memory:chatbot
```

### 4. Shared Memory: RAG + Agent (`shared-memory-rag-agent.example.ts`)

In-process shared memory: one `MemoryManager` used by both RAG and Agent (same session = same conversation and context). No HTTP, no separate service.

- One store (e.g. `BufferMemory` or `createHazelMemoryStoreAdapter` from `@hazeljs/rag/memory-hazel`)
- One `MemoryManager` passed to `RAGPipelineWithMemory` and `AgentRuntime`
- Same `sessionId` so RAG and Agent see the same conversation history

**Run (from example directory, after `npm install` from monorepo root):**
```bash
cd example && npm run memory:shared
```

## Quick Start

### Install Dependencies

```bash
cd hazeljs/example
npm install
```

### Set Environment Variables

```bash
export OPENAI_API_KEY=your-api-key-here
```

### Run All Examples

```bash
# Basic memory
npm run example:memory:basic

# RAG with memory
npm run example:memory:rag

# Chatbot with memory
npm run example:memory:chatbot
```

## Key Concepts

### Memory Types

1. **Conversation Memory** - Track multi-turn conversations
2. **Entity Memory** - Remember people, places, things
3. **Semantic Memory** - Store facts and knowledge
4. **Episodic Memory** - Remember specific events
5. **Working Memory** - Temporary task context

### Memory Stores

1. **BufferMemory** - Fast in-memory FIFO buffer
2. **VectorMemory** - Semantic search with embeddings
3. **HybridMemory** - Combines buffer + vector for best performance

### Features Demonstrated

- 🧠 **Context Retention** - Remember across conversations
- 🔍 **Semantic Search** - Find relevant memories
- 📊 **Statistics** - Monitor memory usage
- 🎯 **Importance Scoring** - Prioritize key information
- 📝 **Auto-Summarization** - Compress old conversations
- 👤 **Entity Tracking** - Remember relationships
- 💾 **Persistent Storage** - Long-term memory

## Code Structure

```typescript
// 1. Setup memory store
const memoryStore = new BufferMemory({ maxSize: 100 });

// 2. Create memory manager
const memoryManager = new MemoryManager(memoryStore, {
  maxConversationLength: 20,
  entityExtraction: true,
});

// 3. Track conversations
await memoryManager.addMessage(
  { role: 'user', content: 'Hello!' },
  'session-123'
);

// 4. Store facts
await memoryManager.storeFact('User prefers dark mode');

// 5. Search memories
const memories = await memoryManager.relevantMemories('user preferences');
```

## Advanced Usage

### With RAG Pipeline

```typescript
const rag = new RAGPipelineWithMemory(
  ragConfig,
  memoryManager,
  llmFunction
);

const response = await rag.queryWithMemory(
  'What did we discuss?',
  'session-123'
);
```

### Entity Tracking

```typescript
await memoryManager.trackEntity({
  name: 'John Doe',
  type: 'person',
  attributes: { role: 'customer' },
  relationships: [{ type: 'works_at', target: 'Acme Inc' }],
  // ...
});
```

### Working Memory

```typescript
await memoryManager.setContext('current_task', 'checkout', 'session-123');
const task = await memoryManager.getContext('current_task', 'session-123');
```

## Best Practices

1. **Choose the Right Store**
   - Development: `BufferMemory`
   - Production: `HybridMemory`
   - Semantic Search: `VectorMemory`

2. **Set Appropriate Limits**
   - `maxConversationLength`: Based on token limits
   - `archiveThreshold`: Balance performance vs memory

3. **Enable Features Selectively**
   - `entityExtraction`: For tracking people/things
   - `importanceScoring`: For prioritization
   - `memoryDecay`: For time-based relevance

4. **Monitor Memory Usage**
   - Use `getStats()` regularly
   - Prune old memories periodically
   - Clear sessions when done

## Troubleshooting

### Memory Not Persisting

- Check if `initialize()` was called
- Verify session IDs are consistent
- Ensure vector store is properly configured

### High Memory Usage

- Reduce `maxConversationLength`
- Lower `archiveThreshold`
- Enable `memoryDecay`
- Call `prune()` periodically

### Slow Performance

- Use `BufferMemory` for recent data
- Enable `HybridMemory` for archiving
- Optimize vector store indexing
- Batch operations when possible

## Resources

- [Memory Documentation](../../packages/rag/MEMORY.md)
- [RAG Documentation](../../packages/rag/README.md)
- [API Reference](../../packages/rag/docs/)

## Contributing

Found an issue or want to add an example? Please open an issue or PR!

## License

Apache 2.0
