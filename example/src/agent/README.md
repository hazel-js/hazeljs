# HazelJS Agent Runtime - Examples

This directory contains comprehensive examples demonstrating real-world use cases for the HazelJS Agent Runtime.

## Examples

### 1. 🛍️ Customer Support Agent
**File**: `support-agent.example.ts`

**Use Case**: E-commerce customer support automation

**Features Demonstrated**:
- Order lookup and tracking
- Inventory checking
- Refund processing with approval workflow
- Address updates with approval
- Tool system with parameters
- Human-in-the-loop for sensitive operations
- Event system for monitoring

**Key Learnings**:
- How to define agents with `@Agent` decorator
- How to create tools with `@Tool` decorator
- How to implement approval workflows (`requiresApproval: true`)
- How to handle events for observability
- How to integrate with external services

**Run**:
```bash
npx ts-node examples/support-agent.example.ts
```

---

### 2. 🏢 Enterprise Knowledge Assistant (Corporate Copilot)
**File**: `enterprise-knowledge-assistant.example.ts`

**Use Case**: Internal employee knowledge assistant for enterprise environments

**Real-World Questions**:
- "What's our refund policy?"
- "How do I deploy service X?"
- "Who owns the payment service?"
- "What's the process for requesting PTO?"
- "How do I handle a P0 incident?"

**Features Demonstrated**:
- **RAG Integration**: Search company documentation with semantic search
- **Memory**: Maintain conversation context across questions
- **Multiple Tool Categories**:
  - Documentation search (policies, runbooks, guides)
  - Service ownership lookup
  - Deployment instructions and triggering
  - HR policies and PTO requests
  - Expert finding
  - Incident response procedures
- **Human-in-the-Loop**: Approval for deployments and PTO requests
- **Multi-System Integration**: Knowledge base, service registry, HR system, deployment pipeline, Slack

**Tools Implemented**:
1. `searchDocumentation` - Search company docs and policies
2. `lookupServiceOwnership` - Find service owners and on-call info
3. `getDeploymentInstructions` - Get deployment steps
4. `triggerDeployment` - Deploy services (requires approval)
5. `lookupHRPolicy` - Search HR policies
6. `submitPTORequest` - Submit PTO (requires approval)
7. `findExpert` - Find internal experts by topic
8. `getIncidentProcedure` - Get incident response procedures

**Key Learnings**:
- Building a multi-tool agent for enterprise use
- Integrating RAG for knowledge retrieval
- Using memory for conversational context
- Implementing approval workflows for sensitive operations
- Connecting to multiple backend systems
- Providing structured responses with citations

**Architecture**:
```
Employee Question
    ↓
Agent Runtime
    ↓
┌─────────────────────────────────┐
│  RAG: Search Documentation      │
│  Memory: Conversation Context   │
│  Tools: Access Systems          │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  Knowledge Base                 │
│  Service Registry               │
│  HR System                      │
│  Deployment Pipeline            │
│  Slack Notifications            │
└─────────────────────────────────┘
    ↓
Structured Answer with Sources
```

**Run**:
```bash
# Set up environment variables
export OPENAI_API_KEY="your-key"

# Run the example
npx ts-node examples/enterprise-knowledge-assistant.example.ts
```

**Expected Output**:
```
🏢 Enterprise Knowledge Assistant - Corporate Copilot

📝 Example 1: "What's our refund policy?"

[agent.execution.started] { input: "What's our refund policy?", ... }
[tool.execution.started] { toolName: 'searchDocumentation', ... }
[tool.execution.completed] { toolName: 'searchDocumentation', output: { ... } }

✅ Response: Based on our Refund Policy documentation, here's what you need to know:
- Full refunds are available within 30 days of purchase
- Partial refunds up to 90 days
- Manager approval required for amounts over $500

Source: Refund Policy - Customer Service Guide (last updated: 2024-12-01)
URL: https://docs.acme.com/policies/refunds

Completed in 2 steps (1234ms)

---

📝 Example 2: "Who owns the payment service?"

[agent.execution.started] { input: "Who owns the payment service?", ... }
[tool.execution.started] { toolName: 'lookupServiceOwnership', ... }
[tool.execution.completed] { toolName: 'lookupServiceOwnership', output: { ... } }

✅ Response: The payment service is owned by the Payments Team:
- Team Lead: Bob Smith
- Contact: payments-team@acme.com
- Slack: #team-payments
- Current On-Call: Carol Davis
- Repository: https://github.com/acme/payment-service
- Documentation: https://docs.acme.com/services/payment-service
- Status: healthy

Completed in 2 steps (987ms)

---

📝 Example 3: "How do I deploy the payment service to staging?"

[agent.execution.started] { input: "How do I deploy...", ... }
[tool.execution.started] { toolName: 'getDeploymentInstructions', ... }
[tool.execution.completed] { toolName: 'getDeploymentInstructions', output: { ... } }

✅ Response: Here are the deployment instructions for payment-service to staging:

Prerequisites:
1. Ensure all tests pass
2. Get code review approval
3. Check service health dashboard

Steps:
1. Run: npm run build
2. Run: npm run test
3. Run: npm run deploy:staging
4. Monitor logs for 5 minutes
5. Run smoke tests

Estimated Duration: 15 minutes
Pipeline: https://ci.acme.com/pipelines/payment-service
Runbook: https://docs.acme.com/runbooks/payment-service

Rollback: npm run rollback:staging

Completed in 2 steps (1456ms)
```

---

### 4. 📚 Knowledge Base Agent with REST API
**File**: `knowledge-base-agent.example.ts`

**Use Case**: Build a knowledge base system with REST API endpoints for document ingestion and question answering

**Features Demonstrated**:
- **REST API Integration**: HTTP endpoints for document ingestion and questions
- **RAG Integration**: Semantic search over ingested documents
- **Agent with Tools**: Agent uses tools to search and summarize documents
- **Memory Integration**: Maintains conversation context across questions
- **Document Management**: Store, retrieve, and manage documents
- **Source Citations**: Returns sources with answers for transparency

**API Endpoints**:
1. `POST /api/knowledge/ingest` - Ingest documents into the knowledge base
2. `POST /api/knowledge/ask` - Ask questions to the agent
3. `GET /api/knowledge/documents` - List all ingested documents
4. `GET /api/knowledge/documents/:id` - Get a specific document

**Tools Implemented**:
1. `searchKnowledgeBase` - Search for relevant documents using RAG
2. `summarizeDocuments` - Summarize multiple documents

**Key Learnings**:
- Building REST APIs with HazelJS controllers
- Integrating agents with HTTP endpoints
- Document ingestion and indexing workflow
- RAG-powered question answering
- Session management for conversations
- Source citation and transparency

**Example Usage**:

```bash
# 1. Ingest a document
curl -X POST http://localhost:3000/api/knowledge/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "title": "HazelJS Overview",
    "content": "HazelJS is a framework for building AI-native applications...",
    "metadata": { "category": "documentation" }
  }'

# 2. Ask a question
curl -X POST http://localhost:3000/api/knowledge/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is HazelJS?",
    "sessionId": "user-123"
  }'

# 3. List documents
curl http://localhost:3000/api/knowledge/documents
```

**Response Example**:
```json
{
  "answer": "HazelJS is a framework for building AI-native applications...",
  "sources": [
    {
      "id": "doc-1234567890-abc123",
      "title": "HazelJS Overview",
      "content": "HazelJS is a framework...",
      "score": 0.95,
      "metadata": { "category": "documentation" }
    }
  ],
  "executionId": "exec-123",
  "sessionId": "user-123"
}
```

**Architecture**:
```
HTTP Request (POST /api/knowledge/ask)
    ↓
KnowledgeBaseController
    ↓
KnowledgeBaseService
    ↓
AgentRuntime.execute('knowledge-base-agent')
    ↓
┌─────────────────────────────────┐
│  Agent Execution                │
│  - RAG: Retrieve documents      │
│  - Memory: Conversation context │
│  - Tools: Search & summarize   │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  RAGService                     │
│  - Semantic search              │
│  - Document indexing            │
└─────────────────────────────────┘
    ↓
HTTP Response with answer + sources
```

**Run**:
```bash
# Set up environment variables
export OPENAI_API_KEY="your-key"

# Import the module in your app.module.ts
# import { KnowledgeBaseAgentModule } from './agent/knowledge-base-agent.module';

# The endpoints will be available at:
# POST /api/knowledge/ingest
# POST /api/knowledge/ask
# GET /api/knowledge/documents
```

**Integration Example**:
```typescript
// In app.module.ts
import { KnowledgeBaseAgentModule } from './agent/knowledge-base-agent.module';

@HazelModule({
  imports: [
    // ... other modules
    KnowledgeBaseAgentModule,
  ],
})
export class AppModule {}
```

---

### 5. 💾 Persistence Backends
**File**: `persistence-backends.example.ts`

**Use Case**: Demonstrating different persistence backends for agent execution state

**Features Demonstrated**:
- **In-Memory State Manager**: Default, fast, for development
- **Redis State Manager**: Production-ready, distributed, with TTL support
- **Database State Manager**: Durable persistence with Prisma, audit trails
- **State Retrieval**: Get execution contexts after completion
- **Session Tracking**: Query all contexts for a session
- **Resume Capability**: Resume paused executions with persistent state

**Key Learnings**:
- How to configure different state managers
- When to use each backend (memory vs Redis vs Database)
- How to retrieve execution contexts
- How state persists across restarts (Redis/Database)
- Understanding the difference between Agent State and Memory

**Backend Comparison**:

| Backend | Best For | Pros | Cons |
|---------|----------|------|------|
| **In-Memory** | Development, testing | Fast, no setup | Lost on restart |
| **Redis** | Production, distributed | Fast, TTL, pub/sub | Requires Redis |
| **Database** | Audit, analytics | Durable, queryable | Slower than Redis |

**Usage**:

```bash
# In-Memory (default)
npx ts-node example/src/agent/persistence-backends.example.ts

# Redis
export REDIS_URL="redis://localhost:6379"
export PERSISTENCE_BACKEND=redis
npx ts-node example/src/agent/persistence-backends.example.ts

# Database
export DATABASE_URL="postgresql://user:pass@localhost:5432/db"
export PERSISTENCE_BACKEND=database
npx ts-node example/src/agent/persistence-backends.example.ts
```

**Example Output**:
```
╔════════════════════════════════════════════════════════════╗
║     Agent Persistence Backends Example                    ║
╚════════════════════════════════════════════════════════════╝

🔧 Using persistence backend: REDIS

📦 Connecting to Redis at redis://localhost:6379...
✅ Redis connected successfully
✅ Agent runtime initialized with custom state manager

📝 Example 1: Execute agent and track state

Executing agent with input: "Process order #12345"...

Execution result:
  Execution ID: abc-123-def-456
  State: completed
  Steps: 3
  Duration: 1234ms

📝 Example 2: Retrieve execution context

Retrieved context:
  Agent ID: persistence-demo-agent
  Session ID: session-1
  State: completed
  Steps: 3
  Created: 2024-12-14T12:00:00.000Z
  Updated: 2024-12-14T12:00:01.234Z

📝 Example 3: Get all contexts for a session

Found 2 contexts for session-1

📝 Example 4: Persistence across restarts

💡 With Redis/Database, you can:
   1. Stop the application
   2. Restart it
   3. Retrieve the same execution context using executionId
   Execution ID to test: abc-123-def-456
```

**Code Example**:

```typescript
import { AgentRuntime, RedisStateManager } from '@hazeljs/agent';
import { createClient } from 'redis';

// Create Redis client
const redisClient = createClient({ url: process.env.REDIS_URL });
await redisClient.connect();

// Create Redis state manager
const stateManager = new RedisStateManager({
  client: redisClient,
  defaultTTL: 3600, // 1 hour
  completedTTL: 86400, // 24 hours
});

// Use with runtime
const runtime = new AgentRuntime({
  stateManager,
});

// Execute agent
const result = await runtime.execute('agent-name', 'input');

// Retrieve context later (even after restart)
const context = await runtime.getContext(result.executionId);
```

**Related Documentation**:
- See `PERSISTENCE.md` for detailed configuration
- See `STATE_VS_MEMORY.md` for understanding the difference between State and Memory

---

## Common Patterns

### Pattern 1: Tool with Approval
```typescript
@Tool({
  description: 'Perform sensitive operation',
  requiresApproval: true,
  parameters: [...]
})
async sensitiveOperation(input: any) {
  // This will pause and wait for approval
  return result;
}
```

### Pattern 2: RAG Integration
```typescript
@Agent({
  name: 'my-agent',
  enableRAG: true,
  ragTopK: 5,
})
export class MyAgent {
  // Agent automatically retrieves relevant context
  // from knowledge base before reasoning
}
```

### Pattern 3: Memory Integration
```typescript
const result = await runtime.execute(
  'agent-name',
  'User question',
  {
    sessionId: 'session-123',
    enableMemory: true, // Maintains conversation context
  }
);
```

### Pattern 4: Event Handling
```typescript
// Subscribe to specific events
runtime.on('tool.approval.requested', (event) => {
  // Handle approval request
});

// Subscribe to all events
runtime.onAny((event) => {
  console.log(event.type, event.data);
});
```

### Pattern 5: Multi-Tool Agent
```typescript
@Agent({ name: 'assistant' })
export class Assistant {
  @Tool({ description: 'Search docs' })
  async searchDocs(input: any) { ... }
  
  @Tool({ description: 'Look up user' })
  async lookupUser(input: any) { ... }
  
  @Tool({ description: 'Create ticket' })
  async createTicket(input: any) { ... }
}
```

## Best Practices

### 1. Tool Design
- **Clear descriptions**: Help the LLM understand when to use the tool
- **Structured parameters**: Define all parameters with types and descriptions
- **Structured responses**: Return consistent, well-formatted data
- **Error handling**: Return error information in the response, don't throw

### 2. Approval Workflows
- Use `requiresApproval: true` for:
  - Destructive operations (delete, refund)
  - Financial transactions
  - Data modifications
  - Production deployments
  - External communications

### 3. Memory Usage
- Enable memory for conversational agents
- Use consistent `sessionId` for the same conversation
- Memory automatically persists conversation history, entities, and facts

### 4. RAG Integration
- Enable RAG for knowledge-intensive tasks
- Adjust `ragTopK` based on context window size
- Ensure knowledge base is well-structured and up-to-date

### 5. Event Monitoring
- Subscribe to events for observability
- Log events for debugging and analytics
- Use events for real-time dashboards

### 6. Error Handling
- Tools should return structured errors, not throw
- Use try/catch in tool implementations
- Provide helpful error messages to users

---

### 3. 🚀 Production-Ready Agent
**File**: `production-ready.example.ts`

**Use Case**: Demonstrating production features for enterprise deployments

**Features Demonstrated**:
- **Rate Limiting**: Token bucket algorithm to control request rates
- **Structured Logging**: Multi-level logging with context
- **Metrics Collection**: Performance and usage tracking
- **Retry Logic**: Exponential backoff with jitter
- **Circuit Breaker**: Failure protection and recovery
- **Health Checks**: Component monitoring and status
- **Event Monitoring**: Real-time observability

**Key Learnings**:
- Configuring production-ready agent runtime
- Monitoring agent performance and health
- Implementing resilience patterns
- Tracking metrics and events
- Production deployment best practices

**Run**:
```bash
# After building the package
cd packages/agent && npm run build
cd ../../example
npx ts-node src/agent/production-ready.example.ts
```

**Documentation**: See [PRODUCTION_FEATURES.md](./PRODUCTION_FEATURES.md) for comprehensive guide

---

## Production Considerations

### Production Features (New!)
The agent runtime now includes enterprise-grade production features:

```typescript
import { AgentRuntime, LogLevel } from '@hazeljs/agent';

const runtime = new AgentRuntime({
  // Rate limiting
  rateLimitPerMinute: 60,
  
  // Metrics
  enableMetrics: true,
  
  // Resilience
  enableRetry: true,
  enableCircuitBreaker: true,
  
  // Logging
  logLevel: LogLevel.INFO,
});

// Monitor health
const health = await runtime.healthCheck();

// Get metrics
const metrics = runtime.getMetrics();
console.log(runtime.getMetricsSummary());

// Check rate limiter
const rateLimiter = runtime.getRateLimiterStatus();

// Check circuit breaker
const circuitBreaker = runtime.getCircuitBreakerStatus();
```

See [PRODUCTION_FEATURES.md](./PRODUCTION_FEATURES.md) for complete documentation.

### State Persistence
The current implementation uses in-memory state. For production:

```typescript
// Replace with Redis or database
class RedisStateManager extends AgentStateManager {
  async getContext(executionId: string) {
    return redis.get(`agent:context:${executionId}`);
  }
}

const runtime = new AgentRuntime({
  stateManager: new RedisStateManager(),
});
```

### Approval Workflow
For production, implement a proper approval system:

```typescript
// Store approvals in database
runtime.on('tool.approval.requested', async (event) => {
  await approvalQueue.enqueue({
    requestId: event.data.requestId,
    toolName: event.data.toolName,
    input: event.data.input,
    requestedBy: event.data.userId,
  });
  
  // Notify approvers via Slack, email, etc.
  await notificationService.notifyApprovers(event.data);
});
```

### Observability
Integrate with monitoring systems:

```typescript
runtime.onAny((event) => {
  // Send to monitoring
  metrics.record(`agent.${event.type}`, 1);
  
  // Send to logging
  logger.info('Agent event', { event });
  
  // Send to tracing
  tracer.recordEvent(event);
});
```

## Next Steps

1. **Customize for your use case**: Modify the examples to fit your domain
2. **Add real integrations**: Replace mock services with real APIs
3. **Implement production state**: Use Redis or database for state
4. **Add authentication**: Secure your agents with proper auth
5. **Monitor and optimize**: Use events for observability and optimization

## Support

- **Documentation**: See [README.md](../README.md) and [ARCHITECTURE.md](../ARCHITECTURE.md)
- **Issues**: Report bugs on GitHub
- **Questions**: Ask in GitHub Discussions
