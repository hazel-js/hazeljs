# Agent Runtime Architecture

## Overview

The HazelJS Agent Runtime is a production-grade execution engine for stateful AI agents. It implements a controlled execution loop with state persistence, tool execution, memory integration, and human-in-the-loop workflows.

## Core Principles

### 1. Agents are NOT Request Handlers

Traditional frameworks treat requests as stateless:
```
Request → Handler → Response
```

Agents are stateful entities with lifecycle:
```
Input → [Think → Act → Remember] × N → Output
```

### 2. Explicit Tool System

Tools are NOT arbitrary function calls. They are:
- **Registered** - Explicitly declared and discoverable
- **Auditable** - All executions are logged
- **Controllable** - Can require approval
- **Reliable** - Timeout and retry logic

### 3. Deterministic Execution

Every agent execution:
- Has a unique execution ID
- Follows a state machine
- Can be paused and resumed
- Is fully observable

### 4. Memory-First Design

Agents integrate with persistent memory:
- Conversation history
- Entity tracking
- Fact storage
- Working memory (temporary context)

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
│  @Agent decorators, @Tool decorators, Agent classes     │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                     Runtime Layer                        │
│  AgentRuntime - Lifecycle management, orchestration     │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    Execution Layer                       │
│  AgentExecutor - Execution loop, step management        │
│  ToolExecutor - Tool execution, approval workflow       │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                      State Layer                         │
│  AgentStateManager - State persistence                  │
│  AgentContextBuilder - Context preparation              │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    Registry Layer                        │
│  AgentRegistry - Agent registration                     │
│  ToolRegistry - Tool registration                       │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                    │
│  Memory Module (RAG), LLM Provider, Event System        │
└─────────────────────────────────────────────────────────┘
```

## Component Details

### AgentRuntime

**Responsibility**: Lifecycle management and orchestration

**Key Methods**:
- `registerAgent()` - Register agent class
- `registerAgentInstance()` - Register agent instance
- `execute()` - Execute agent with input
- `resume()` - Resume paused execution
- `on()` - Subscribe to events

**Design Pattern**: Facade pattern - provides simple interface to complex subsystem

### AgentExecutor

**Responsibility**: Core execution loop

**Execution Flow**:
```typescript
1. Load agent context
2. Build context with memory/RAG
3. Enter execution loop:
   a. Execute step
   b. Decide next action (via LLM)
   c. Execute action (tool/respond/wait)
   d. Persist state
   e. Check continuation conditions
4. Return result
```

**Design Pattern**: Template Method - defines algorithm skeleton

### ToolExecutor

**Responsibility**: Tool execution with approval workflow

**Execution Flow**:
```typescript
1. Create execution context
2. Check if approval required
   → If yes: Request approval, wait
   → If no: Continue
3. Execute with retry logic
4. Handle timeout
5. Return result
```

**Design Pattern**: Chain of Responsibility - approval pipeline

### AgentStateManager

**Responsibility**: State persistence and transitions

**State Machine**:
```
idle → thinking → using_tool → thinking → completed
          ↓           ↓
   waiting_for_input  waiting_for_approval
          ↓           ↓
       failed      failed
```

**Design Pattern**: State pattern - encapsulates state transitions

### Registries

**AgentRegistry**: Maps agent names to metadata and instances
**ToolRegistry**: Maps tool names to metadata and methods

**Design Pattern**: Registry pattern - centralized lookup

## Data Flow

### Agent Execution

```
User Input
    ↓
AgentRuntime.execute()
    ↓
Create AgentContext
    ↓
Load Memory (conversation history, entities, facts)
    ↓
Retrieve RAG Context (optional)
    ↓
AgentExecutor.execute()
    ↓
┌─────────────────────────────────┐
│      Execution Loop             │
│  ┌──────────────────────────┐   │
│  │ 1. Execute Step          │   │
│  │ 2. Decide Next Action    │   │
│  │    (via LLM)             │   │
│  │ 3. Execute Action        │   │
│  │    - Use Tool            │   │
│  │    - Ask User            │   │
│  │    - Respond             │   │
│  │ 4. Update State          │   │
│  │ 5. Check Continue        │   │
│  └──────────────────────────┘   │
│         ↓ (repeat)              │
└─────────────────────────────────┘
    ↓
Persist to Memory
    ↓
Return AgentExecutionResult
```

### Tool Execution

```
Tool Call Request
    ↓
ToolExecutor.execute()
    ↓
Check requiresApproval
    ↓ (if true)
Emit TOOL_APPROVAL_REQUESTED
    ↓
Wait for Approval
    ↓ (approved)
Execute with Timeout
    ↓
Retry on Failure (if configured)
    ↓
Emit TOOL_EXECUTION_COMPLETED
    ↓
Return ToolExecutionResult
```

## Event System

### Event Types

**Execution Events**:
- `EXECUTION_STARTED`
- `EXECUTION_COMPLETED`
- `EXECUTION_FAILED`

**Step Events**:
- `STEP_STARTED`
- `STEP_COMPLETED`
- `STEP_FAILED`

**Tool Events**:
- `TOOL_EXECUTION_STARTED`
- `TOOL_EXECUTION_COMPLETED`
- `TOOL_EXECUTION_FAILED`
- `TOOL_APPROVAL_REQUESTED`
- `TOOL_APPROVAL_GRANTED`
- `TOOL_APPROVAL_DENIED`

**User Interaction Events**:
- `USER_INPUT_REQUESTED`
- `USER_INPUT_RECEIVED`

**Memory Events**:
- `MEMORY_UPDATED`
- `RAG_QUERY_EXECUTED`

### Event Flow

```
AgentExecutor/ToolExecutor
    ↓ (emit)
AgentEventEmitter
    ↓ (notify)
Registered Handlers
    ↓
Application Logic (logging, monitoring, UI updates)
```

## Memory Integration

### Memory Types

1. **Conversation Memory**: Message history
2. **Entity Memory**: Tracked entities (people, places, things)
3. **Fact Memory**: Persistent knowledge
4. **Working Memory**: Temporary context

### Integration Points

**Before Execution**:
```typescript
contextBuilder.buildWithMemory(context)
  → Load conversation history
  → Load entities
  → Load working memory
```

**After Execution**:
```typescript
contextBuilder.persistToMemory(context)
  → Save messages
  → Update entities
  → Save working memory
```

## RAG Integration

### Integration Flow

```
User Input
    ↓
contextBuilder.buildWithRAG(context, ragService)
    ↓
ragService.search(input, { topK: 5 })
    ↓
context.ragContext = results
    ↓
LLM receives context in system prompt
```

### Usage in Prompt

```typescript
systemPrompt = basePrompt + '\n\nRelevant context:\n' + ragContext.join('\n\n')
```

## Human-in-the-Loop

### Approval Workflow

```
Tool Execution Request
    ↓
Check tool.requiresApproval
    ↓ (true)
Create ToolApprovalRequest
    ↓
Store in pendingApprovals Map
    ↓
Emit TOOL_APPROVAL_REQUESTED
    ↓
Wait (polling every 1s)
    ↓
User calls runtime.approveToolExecution()
    ↓
Remove from pendingApprovals
    ↓
Continue execution
```

### Pause/Resume

```
Agent execution paused (waiting_for_input)
    ↓
State saved in AgentStateManager
    ↓
User provides input
    ↓
runtime.resume(executionId, input)
    ↓
Load context from state
    ↓
Add user message to memory
    ↓
Continue execution loop
```

## Error Handling

### Levels

1. **Tool Level**: Try/catch in tool execution, retry logic
2. **Step Level**: Catch step errors, mark step as failed
3. **Execution Level**: Catch execution errors, mark execution as failed
4. **Runtime Level**: Catch all errors, emit events

### Error Propagation

```
Tool throws error
    ↓
ToolExecutor catches, returns { success: false, error }
    ↓
AgentExecutor receives failed result
    ↓
Step marked as failed
    ↓
Execution continues or fails based on error type
    ↓
Event emitted: STEP_FAILED or EXECUTION_FAILED
```

## Observability

### Built-in Observability

1. **Event System**: All actions emit events
2. **State Tracking**: Full state history
3. **Step Recording**: Every step is recorded
4. **Execution Context**: Complete context available

### Monitoring Points

```typescript
// Execution metrics
runtime.on(AgentEventType.EXECUTION_COMPLETED, (event) => {
  metrics.record('agent.execution.duration', event.data.duration);
  metrics.record('agent.execution.steps', event.data.steps);
});

// Tool metrics
runtime.on(AgentEventType.TOOL_EXECUTION_COMPLETED, (event) => {
  metrics.record('tool.execution.duration', event.data.duration);
  metrics.increment('tool.execution.count', { tool: event.data.toolName });
});

// Error tracking
runtime.on(AgentEventType.EXECUTION_FAILED, (event) => {
  errorTracker.capture(event.data.error);
});
```

## Scalability Considerations

### Current Implementation

- **In-Memory State**: AgentStateManager uses Map
- **In-Memory Approvals**: ToolExecutor uses Map
- **Single Process**: No distributed coordination

### Production Recommendations

1. **State Persistence**: Replace Map with Redis/Database
2. **Distributed Approvals**: Use message queue (Redis Pub/Sub, RabbitMQ)
3. **Execution Queue**: Use job queue for long-running agents
4. **Event Bus**: Replace in-memory emitter with distributed event bus

### Scaling Pattern

```typescript
// Replace in-memory state with Redis
class RedisStateManager extends AgentStateManager {
  async getContext(executionId: string) {
    return redis.get(`agent:context:${executionId}`);
  }
  
  async updateState(executionId: string, state: AgentState) {
    await redis.hset(`agent:context:${executionId}`, 'state', state);
  }
}
```

## Security Considerations

### Tool Execution

1. **Approval Workflow**: Destructive actions require approval
2. **Timeout**: Prevent hanging executions
3. **Retry Limits**: Prevent infinite loops
4. **Input Validation**: Validate tool parameters

### State Management

1. **Session Isolation**: Contexts isolated by sessionId
2. **User Isolation**: Optional userId for multi-tenant
3. **Context Cleanup**: Delete contexts after completion

### Memory Access

1. **Session Scoping**: Memory scoped to sessionId
2. **User Scoping**: Memory scoped to userId
3. **Access Control**: Implement in Memory layer

## Testing Strategy

### Unit Tests

- Test each component in isolation
- Mock dependencies
- Test state transitions
- Test error handling

### Integration Tests

- Test component interactions
- Test execution flow
- Test memory integration
- Test RAG integration

### E2E Tests

- Test complete agent execution
- Test approval workflow
- Test pause/resume
- Test error scenarios

## Extension Points

### Custom State Persistence

```typescript
class CustomStateManager extends AgentStateManager {
  // Override methods
}

const runtime = new AgentRuntime({
  stateManager: new CustomStateManager(),
});
```

### Custom Tool Executor

```typescript
class CustomToolExecutor extends ToolExecutor {
  // Add custom logic
}
```

### Custom Event Handlers

```typescript
runtime.onAny((event) => {
  // Custom event handling
  sendToMonitoring(event);
  logToDatabase(event);
});
```

## Future Enhancements

1. **Durable Execution**: Persist execution state to survive crashes
2. **Multi-Agent Coordination**: Agents calling other agents
3. **Streaming Responses**: Stream LLM responses in real-time
4. **Policy Engine**: Advanced authorization for tools
5. **Agent Marketplace**: Shareable agent templates
6. **Visual Debugger**: UI for debugging agent execution

## Conclusion

The HazelJS Agent Runtime is designed as a production-grade, extensible system for building stateful AI agents. It follows framework-level design principles:

- **Separation of Concerns**: Clear layer boundaries
- **Extensibility**: Multiple extension points
- **Observability**: Built-in event system
- **Reliability**: Error handling and retry logic
- **Scalability**: Designed for production use

The architecture prioritizes correctness, observability, and developer experience over brevity.
