# Memory System for @hazeljs/rag

The memory system adds persistent context and conversation management to the RAG package, enabling AI applications to remember conversations, user preferences, and historical interactions across sessions.

## Features

- 🧠 **Conversation Memory** - Track multi-turn conversations with context windows
- 🏷️ **Entity Memory** - Extract and remember entities mentioned in conversations
- 📝 **Semantic Memory** - Store facts and knowledge with semantic understanding
- 📅 **Episodic Memory** - Remember specific events with temporal context
- 💾 **Working Memory** - Temporary scratchpad for current task context
- 🔄 **Hybrid Storage** - Combines fast buffer with long-term vector storage
- 🔍 **Semantic Search** - Find relevant memories using embeddings

## Installation

Memory features are included in `@hazeljs/rag`:

```bash
npm install @hazeljs/rag
```

## Quick Start

### Basic Memory Usage

```typescript
import {
  MemoryManager,
  BufferMemory,
  OpenAIEmbeddings,
} from '@hazeljs/rag';

// Setup memory store
const memoryStore = new BufferMemory({ maxSize: 100 });

// Create memory manager
const memoryManager = new MemoryManager(memoryStore, {
  maxConversationLength: 20,
  entityExtraction: true,
});

await memoryManager.initialize();

// Add conversation messages
await memoryManager.addMessage(
  { role: 'user', content: 'My name is John' },
  'session-123'
);

await memoryManager.addMessage(
  { role: 'assistant', content: 'Nice to meet you, John!' },
  'session-123'
);

// Retrieve conversation history
const history = await memoryManager.getConversationHistory('session-123');
console.log(history);
```

### RAG with Memory

```typescript
import {
  RAGPipelineWithMemory,
  MemoryManager,
  HybridMemory,
  BufferMemory,
  VectorMemory,
  MemoryVectorStore,
  OpenAIEmbeddings,
} from '@hazeljs/rag';
import OpenAI from 'openai';

// Setup embeddings
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Setup hybrid memory (buffer + vector)
const buffer = new BufferMemory({ maxSize: 20 });
const vectorStore = new MemoryVectorStore(embeddings);
const vectorMemory = new VectorMemory(vectorStore, embeddings);
const hybridMemory = new HybridMemory(buffer, vectorMemory, {
  archiveThreshold: 15,
});

// Create memory manager
const memoryManager = new MemoryManager(hybridMemory, {
  maxConversationLength: 20,
  summarizeAfter: 50,
});

// Setup LLM
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const llmFunction = async (prompt: string) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  });
  return response.choices[0].message.content || '';
};

// Create RAG pipeline with memory
const rag = new RAGPipelineWithMemory(
  {
    vectorStore: documentVectorStore, // Your document vector store
    embeddingProvider: embeddings,
  },
  memoryManager,
  llmFunction
);

await rag.initialize();

// Query with memory context
const response = await rag.queryWithMemory(
  'What did we discuss about pricing?',
  'session-123',
  'user-456'
);

console.log(response.answer);
console.log('Relevant memories:', response.memories);
console.log('Conversation history:', response.conversationHistory);
```

## Memory Stores

### BufferMemory

Fast in-memory FIFO buffer for recent memories.

```typescript
import { BufferMemory } from '@hazeljs/rag';

const buffer = new BufferMemory({
  maxSize: 100,
  ttl: 3600000, // 1 hour in milliseconds
});
```

**Best for:**
- Development and testing
- Recent conversation history
- Temporary context

### VectorMemory

Stores memories as embeddings for semantic search.

```typescript
import { VectorMemory, PineconeVectorStore } from '@hazeljs/rag';

const vectorMemory = new VectorMemory(vectorStore, embeddings, {
  collectionName: 'memories',
});
```

**Best for:**
- Long-term memory storage
- Semantic search across memories
- Production deployments

### HybridMemory

Combines buffer and vector storage for optimal performance.

```typescript
import { HybridMemory } from '@hazeljs/rag';

const hybrid = new HybridMemory(buffer, vectorMemory, {
  bufferSize: 20,
  archiveThreshold: 15, // Archive after 15 messages
});
```

**Best for:**
- Production applications
- Balancing speed and persistence
- Large-scale deployments

## Memory Types

### Conversation Memory

Track multi-turn conversations:

```typescript
// Add messages
await memoryManager.addMessage(
  { role: 'user', content: 'What is HazelJS?' },
  'session-123'
);

await memoryManager.addMessage(
  { role: 'assistant', content: 'HazelJS is an AI-native framework...' },
  'session-123'
);

// Get history
const history = await memoryManager.getConversationHistory('session-123', 10);

// Summarize conversation
const summary = await memoryManager.summarizeConversation('session-123');

// Clear conversation
await memoryManager.clearConversation('session-123');
```

### Entity Memory

Track entities mentioned in conversations:

```typescript
// Track an entity
await memoryManager.trackEntity({
  name: 'John Doe',
  type: 'person',
  attributes: {
    role: 'customer',
    company: 'Acme Inc',
  },
  relationships: [
    { type: 'works_at', target: 'Acme Inc' },
  ],
  firstSeen: new Date(),
  lastSeen: new Date(),
  mentions: 1,
});

// Get entity
const entity = await memoryManager.getEntity('John Doe');

// Update entity
await memoryManager.updateEntity('John Doe', {
  attributes: { ...entity.attributes, status: 'premium' },
});

// Get all entities
const entities = await memoryManager.getAllEntities('session-123');
```

### Semantic Memory (Facts)

Store and recall facts:

```typescript
// Store facts
await memoryManager.storeFact(
  'User prefers dark mode',
  { userId: 'user-123', category: 'preference' }
);

await memoryManager.storeFact(
  'HazelJS supports TypeScript decorators',
  { category: 'feature' }
);

// Recall facts
const facts = await memoryManager.recallFacts('user preferences', {
  topK: 5,
});

// Update a fact
await memoryManager.updateFact(factId, 'User prefers light mode');
```

### Working Memory

Temporary context for current tasks:

```typescript
// Set context
await memoryManager.setContext('current_task', 'order_processing', 'session-123');
await memoryManager.setContext('order_id', '12345', 'session-123');

// Get context
const task = await memoryManager.getContext('current_task', 'session-123');
const orderId = await memoryManager.getContext('order_id', 'session-123');

// Clear context
await memoryManager.clearContext('session-123');
```

## Advanced Features

### Memory Search

Search across all memories semantically:

```typescript
const relevantMemories = await memoryManager.relevantMemories(
  'pricing and discounts',
  {
    sessionId: 'session-123',
    types: [MemoryType.CONVERSATION, MemoryType.FACT],
    topK: 5,
    minScore: 0.7,
  }
);
```

### Memory Statistics

Get insights about stored memories:

```typescript
const stats = await memoryManager.getStats('session-123');

console.log(`Total memories: ${stats.totalMemories}`);
console.log(`By type:`, stats.byType);
console.log(`Average importance: ${stats.averageImportance}`);
```

### Query with Learning

Automatically extract and store facts from responses:

```typescript
const response = await rag.queryWithLearning(
  'Tell me about HazelJS features',
  'session-123',
  'user-456'
);
// Facts from the response are automatically stored
```

### Conversation Summary

Get a summary of the entire conversation:

```typescript
const summary = await rag.getConversationSummary('session-123');
console.log(summary);
```

## Configuration

### Memory Manager Config

```typescript
const config = {
  maxConversationLength: 20,      // Max messages in buffer
  summarizeAfter: 50,              // Summarize after N messages
  entityExtraction: true,          // Auto-extract entities
  importanceScoring: true,         // Calculate importance scores
  memoryDecay: false,              // Enable time-based decay
  decayRate: 0.1,                  // Decay rate (if enabled)
  maxWorkingMemorySize: 10,        // Max working memory items
};
```

### Buffer Memory Config

```typescript
const bufferConfig = {
  maxSize: 100,                    // Max memories in buffer
  ttl: 3600000,                    // Time to live (ms)
};
```

### Hybrid Memory Config

```typescript
const hybridConfig = {
  bufferSize: 20,                  // Buffer size
  archiveThreshold: 15,            // Archive after N messages
  ttl: 3600000,                    // Buffer TTL
};
```

## Use Cases

### Customer Support Bot

```typescript
// Remember customer information
await memoryManager.trackEntity({
  name: 'Jane Smith',
  type: 'customer',
  attributes: { tier: 'premium', accountId: 'ACC-123' },
  // ...
});

// Store support history
await memoryManager.storeFact(
  'Customer reported login issues on 2024-01-15',
  { customerId: 'ACC-123', category: 'support' }
);

// Query with context
const response = await rag.queryWithMemory(
  'What was my previous issue?',
  'session-123',
  'ACC-123'
);
```

### Personal AI Assistant

```typescript
// Remember preferences
await memoryManager.storeFact('User prefers concise responses');
await memoryManager.storeFact('User timezone is PST');

// Track tasks
await memoryManager.setContext('active_tasks', ['email', 'meeting'], 'session-123');

// Contextual responses
const response = await rag.queryWithMemory(
  'What should I focus on today?',
  'session-123'
);
```

### Educational Tutor

```typescript
// Track learning progress
await memoryManager.trackEntity({
  name: 'Student-123',
  type: 'student',
  attributes: {
    level: 'intermediate',
    completedLessons: ['intro', 'basics'],
  },
  // ...
});

// Remember misconceptions
await memoryManager.storeFact(
  'Student confused about async/await',
  { studentId: 'Student-123', topic: 'javascript' }
);
```

## Best Practices

1. **Choose the Right Store**
   - Use `BufferMemory` for development
   - Use `VectorMemory` for production with semantic search
   - Use `HybridMemory` for best of both worlds

2. **Set Appropriate Limits**
   - Configure `maxConversationLength` based on token limits
   - Set `archiveThreshold` to balance performance and memory

3. **Use Importance Scoring**
   - Enable `importanceScoring` to prioritize relevant memories
   - Important memories are retained longer

4. **Session Management**
   - Use consistent `sessionId` for conversation continuity
   - Clear sessions when appropriate to free memory

5. **Entity Tracking**
   - Enable `entityExtraction` for automatic entity detection
   - Manually track important entities for better accuracy

## Performance Tips

1. **Memory Pruning** - Regularly prune old or low-importance memories
2. **Batch Operations** - Use batch methods when adding multiple memories
3. **Indexing** - Ensure vector store is properly indexed
4. **Caching** - Cache frequently accessed memories
5. **Monitoring** - Track memory statistics to optimize configuration

## License

Apache 2.0

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.
