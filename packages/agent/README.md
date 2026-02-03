# @hazeljs/agent

**AI-native Agent Runtime for HazelJS** - Build stateful, long-running agents with tools, memory, and human-in-the-loop workflows.

## Overview

The Agent Runtime is a core primitive in HazelJS designed for building production-grade AI agents. Unlike stateless request handlers, agents are:

- **Stateful** - Maintain context across multiple steps
- **Long-running** - Execute complex workflows over time
- **Tool-using** - Call functions safely with approval workflows
- **Memory-enabled** - Integrate with persistent memory systems
- **Observable** - Full event system for monitoring and debugging
- **Resumable** - Support pause/resume and human-in-the-loop

## Installation

```bash
npm install @hazeljs/agent @hazeljs/core @hazeljs/rag
```

## Quick Start

### 1. Define an Agent

```typescript
import { Agent, Tool } from '@hazeljs/agent';

@Agent({
  name: 'support-agent',
  description: 'Customer support agent',
  systemPrompt: 'You are a helpful customer support agent.',
  enableMemory: true,
  enableRAG: true,
})
export class SupportAgent {
  @Tool({
    description: 'Look up order information by order ID',
    parameters: [
      {
        name: 'orderId',
        type: 'string',
        description: 'The order ID to lookup',
        required: true,
      },
    ],
  })
  async lookupOrder(input: { orderId: string }) {
    // Your implementation
    return {
      orderId: input.orderId,
      status: 'shipped',
      trackingNumber: 'TRACK123',
    };
  }

  @Tool({
    description: 'Process a refund for an order',
    requiresApproval: true, // Requires human approval
    parameters: [
      {
        name: 'orderId',
        type: 'string',
        description: 'The order ID to refund',
        required: true,
      },
      {
        name: 'amount',
        type: 'number',
        description: 'Refund amount',
        required: true,
      },
    ],
  })
  async processRefund(input: { orderId: string; amount: number }) {
    // Your implementation
    return {
      success: true,
      refundId: 'REF123',
      amount: input.amount,
    };
  }
}
```

### 2. Set Up the Runtime

```typescript
import { AgentRuntime } from '@hazeljs/agent';
import { MemoryManager } from '@hazeljs/rag';
import { AIService } from '@hazeljs/ai';

// Initialize dependencies
const memoryManager = new MemoryManager(/* ... */);
const aiService = new AIService({ provider: 'openai' });

// Create runtime
const runtime = new AgentRuntime({
  memoryManager,
  llmProvider: aiService,
  defaultMaxSteps: 10,
  enableObservability: true,
});

// Register agent
const supportAgent = new SupportAgent();
runtime.registerAgent(SupportAgent);
runtime.registerAgentInstance('support-agent', supportAgent);
```

### 3. Execute the Agent

```typescript
// Execute agent
const result = await runtime.execute(
  'support-agent',
  'I need to check my order status for order #12345',
  {
    sessionId: 'user-session-123',
    userId: 'user-456',
    enableMemory: true,
    enableRAG: true,
  }
);

console.log(result.response);
console.log(`Completed in ${result.steps.length} steps`);
```

### 4. Handle Human-in-the-Loop

```typescript
// Subscribe to approval requests
runtime.on('tool.approval.requested', async (event) => {
  console.log('Approval needed:', event.data);
  
  // Approve or reject
  runtime.approveToolExecution(event.data.requestId, 'admin-user');
  // or
  // runtime.rejectToolExecution(event.data.requestId);
});

// Resume after approval
const resumedResult = await runtime.resume(result.executionId);
```

## Core Concepts

### Agent State Machine

Every agent execution follows a deterministic state machine:

```
idle → thinking → using_tool → thinking → ... → completed
                    ↓
              waiting_for_input
                    ↓
              waiting_for_approval
                    ↓
                 failed
```

### Execution Loop

The agent runtime implements a controlled execution loop:

1. **Load State** - Restore agent context and memory
2. **Load Memory** - Retrieve conversation history
3. **Retrieve RAG** - Get relevant context (optional)
4. **Ask LLM** - Decide next action
5. **Execute Action** - Call tool, ask user, or respond
6. **Persist State** - Save state and memory
7. **Repeat or Finish** - Continue or complete

### Tools

Tools are explicit, auditable capabilities:

```typescript
@Tool({
  description: 'Send an email',
  requiresApproval: true,
  timeout: 30000,
  retries: 2,
  parameters: [
    { name: 'to', type: 'string', required: true },
    { name: 'subject', type: 'string', required: true },
    { name: 'body', type: 'string', required: true },
  ],
})
async sendEmail(input: { to: string; subject: string; body: string }) {
  // Implementation
}
```

**Tool Features:**
- Automatic parameter validation
- Timeout and retry logic
- Approval workflows
- Execution logging
- Error handling

### Memory Integration

Agents automatically integrate with HazelJS Memory:

```typescript
// Memory is automatically persisted
const result = await runtime.execute('agent-name', 'Hello', {
  sessionId: 'session-123',
  enableMemory: true,
});

// Conversation history is maintained
const result2 = await runtime.execute('agent-name', 'What did I just say?', {
  sessionId: 'session-123', // Same session
  enableMemory: true,
});
```

### RAG Integration

Agents can query RAG before reasoning:

```typescript
@Agent({
  name: 'docs-agent',
  enableRAG: true,
  ragTopK: 5,
})
export class DocsAgent {
  // Agent automatically retrieves relevant docs
}
```

## Event System

Subscribe to agent events for observability:

```typescript
import { AgentEventType } from '@hazeljs/agent';

// Execution events
runtime.on(AgentEventType.EXECUTION_STARTED, (event) => {
  console.log('Agent started:', event.data);
});

runtime.on(AgentEventType.EXECUTION_COMPLETED, (event) => {
  console.log('Agent completed:', event.data);
});

// Step events
runtime.on(AgentEventType.STEP_STARTED, (event) => {
  console.log('Step started:', event.data);
});

// Tool events
runtime.on(AgentEventType.TOOL_EXECUTION_STARTED, (event) => {
  console.log('Tool executing:', event.data);
});

runtime.on(AgentEventType.TOOL_APPROVAL_REQUESTED, (event) => {
  console.log('Approval needed:', event.data);
});

// Subscribe to all events
runtime.onAny((event) => {
  console.log('Event:', event.type, event.data);
});
```

## HazelJS Module Integration

Use with HazelJS modules:

```typescript
import { HazelModule } from '@hazeljs/core';
import { AgentModule } from '@hazeljs/agent';
import { RagModule } from '@hazeljs/rag';

@HazelModule({
  imports: [
    RagModule.forRoot({ /* ... */ }),
    AgentModule.forRoot({
      runtime: {
        defaultMaxSteps: 10,
        enableObservability: true,
      },
      agents: [SupportAgent, SalesAgent],
    }),
  ],
})
export class AppModule {}
```

## Advanced Usage

### Pause and Resume

```typescript
// Execute agent
const result = await runtime.execute('agent', 'Start task');

if (result.state === 'waiting_for_input') {
  // Agent is waiting for user input
  const resumed = await runtime.resume(result.executionId, 'User response');
}
```

### Custom Context

```typescript
const result = await runtime.execute('agent', 'Process order', {
  initialContext: {
    userId: '123',
    orderData: { /* ... */ },
  },
});
```

### Tool Policies

```typescript
@Tool({
  description: 'Delete user data',
  requiresApproval: true,
  policy: 'admin-only', // Custom policy
})
async deleteUserData(input: { userId: string }) {
  // Implementation
}
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Agent Runtime                       │
├─────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐            │
│  │   Registry   │  │  State Mgr   │            │
│  └──────────────┘  └──────────────┘            │
│  ┌──────────────┐  ┌──────────────┐            │
│  │   Executor   │  │ Tool Executor│            │
│  └──────────────┘  └──────────────┘            │
│  ┌──────────────┐  ┌──────────────┐            │
│  │    Events    │  │   Context    │            │
│  └──────────────┘  └──────────────┘            │
├─────────────────────────────────────────────────┤
│         Memory Module    │    RAG Module        │
└─────────────────────────────────────────────────┘
```

## Best Practices

### 1. Keep Agents Declarative

```typescript
// ✅ Good - Declarative
@Agent({ name: 'support-agent' })
export class SupportAgent {
  @Tool()
  async lookupOrder(input: { orderId: string }) {
    return this.orderService.find(input.orderId);
  }
}

// ❌ Bad - Business logic in decorator
@Agent({ 
  name: 'support-agent',
  onExecute: async () => { /* complex logic */ }
})
```

### 2. Use Approval for Destructive Actions

```typescript
@Tool({ requiresApproval: true })
async deleteAccount(input: { userId: string }) {
  // Destructive action
}
```

### 3. Design Idempotent Tools

```typescript
@Tool()
async createOrder(input: { orderId: string; items: any[] }) {
  // Check if order exists first
  const existing = await this.findOrder(input.orderId);
  if (existing) return existing;
  
  return this.createNewOrder(input);
}
```

### 4. Handle Errors Gracefully

```typescript
@Tool()
async externalAPICall(input: any) {
  try {
    return await this.api.call(input);
  } catch (error) {
    // Return structured error
    return {
      success: false,
      error: error.message,
    };
  }
}
```

## API Reference

See [API Documentation](./docs/api.md) for complete API reference.

## Examples

- [Customer Support Agent](./examples/support-agent.ts)
- [Sales Agent with Approval](./examples/sales-agent.ts)
- [Multi-Agent System](./examples/multi-agent.ts)
- [RAG-Powered Agent](./examples/rag-agent.ts)

## License

MIT
