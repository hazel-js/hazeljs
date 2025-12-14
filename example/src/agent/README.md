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
