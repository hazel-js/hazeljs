# Agent State Persistence

> **Note**: This document covers **Agent State Persistence** (execution flow, steps, state transitions).  
> For information about **Memory Persistence** (conversation history, entities, facts), see `@hazeljs/rag` documentation.  
> For understanding the difference between State and Memory, see [STATE_VS_MEMORY.md](./STATE_VS_MEMORY.md).

The `@hazeljs/agent` package supports multiple persistence backends for agent execution state. Choose the right backend based on your needs:

## Available Backends

### 1. In-Memory (Default)
- **Best for**: Development, testing, single-instance deployments
- **Pros**: Fast, no setup required
- **Cons**: Data lost on restart, not suitable for distributed systems

### 2. Redis
- **Best for**: Production, distributed systems, high-performance scenarios
- **Pros**: Fast, distributed, TTL support, pub/sub capabilities
- **Cons**: Requires Redis infrastructure

### 3. Database (Prisma)
- **Best for**: Long-term persistence, audit trails, analytics
- **Pros**: Durable, queryable, full audit trail
- **Cons**: Slower than Redis, requires database setup

## Usage

### In-Memory (Default)

No configuration needed - this is the default:

```typescript
import { AgentRuntime } from '@hazeljs/agent';

const runtime = new AgentRuntime({
  // Uses in-memory state manager by default
});
```

### Redis Backend

1. Install Redis client:
```bash
npm install redis
```

2. Configure Redis state manager:

```typescript
import { AgentRuntime, RedisStateManager } from '@hazeljs/agent';
import { createClient } from 'redis';

// Create Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

await redisClient.connect();

// Create Redis state manager
const stateManager = new RedisStateManager({
  client: redisClient,
  keyPrefix: 'agent:state:', // Optional
  defaultTTL: 3600, // 1 hour for active contexts
  completedTTL: 86400, // 24 hours for completed contexts
  failedTTL: 604800, // 7 days for failed contexts
});

// Use with runtime
const runtime = new AgentRuntime({
  stateManager,
});
```

### Database Backend (Prisma)

1. Install Prisma:
```bash
npm install @prisma/client
```

2. Add schema to your Prisma schema:
   - Copy models from `prisma-schema.example.prisma` to your `prisma/schema.prisma`
   - See [PRISMA_INTEGRATION.md](./PRISMA_INTEGRATION.md) for detailed instructions

3. Run migrations:
```bash
npx prisma migrate dev --name add_agent_state_models
npx prisma generate
```

4. Configure database state manager:

```typescript
import { AgentRuntime, DatabaseStateManager } from '@hazeljs/agent';
import { PrismaClient } from '@prisma/client';

// Create Prisma client
const prisma = new PrismaClient();

// Create database state manager
const stateManager = new DatabaseStateManager({
  client: prisma,
  softDelete: true, // Keep deleted contexts for audit
  autoArchive: false, // Optional: auto-archive old contexts
  archiveThresholdDays: 30,
});

// Use with runtime
const runtime = new AgentRuntime({
  stateManager,
});
```

## Hybrid Approach (Recommended for Production)

Use Redis for hot data and Database for cold/archived data:

```typescript
import { AgentRuntime, RedisStateManager, DatabaseStateManager } from '@hazeljs/agent';

// Redis for active executions
const redisStateManager = new RedisStateManager({
  client: redisClient,
  defaultTTL: 3600,
});

// Database for persistence and audit
const dbStateManager = new DatabaseStateManager({
  client: prisma,
});

// Use Redis for runtime
const runtime = new AgentRuntime({
  stateManager: redisStateManager,
});

// Optionally sync to database periodically
setInterval(async () => {
  const activeContexts = await redisStateManager.getSessionContexts(sessionId);
  for (const context of activeContexts) {
    if (context.state === 'completed' || context.state === 'failed') {
      // Archive to database
      await dbStateManager.createContext(
        context.agentId,
        context.sessionId,
        context.input,
        context.userId,
        context.metadata
      );
    }
  }
}, 60000); // Every minute
```

## RAG Memory Persistence

RAG memory (conversation history, entities, facts) uses the `@hazeljs/rag` package's `MemoryManager`, which supports:

- **BufferMemory**: In-memory (default)
- **VectorMemory**: Vector stores (Pinecone, Weaviate, Qdrant, ChromaDB)
- **HybridMemory**: Combination of both

See `@hazeljs/rag` documentation for RAG memory configuration.

## Performance Considerations

- **Redis**: Best for high-frequency reads/writes, distributed systems
- **Database**: Best for long-term storage, complex queries, analytics
- **In-Memory**: Best for development, single-instance deployments

## Migration Guide

### From In-Memory to Redis

1. Install Redis and client
2. Create RedisStateManager
3. Pass to AgentRuntime config
4. No code changes needed - interface is compatible

### From In-Memory to Database

1. Install Prisma
2. Add schema and run migrations
3. Create DatabaseStateManager
4. Pass to AgentRuntime config
5. No code changes needed - interface is compatible

## Best Practices

1. **Development**: Use in-memory (default)
2. **Staging**: Use Redis for testing distributed scenarios
3. **Production**: Use Redis for active state, Database for audit/analytics
4. **High Volume**: Use Redis with appropriate TTL settings
5. **Compliance**: Use Database for full audit trails

## Related Documentation

- **[PRISMA_INTEGRATION.md](./PRISMA_INTEGRATION.md)** - Step-by-step guide for integrating Prisma schema
- **[STATE_VS_MEMORY.md](./STATE_VS_MEMORY.md)** - Understanding the difference between Agent State and Memory
- **[prisma-schema.example.prisma](./prisma-schema.example.prisma)** - Example Prisma schema file
