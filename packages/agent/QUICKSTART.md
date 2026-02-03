# HazelJS Agent Runtime - Quick Start

## Installation

```bash
npm install @hazeljs/agent @hazeljs/core @hazeljs/rag
```

## 5-Minute Quick Start

### Step 1: Define Your Agent

```typescript
import { Agent, Tool } from '@hazeljs/agent';

@Agent({
  name: 'my-agent',
  description: 'My first AI agent',
  enableMemory: true,
})
export class MyAgent {
  @Tool({
    description: 'Get current time',
  })
  async getCurrentTime() {
    return { time: new Date().toISOString() };
  }

  @Tool({
    description: 'Calculate sum of two numbers',
    parameters: [
      { name: 'a', type: 'number', required: true },
      { name: 'b', type: 'number', required: true },
    ],
  })
  async add(input: { a: number; b: number }) {
    return { result: input.a + input.b };
  }
}
```

### Step 2: Initialize Runtime

```typescript
import { AgentRuntime } from '@hazeljs/agent';

const runtime = new AgentRuntime({
  llmProvider: yourLLMProvider, // OpenAI, Anthropic, etc.
  defaultMaxSteps: 10,
});
```

### Step 3: Register Agent

```typescript
const myAgent = new MyAgent();
runtime.registerAgent(MyAgent);
runtime.registerAgentInstance('my-agent', myAgent);
```

### Step 4: Execute

```typescript
const result = await runtime.execute(
  'my-agent',
  'What time is it and what is 5 + 3?',
  {
    sessionId: 'user-session-123',
    enableMemory: true,
  }
);

console.log(result.response);
// "The current time is 2024-12-13T15:30:00Z and 5 + 3 equals 8."
```

## Key Concepts

### Agents
Stateful entities that execute over multiple steps with memory and tools.

### Tools
Functions that agents can call, with optional approval workflows.

### Memory
Automatic conversation history and context persistence.

### State Machine
Agents transition through states: idle → thinking → using_tool → completed

### Events
Subscribe to execution events for monitoring and debugging.

## Next Steps

- Read the [full README](./README.md)
- Check the [architecture guide](./ARCHITECTURE.md)
- Explore [examples](./examples/)
- Learn about [human-in-the-loop workflows](./README.md#human-in-the-loop)

## Common Patterns

### Tool with Approval
```typescript
@Tool({
  description: 'Delete user account',
  requiresApproval: true, // Requires human approval
})
async deleteAccount(input: { userId: string }) {
  // Implementation
}
```

### Subscribe to Events
```typescript
runtime.on('tool.approval.requested', (event) => {
  console.log('Approval needed:', event.data);
  runtime.approveToolExecution(event.data.requestId, 'admin');
});
```

### Pause and Resume
```typescript
const result = await runtime.execute('agent', 'Start task');

if (result.state === 'waiting_for_input') {
  const resumed = await runtime.resume(result.executionId, 'User input');
}
```

## Support

- GitHub Issues: [Report bugs](https://github.com/hazeljs/hazeljs/issues)
- Documentation: [Full docs](./README.md)
- Examples: [Working examples](./examples/)
