# Agent State vs Memory: Understanding the Difference

There are **two separate persistence layers** in the agent system that serve different purposes:

## Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Agent Execution                      │
└─────────────────────────────────────────────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────────┐  ┌──────────────────────────────┐
│  Agent State         │  │  Memory (RAG)                │
│  Persistence         │  │  Persistence                  │
│                      │  │                              │
│  - Execution flow    │  │  - Conversation history      │
│  - Steps             │  │  - Entities                  │
│  - State transitions │  │  - Facts                     │
│  - Execution context │  │  - Working memory            │
│  - Metadata          │  │  - Long-term knowledge        │
└──────────────────────┘  └──────────────────────────────┘
```

## Agent State Persistence

**Purpose**: Track the **execution flow** and **state machine** of agent runs

**What it stores**:
- ✅ Execution ID and context
- ✅ Current state (IDLE, THINKING, WAITING_FOR_APPROVAL, etc.)
- ✅ Execution steps (what the agent did)
- ✅ Step results and errors
- ✅ Execution metadata
- ✅ **Temporary** conversation history (during execution)

**Lifetime**: 
- **Short-lived** - typically minutes to hours
- Ephemeral - deleted after execution completes (or TTL expires)

**Use cases**:
- Resume paused executions
- Track execution progress
- Debug failed executions
- Monitor active agent runs
- State machine transitions

**Backends**:
- In-Memory (default)
- Redis (production)
- Database/Prisma (audit)

**Example**:
```typescript
// Agent State tracks: "Agent executed step 1, 2, 3, now waiting for approval"
{
  executionId: "abc-123",
  state: "WAITING_FOR_APPROVAL",
  steps: [
    { stepNumber: 1, action: "think", result: {...} },
    { stepNumber: 2, action: "use_tool", result: {...} },
    { stepNumber: 3, action: "ask_user", result: {...} }
  ]
}
```

## Memory Persistence (RAG MemoryManager)

**Purpose**: Store **long-term knowledge** and **context** across sessions

**What it stores**:
- ✅ Conversation history (across all sessions)
- ✅ Entities (people, places, things mentioned)
- ✅ Facts (learned information)
- ✅ Working memory (user preferences, session state)
- ✅ Events (important occurrences)

**Lifetime**:
- **Long-lived** - days, weeks, months
- Persistent - survives agent restarts
- Cross-session - shared across multiple agent runs

**Use cases**:
- Build context for new conversations
- Remember entities across sessions
- Store learned facts
- Maintain user preferences
- Semantic search of past conversations

**Backends**:
- BufferMemory (in-memory)
- VectorMemory (Pinecone, Weaviate, Qdrant, ChromaDB)
- HybridMemory (combination)

**Example**:
```typescript
// Memory stores: "User's name is John, likes coffee, mentioned Paris last week"
{
  entities: [
    { name: "John", type: "person", attributes: {...} },
    { name: "Paris", type: "location", attributes: {...} }
  ],
  facts: ["User prefers coffee over tea"],
  workingMemory: { "user_preferences": { "drink": "coffee" } }
}
```

## Key Differences

| Aspect | Agent State | Memory (RAG) |
|--------|-------------|--------------|
| **Purpose** | Execution flow tracking | Long-term knowledge |
| **Lifetime** | Minutes to hours | Days to months |
| **Scope** | Single execution | Cross-session |
| **Data** | Steps, state, metadata | Conversations, entities, facts |
| **Query** | By executionId | Semantic search, by sessionId |
| **Backend** | Redis/DB | Vector stores (Pinecone, etc.) |
| **When used** | During execution | Before/after execution |

## How They Work Together

```typescript
// 1. Agent starts execution
const context = stateManager.createContext(...);

// 2. Load memory (conversation history, entities) into context
await contextBuilder.buildWithMemory(context);
// ↑ This reads from Memory (RAG), populates context.memory

// 3. Agent executes (state tracked in Agent State)
await runtime.execute(...);
// ↑ State manager tracks steps, state transitions

// 4. After execution, persist to Memory
await contextBuilder.persistToMemory(context);
// ↑ This writes conversation history, entities to Memory (RAG)
```

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│  Execution Start                                        │
└─────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────┐
│  Agent State         │  ← Create execution context
│  (Redis/DB)          │
└──────────────────────┘
           │
           ▼
┌──────────────────────┐
│  Memory (RAG)        │  ← Load conversation history, entities
│  (Vector Store)      │     into execution context
└──────────────────────┘
           │
           ▼
┌──────────────────────┐
│  Agent Executes      │  ← State manager tracks steps
│                      │     Memory provides context
└──────────────────────┘
           │
           ▼
┌──────────────────────┐
│  Memory (RAG)        │  ← Persist conversation, entities
│  (Vector Store)      │     for future sessions
└──────────────────────┘
           │
           ▼
┌──────────────────────┐
│  Agent State         │  ← Archive execution (optional)
│  (Redis/DB)          │
└──────────────────────┘
```

## Overlap: Conversation History

**Both** store conversation history, but for different reasons:

### Agent State Conversation History
- **Purpose**: Track messages **during** execution
- **Scope**: Single execution only
- **Lifetime**: Until execution completes
- **Use**: Resume paused executions, debug current run

### Memory Conversation History
- **Purpose**: Build context for **future** conversations
- **Scope**: All sessions for a user/session
- **Lifetime**: Long-term (weeks/months)
- **Use**: Semantic search, context building, continuity

## When to Use Which

### Use Agent State Persistence when:
- ✅ You need to resume paused executions
- ✅ You want to track execution progress
- ✅ You need to debug failed runs
- ✅ You want to monitor active agents
- ✅ You need execution audit trails

### Use Memory Persistence when:
- ✅ You want agents to remember past conversations
- ✅ You need entity tracking across sessions
- ✅ You want to store learned facts
- ✅ You need semantic search of conversations
- ✅ You want to maintain user preferences

## Recommended Setup

### Development
```typescript
// In-memory for both (default)
const runtime = new AgentRuntime({
  // stateManager: default (in-memory)
  // memoryManager: default (BufferMemory)
});
```

### Production
```typescript
// Redis for agent state (fast, distributed)
// Vector store (Pinecone) for memory (semantic search)
const stateManager = new RedisStateManager({ client: redisClient });
const memoryStore = new VectorMemory(pineconeStore, embeddings);
const memoryManager = new MemoryManager(memoryStore);

const runtime = new AgentRuntime({
  stateManager,      // ← Agent execution state
  memoryManager,     // ← Long-term memory
});
```

## Summary

- **Agent State** = "What is the agent doing right now?"
- **Memory** = "What does the agent know from past conversations?"

They complement each other:
- **State** enables resumable, trackable executions
- **Memory** enables context-aware, continuous conversations

Both are needed for a production-ready agent system!
