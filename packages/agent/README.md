# @hazeljs/agent

**Build AI agents that actually do things.**

Stateful, tool-using, memory-enabled. Define tools with `@Tool`, delegate between agents with `@Delegate`, orchestrate multi-agent pipelines with `AgentGraph`, and route tasks automatically with `SupervisorAgent`. Production-grade agent infrastructure without the complexity.

[![npm version](https://img.shields.io/npm/v/@hazeljs/agent.svg)](https://www.npmjs.com/package/@hazeljs/agent)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/agent)](https://www.npmjs.com/package/@hazeljs/agent)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Overview

Unlike stateless request handlers, agents are:

- **Stateful** — Maintain context across multiple steps and sessions
- **Long-running** — Execute complex, multi-hop workflows over time
- **Tool-using** — Call functions safely with timeout, retry, and approval workflows
- **Multi-agent** — Orchestrate teams of specialised agents with `AgentGraph`, `SupervisorAgent`, and `@Delegate`
- **Memory-enabled** — Integrate with persistent memory systems
- **Observable** — Full event system for monitoring and debugging
- **Resumable** — Support pause/resume and human-in-the-loop

---

## Installation

```bash
npm install @hazeljs/agent @hazeljs/core @hazeljs/rag
```

---

## Quick Start — Single Agent

### 1. Define an agent

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
    parameters: [{ name: 'orderId', type: 'string', description: 'The order ID', required: true }],
  })
  async lookupOrder(input: { orderId: string }) {
    return { orderId: input.orderId, status: 'shipped', trackingNumber: 'TRACK123' };
  }

  @Tool({
    description: 'Process a refund for an order',
    requiresApproval: true,   // requires human approval before execution
    parameters: [
      { name: 'orderId', type: 'string', required: true },
      { name: 'amount',  type: 'number', required: true },
    ],
  })
  async processRefund(input: { orderId: string; amount: number }) {
    return { success: true, refundId: 'REF123', amount: input.amount };
  }
}
```

### 2. Set up the runtime

```typescript
import { AgentRuntime } from '@hazeljs/agent';
import { MemoryManager } from '@hazeljs/rag';
import { AIService } from '@hazeljs/ai';

const runtime = new AgentRuntime({
  memoryManager: new MemoryManager(/* ... */),
  llmProvider: new AIService({ provider: 'openai' }),
  defaultMaxSteps: 10,
  enableObservability: true,
});

const agent = new SupportAgent();
runtime.registerAgent(SupportAgent);
runtime.registerAgentInstance('support-agent', agent);
```

### 3. Execute

```typescript
const result = await runtime.execute(
  'support-agent',
  'I need to check my order #12345',
  { sessionId: 'user-session-123', userId: 'user-456', enableMemory: true },
);

console.log(result.response);
console.log(`Completed in ${result.steps.length} steps`);
```

### 4. Handle human-in-the-loop

```typescript
runtime.on('tool.approval.requested', async (event) => {
  console.log('Approval needed:', event.data);
  runtime.approveToolExecution(event.data.requestId, 'admin-user');
});

const resumed = await runtime.resume(result.executionId);
```

---

## Multi-Agent Orchestration

`@hazeljs/agent` ships three complementary patterns for coordinating multiple agents. Use them individually or combine them.

### Pattern 1 — `@Delegate`: peer-to-peer agent calls

`@Delegate` marks a method on an agent as a delegation point to another agent. The method body is replaced at runtime with an actual `runtime.execute(targetAgent, input)` call — making agent-to-agent communication completely transparent to the LLM (it sees delegation targets as ordinary tools).

```
OrchestratorAgent
   └── @Delegate → ResearchAgent
   └── @Delegate → WriterAgent
```

```typescript
import { Agent, Delegate } from '@hazeljs/agent';

@Agent({
  name: 'OrchestratorAgent',
  description: 'Plans and delegates research and writing tasks',
  systemPrompt: 'You orchestrate research and writing. Use the available tools to complete tasks.',
})
export class OrchestratorAgent {
  // The LLM sees this as a tool. At runtime it calls ResearchAgent.
  @Delegate({
    agent: 'ResearchAgent',
    description: 'Research a topic thoroughly and return key findings',
    inputField: 'query',
  })
  async researchTopic(query: string): Promise<string> {
    return ''; // body replaced at runtime by AgentRuntime
  }

  // The LLM sees this as a tool. At runtime it calls WriterAgent.
  @Delegate({
    agent: 'WriterAgent',
    description: 'Write a polished article from the provided research notes',
    inputField: 'content',
  })
  async writeArticle(content: string): Promise<string> {
    return ''; // body replaced at runtime by AgentRuntime
  }
}

@Agent({ name: 'ResearchAgent', systemPrompt: 'You are an expert researcher.' })
export class ResearchAgent {
  @Tool({ description: 'Search the web', parameters: [{ name: 'query', type: 'string', required: true }] })
  async searchWeb(input: { query: string }) {
    return `Research findings for: ${input.query}`;
  }
}

@Agent({ name: 'WriterAgent', systemPrompt: 'You are a professional technical writer.' })
export class WriterAgent {
  @Tool({ description: 'Format content as Markdown', parameters: [{ name: 'raw', type: 'string', required: true }] })
  async formatMarkdown(input: { raw: string }) {
    return `## Article\n\n${input.raw}`;
  }
}
```

**Registration:**

```typescript
const orchestrator = new OrchestratorAgent();
const researcher  = new ResearchAgent();
const writer      = new WriterAgent();

[ResearchAgent, WriterAgent, OrchestratorAgent].forEach(A => runtime.registerAgent(A));
[['OrchestratorAgent', orchestrator], ['ResearchAgent', researcher], ['WriterAgent', writer]]
  .forEach(([name, inst]) => runtime.registerAgentInstance(name as string, inst));

const result = await runtime.execute('OrchestratorAgent', 'Write a blog post about LLMs');
console.log(result.response);
```

> **Note:** `@Delegate` implicitly registers the method as `@Tool`. Do not add `@Tool` separately.

---

### Pattern 2 — `AgentGraph`: DAG pipelines

`AgentGraph` lets you wire agents and functions into a directed acyclic graph with sequential edges, conditional routing, and parallel fan-out/fan-in. Think LangGraph but TypeScript-native and integrated with `AgentRuntime`.

```
Entry → NodeA → NodeB → END              (sequential)
Entry → RouterNode → NodeA | NodeB → END (conditional)
Entry → Splitter → [NodeA ‖ NodeB] → Combiner → END (parallel)
```

```typescript
import { END } from '@hazeljs/agent';

// Create graph via the runtime
const graph = runtime.createGraph('research-pipeline');
```

#### Sequential pipeline

```typescript
const pipeline = runtime
  .createGraph('blog-pipeline')
  .addNode('researcher', { type: 'agent', agentName: 'ResearchAgent' })
  .addNode('writer',     { type: 'agent', agentName: 'WriterAgent' })
  .addEdge('researcher', 'writer')
  .addEdge('writer', END)
  .setEntryPoint('researcher')
  .compile();

const result = await pipeline.execute('Write a blog post about TypeScript generics');
console.log(result.output);
```

#### Conditional routing

```typescript
const router = runtime
  .createGraph('router')
  .addNode('classifier', { type: 'agent', agentName: 'ClassifierAgent' })
  .addNode('coder',      { type: 'agent', agentName: 'CoderAgent' })
  .addNode('writer',     { type: 'agent', agentName: 'WriterAgent' })
  .setEntryPoint('classifier')
  .addConditionalEdge('classifier', (state) =>
    state.data?.type === 'code' ? 'coder' : 'writer',
  )
  .addEdge('coder',  END)
  .addEdge('writer', END)
  .compile();

const result = await router.execute('Write a sorting algorithm in TypeScript');
```

#### Parallel fan-out / fan-in

```typescript
async function splitTask(state: GraphState) {
  return { ...state, data: { ...state.data, split: true } };
}

async function mergeResults(state: GraphState) {
  const results = state.data?.branchResults as ParallelBranchResult[];
  return { ...state, output: results.map(r => r.output).join('\n---\n') };
}

const parallel = runtime
  .createGraph('parallel-research')
  .addNode('splitter',    { type: 'function', fn: splitTask })
  .addNode('parallel-1', { type: 'parallel', branches: ['tech-researcher', 'market-researcher'] })
  .addNode('tech-researcher',   { type: 'agent', agentName: 'TechResearchAgent' })
  .addNode('market-researcher', { type: 'agent', agentName: 'MarketResearchAgent' })
  .addNode('combiner',   { type: 'function', fn: mergeResults })
  .addEdge('splitter',   'parallel-1')
  .addEdge('parallel-1', 'combiner')
  .addEdge('combiner',    END)
  .setEntryPoint('splitter')
  .compile();

const result = await parallel.execute('Analyse the AI framework market');
```

#### Streaming execution

```typescript
for await (const chunk of pipeline.stream('Tell me about GraphRAG')) {
  if (chunk.type === 'node_complete') {
    console.log(`✓ ${chunk.nodeId}: ${chunk.output?.slice(0, 80)}...`);
  }
}
```

#### `AgentGraph` API

```typescript
interface AgentGraph {
  addNode(id: string, config: GraphNodeConfig): this;
  addEdge(from: string, to: string): this;
  addConditionalEdge(from: string, router: RouterFunction): this;
  setEntryPoint(nodeId: string): this;
  compile(): CompiledGraph;
}

interface CompiledGraph {
  execute(input: string, options?: GraphExecutionOptions): Promise<GraphExecutionResult>;
  stream(input: string, options?: GraphExecutionOptions): AsyncIterable<GraphStreamChunk>;
  visualize(): string;   // returns a Mermaid diagram string
}
```

---

### Pattern 3 — `SupervisorAgent`: LLM-driven routing

`SupervisorAgent` uses an LLM to decompose tasks into subtasks, route each subtask to the best worker agent, and accumulate results — continuing until the task is complete or `maxRounds` is reached.

```
User Task
    │
Supervisor  ←──────────────────────────┐
    │                                   │
┌───▼────────────────┐           Worker result
│  Route to worker?  │                  │
└───────────┬────────┘                  │
            │                           │
     ┌──────▼──────┐                    │
     │ WorkerAgent │───────────────────┘
     └─────────────┘
```

```typescript
const supervisor = runtime.createSupervisor({
  name: 'project-manager',
  workers: ['ResearchAgent', 'CoderAgent', 'WriterAgent'],
  maxRounds: 6,
  llm: async (prompt) => {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    });
    return res.choices[0].message.content ?? '';
  },
});

const result = await supervisor.run(
  'Build and document a REST API for a todo app',
  { sessionId: 'proj-001' },
);

console.log(result.response);
result.rounds.forEach((round, i) => {
  console.log(`Round ${i + 1}: routed to ${round.worker} — ${round.workerResult.response.slice(0, 80)}`);
});
```

**`SupervisorConfig`:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | — | Supervisor instance name |
| `workers` | string[] | — | Registered agent names available to the supervisor |
| `maxRounds` | number | 5 | Maximum routing iterations |
| `llm` | `(prompt: string) => Promise<string>` | — | LLM function for routing decisions |
| `sessionId` | string | auto | Session for memory continuity across rounds |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        AgentRuntime                              │
├──────────────┬───────────────┬───────────────┬───────────────────┤
│   Registry   │  State Mgr    │   Executor    │  Tool Executor    │
│  (agents,    │  (in-mem /    │  (step loop,  │  (timeout,        │
│   tools)     │   Redis / DB) │   approval)   │   retry, audit)   │
├──────────────┴───────────────┴───────────────┴───────────────────┤
│                  Multi-Agent Layer                                │
│  ┌──────────────┐  ┌───────────────────┐  ┌────────────────────┐ │
│  │  AgentGraph  │  │  SupervisorAgent  │  │  @Delegate         │ │
│  │  (DAG pipes) │  │  (LLM routing)    │  │  (peer-to-peer)    │ │
│  └──────────────┘  └───────────────────┘  └────────────────────┘ │
├────────────────────────────────────────────────────────────────── ┤
│         Memory Module (@hazeljs/rag)  │  RAG Module               │
└──────────────────────────────────────────────────────────────────┘
```

---

## State Machine

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

---

## Event System

```typescript
import { AgentEventType } from '@hazeljs/agent';

runtime.on(AgentEventType.EXECUTION_STARTED,   e => console.log('started:',    e.data));
runtime.on(AgentEventType.EXECUTION_COMPLETED, e => console.log('completed:',  e.data));
runtime.on(AgentEventType.STEP_STARTED,        e => console.log('step:',       e.data));
runtime.on(AgentEventType.TOOL_EXECUTION_STARTED,   e => console.log('tool:',  e.data));
runtime.on(AgentEventType.TOOL_APPROVAL_REQUESTED,  e => {
  console.log('approval needed:', e.data);
  runtime.approveToolExecution(e.data.requestId, 'admin');
});

// Catch-all
runtime.onAny(e => console.log(e.type, e.data));
```

---

## HazelJS Module Integration

```typescript
import { HazelModule } from '@hazeljs/core';
import { AgentModule } from '@hazeljs/agent';
import { RagModule } from '@hazeljs/rag';

@HazelModule({
  imports: [
    RagModule.forRoot({ /* ... */ }),
    AgentModule.forRoot({
      runtime: { defaultMaxSteps: 10, enableObservability: true },
      agents: [SupportAgent, ResearchAgent, WriterAgent, OrchestratorAgent],
    }),
  ],
})
export class AppModule {}
```

---

## Best Practices

### Keep tools idempotent

```typescript
@Tool({ description: 'Create an order' })
async createOrder(input: { orderId: string; items: Item[] }) {
  const existing = await this.findOrder(input.orderId);
  if (existing) return existing;            // safe to retry
  return this.createNewOrder(input);
}
```

### Use `@Delegate` for domain specialisation

Keep each agent focused on one domain. `@Delegate` lets the orchestrator combine specialists without any agent becoming a monolith.

### Choose the right multi-agent pattern

| Pattern | Use when |
|---------|----------|
| `@Delegate` | Two or three agents with a clear orchestrator / worker split |
| `AgentGraph` | Workflow is known at design time; conditional routing matters |
| `SupervisorAgent` | Task decomposition is dynamic; you want LLM-driven routing |

### Require approval for destructive actions

```typescript
@Tool({ requiresApproval: true, description: 'Delete user account' })
async deleteAccount(input: { userId: string }) { /* ... */ }
```

### Handle errors in tools

```typescript
@Tool({ description: 'Call external API' })
async callExternalAPI(input: { endpoint: string }) {
  try {
    return await this.api.call(input.endpoint);
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
```

---

## API Reference

### `AgentRuntime`

```typescript
class AgentRuntime {
  execute(agentName: string, input: string, options?: ExecuteOptions): Promise<AgentExecutionResult>;
  resume(executionId: string, input?: string): Promise<AgentExecutionResult>;
  registerAgent(agentClass: new (...args: unknown[]) => unknown): void;
  registerAgentInstance(name: string, instance: unknown): void;
  createGraph(name: string): AgentGraph;
  createSupervisor(config: SupervisorConfig): SupervisorAgent;
  approveToolExecution(requestId: string, approvedBy: string): void;
  rejectToolExecution(requestId: string, reason?: string): void;
  on(event: string, handler: (e: AgentEvent) => void): void;
  onAny(handler: (e: AgentEvent) => void): void;
}
```

### Decorators

| Decorator | Target | Description |
|-----------|--------|-------------|
| `@Agent(config)` | Class | Declares a class as an agent |
| `@Tool(config)` | Method | Exposes a method as an LLM-callable tool |
| `@Delegate(config)` | Method | Delegates a method to another agent (registers as `@Tool` automatically) |

### `GraphNodeConfig` types

```typescript
// Agent node — runs a registered agent
{ type: 'agent', agentName: string }

// Function node — runs a custom function
{ type: 'function', fn: (state: GraphState) => Promise<GraphState> }

// Parallel node — fans out to multiple branches simultaneously
{ type: 'parallel', branches: string[] }
```

---

## Examples

- [hazeljs-ai-multiagent-starter](../../hazeljs-ai-multiagent-starter) — Full multi-agent REST API with `AgentGraph`, `SupervisorAgent`, and `@Delegate`
- [hazeljs-rag-documents-starter](../../hazeljs-rag-documents-starter) — RAG + GraphRAG knowledge base API

---

## License

Apache 2.0

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.
