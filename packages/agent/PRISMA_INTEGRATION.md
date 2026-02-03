# Prisma Integration Guide

This guide shows you how to integrate the Agent State Persistence models into your existing Prisma schema.

## Quick Start

### Step 1: Add Models to Your Schema

Copy the models from `prisma-schema.example.prisma` into your existing `prisma/schema.prisma` file:

```prisma
// Your existing schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql" // or "mysql", "sqlite", etc.
  url      = env("DATABASE_URL")
}

// Your existing models...
model User {
  id    Int     @id @default(autoincrement())
  name  String
  email String  @unique
}

// Add these Agent State models:
model AgentContext {
  id                String   @id @default(uuid())
  executionId      String   @unique
  agentId          String
  sessionId        String
  userId           String?
  input            String
  state            String   // AgentState enum as string
  steps            Json     // AgentStep[]
  conversationHistory Json   // ConversationMessage[]
  workingMemory    Json     // Record<string, unknown>
  facts            Json     // string[]
  entities         Json     // Entity[]
  ragContext       Json?    // string[]
  metadata         Json     // Record<string, unknown>
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  deletedAt        DateTime? // For soft deletes
  agentSteps       AgentStep[] // Relation to steps table (optional)

  @@index([sessionId])
  @@index([userId])
  @@index([agentId])
  @@index([state])
  @@index([createdAt])
  @@index([deletedAt])
  @@map("agent_contexts")
}

// Optional: Separate table for execution steps (for better querying)
model AgentStep {
  id            String   @id @default(uuid())
  executionId   String
  stepNumber    Int
  state         String
  action        Json?
  result        Json?
  error         String?
  timestamp     DateTime @default(now())
  duration      Int?

  context       AgentContext @relation(fields: [executionId], references: [executionId], onDelete: Cascade)

  @@index([executionId])
  @@index([timestamp])
  @@map("agent_steps")
}

// Optional: Session tracking
model AgentSession {
  id            String   @id @default(uuid())
  sessionId     String   @unique
  userId        String?
  agentId       String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  completedAt   DateTime?

  @@index([userId])
  @@index([agentId])
  @@index([createdAt])
  @@map("agent_sessions")
}
```

### Step 2: Create Migration

```bash
# Create a new migration
npx prisma migrate dev --name add_agent_state_models

# Or if using migrate manually
npx prisma migrate dev
```

### Step 3: Generate Prisma Client

```bash
npx prisma generate
```

### Step 4: Use in Your Code

```typescript
import { AgentRuntime, DatabaseStateManager } from '@hazeljs/agent';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const stateManager = new DatabaseStateManager({
  client: prisma,
  softDelete: true,
});

const runtime = new AgentRuntime({
  stateManager,
});
```

## Integration Options

### Option 1: Minimal (Recommended)

Add only the `AgentContext` model. Steps are stored as JSON in the context:

```prisma
model AgentContext {
  id                String   @id @default(uuid())
  executionId      String   @unique
  agentId          String
  sessionId        String
  userId           String?
  input            String
  state            String
  steps            Json     // All steps stored here
  conversationHistory Json
  workingMemory    Json
  facts            Json
  entities         Json
  ragContext       Json?
  metadata         Json
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  deletedAt        DateTime?

  @@index([sessionId])
  @@index([userId])
  @@index([agentId])
  @@index([state])
  @@map("agent_contexts")
}
```

**Pros**: Simple, single table, fast writes  
**Cons**: Can't query steps independently

### Option 2: Full (For Analytics)

Add all three models (`AgentContext`, `AgentStep`, `AgentSession`) for better querying:

```prisma
model AgentContext {
  // ... fields ...
  agentSteps       AgentStep[] // Relation
}

model AgentStep {
  // ... fields ...
  context       AgentContext @relation(...)
}

model AgentSession {
  // ... fields ...
}
```

**Pros**: Can query steps independently, better for analytics  
**Cons**: More complex, requires joins

### Option 3: Custom Schema

Adapt the schema to your needs:

```prisma
// Example: Add relation to your User model
model User {
  id            Int     @id @default(autoincrement())
  name          String
  email         String  @unique
  agentContexts AgentContext[] // Add this
}

model AgentContext {
  // ... fields ...
  userId        String?
  user          User?   @relation(fields: [userId], references: [id]) // Add this
}
```

## Database Compatibility

### PostgreSQL (Recommended)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

✅ Full support for JSON fields  
✅ Excellent indexing  
✅ Best performance

### MySQL

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

✅ JSON support (MySQL 5.7+)  
✅ Good performance  
⚠️ Use `Json` type for JSON fields

### SQLite

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

✅ Works for development  
⚠️ JSON stored as TEXT (slower queries)  
⚠️ Not recommended for production

### SQL Server

```prisma
datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}
```

✅ JSON support (SQL Server 2016+)  
✅ Good for enterprise

## Migration Examples

### Initial Migration

```bash
# Create migration
npx prisma migrate dev --name add_agent_state_models

# This will create:
# - agent_contexts table
# - agent_steps table (if included)
# - agent_sessions table (if included)
# - All indexes
```

### Adding to Existing Database

If you already have a database with other tables:

```bash
# Prisma will detect the new models
npx prisma migrate dev --name add_agent_state

# Review the migration SQL before applying
npx prisma migrate dev --create-only
# Edit the migration file if needed
npx prisma migrate dev
```

## Schema Customization

### Customize Field Types

```prisma
model AgentContext {
  // Use your own ID format
  id          String   @id @default(cuid()) // or @default(uuid())
  
  // Add custom fields
  priority    Int      @default(0)
  tags        String[]
  
  // Customize JSON fields
  metadata    Json     @default("{}")
}
```

### Add Relations

```prisma
model User {
  id            Int     @id @default(autoincrement())
  agentContexts AgentContext[]
}

model AgentContext {
  userId        String?
  user          User?   @relation(fields: [userId], references: [id])
}
```

### Custom Indexes

```prisma
model AgentContext {
  // ... fields ...
  
  // Add composite indexes
  @@index([agentId, state])
  @@index([sessionId, createdAt])
  
  // Add full-text search (PostgreSQL)
  @@index([input(ops: Raw("gin_trgm_ops"))])
}
```

## Using with HazelJS Prisma Module

If you're using `@hazeljs/prisma`:

```typescript
import { HazelModule } from '@hazeljs/core';
import { PrismaModule } from '@hazeljs/prisma';
import { AgentModule } from '@hazeljs/agent';
import { PrismaClient } from '@prisma/client';
import { DatabaseStateManager } from '@hazeljs/agent';

@HazelModule({
  imports: [
    PrismaModule.forRoot({
      // Your Prisma config
    }),
    AgentModule.forRoot({
      // Agent config
    }),
  ],
})
export class AppModule {
  constructor(private prisma: PrismaClient) {
    // Create state manager
    const stateManager = new DatabaseStateManager({
      client: this.prisma,
    });
    
    // Use with AgentRuntime
    // (configure in your agent service)
  }
}
```

## Troubleshooting

### Error: "Model AgentContext not found"

**Solution**: Make sure you've:
1. Added the model to your schema
2. Run `npx prisma generate`
3. Restarted your application

### Error: "Column does not exist"

**Solution**: Run migrations:
```bash
npx prisma migrate dev
```

### JSON Field Issues

**PostgreSQL**: Use `Json` type (works out of the box)  
**MySQL**: Use `Json` type (MySQL 5.7+)  
**SQLite**: Use `String` type and parse manually, or use `Json` (stored as TEXT)

### Performance Issues

1. **Add indexes** on frequently queried fields:
   ```prisma
   @@index([sessionId])
   @@index([userId])
   @@index([state])
   ```

2. **Use soft deletes** to avoid expensive DELETE operations:
   ```prisma
   deletedAt DateTime?
   @@index([deletedAt])
   ```

3. **Partition large tables** (PostgreSQL):
   ```sql
   -- Partition by date for very large tables
   CREATE TABLE agent_contexts_2024_12 PARTITION OF agent_contexts
   FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
   ```

## Example: Complete Integration

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Your existing models
model User {
  id            Int     @id @default(autoincrement())
  email         String  @unique
  name          String
  agentContexts AgentContext[] // Relation
}

// Agent State models
model AgentContext {
  id                String   @id @default(uuid())
  executionId      String   @unique
  agentId          String
  sessionId        String
  userId           String?
  user             User?    @relation(fields: [userId], references: [id])
  input            String
  state            String
  steps            Json
  conversationHistory Json
  workingMemory    Json
  facts            Json
  entities         Json
  ragContext       Json?
  metadata         Json
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  deletedAt        DateTime?

  @@index([sessionId])
  @@index([userId])
  @@index([agentId])
  @@index([state])
  @@index([createdAt])
  @@map("agent_contexts")
}
```

```typescript
// app.module.ts
import { HazelModule } from '@hazeljs/core';
import { PrismaModule } from '@hazeljs/prisma';
import { AgentModule } from '@hazeljs/agent';
import { DatabaseStateManager } from '@hazeljs/agent';

@HazelModule({
  imports: [
    PrismaModule.forRoot({}),
    AgentModule.forRoot({
      stateManager: new DatabaseStateManager({
        client: prismaClient, // From PrismaModule
        softDelete: true,
      }),
    }),
  ],
})
export class AppModule {}
```

## Next Steps

1. ✅ Add models to your schema
2. ✅ Run migrations
3. ✅ Generate Prisma client
4. ✅ Configure DatabaseStateManager
5. ✅ Test with your agents

For more details, see:
- [PERSISTENCE.md](./PERSISTENCE.md) - Configuration guide
- [STATE_VS_MEMORY.md](./STATE_VS_MEMORY.md) - Understanding State vs Memory
- [prisma-schema.example.prisma](./prisma-schema.example.prisma) - Full schema example
