# @hazeljs/mcp

**Expose your HazelJS tools to any AI IDE — in one function call.**

Any method decorated with `@Tool()` becomes an MCP tool callable by Cursor, Claude Desktop, or any MCP-compatible AI client. No HTTP server, no API spec, no platform SDK. Just STDIO.

[![npm version](https://img.shields.io/npm/v/@hazeljs/mcp.svg)](https://www.npmjs.com/package/@hazeljs/mcp)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/mcp)](https://www.npmjs.com/package/@hazeljs/mcp)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **One-line integration** — pass your `ToolRegistry` to `createMcpServer()` and call `listenStdio()`
- **Zero extra dependencies** — no MCP SDK required; protocol implemented from scratch in ~200 lines
- **Works with `@hazeljs/agent`** — `ToolRegistry` satisfies `IToolRegistry` without any cast
- **Standalone mode** — implement `IToolRegistry` directly, no decorators needed
- **Concurrent tool calls** — async STDIO transport handles parallel requests without blocking
- **Never crashes** — every JSON parse error, unknown method, and tool exception returns a typed JSON-RPC error response
- **Transport-agnostic core** — the adapter and router are reusable for HTTP / SSE transports

---

## Installation

```bash
npm install @hazeljs/mcp
```

---

## Quick Start — with `@hazeljs/agent`

### 1. Define tools on an agent class

```typescript
import 'reflect-metadata';
import { Tool } from '@hazeljs/agent';

export class SupportAgent {
  @Tool({
    name: 'lookup_customer',
    description: 'Find a customer by email address',
    parameters: [{ name: 'email', type: 'string', description: 'Customer email', required: true }],
  })
  async lookupCustomer(input: Record<string, unknown>) {
    // replace with your real DB query
    return { id: 'cust_001', name: 'Alice', plan: 'pro' };
  }

  @Tool({
    name: 'create_ticket',
    description: 'Open a new support ticket',
    parameters: [
      { name: 'customer_id', type: 'string', description: 'Customer ID', required: true },
      { name: 'subject',     type: 'string', description: 'Ticket subject', required: true },
    ],
  })
  async createTicket(input: Record<string, unknown>) {
    return { id: 'TKT-1001', status: 'open' };
  }
}
```

### 2. Register the agent and create the server

```typescript
// reflect-metadata must be the first import
import 'reflect-metadata';

import { ToolRegistry } from '@hazeljs/agent';
import { createMcpServer } from '@hazeljs/mcp';
import { SupportAgent } from './agents/SupportAgent';

const registry = new ToolRegistry();
registry.registerAgentTools('support', new SupportAgent());

const server = createMcpServer({
  name: 'hazel-support-agent',
  version: '1.0.0',
  toolRegistry: registry,
});

server.listenStdio();
```

### 3. Connect to Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "hazel-support": {
      "command": "node",
      "args": ["dist/main.js"]
    }
  }
}
```

Reload Cursor. Your `@Tool()` methods now appear in the AI's tool palette.

---

## Quick Start — standalone (no decorators)

Implement `IToolRegistry` directly when you don't use `@hazeljs/agent`:

```typescript
import { createMcpServer } from '@hazeljs/mcp';
import type { IToolRegistry, HazelTool } from '@hazeljs/mcp';

class SimpleRegistry implements IToolRegistry {
  private tools = new Map<string, HazelTool>();

  register(tool: HazelTool) { this.tools.set(tool.name, tool); }
  getAllTools()             { return [...this.tools.values()]; }
  getTool(name: string)    { return this.tools.get(name); }
  hasTool(name: string)    { return this.tools.has(name); }
}

const registry = new SimpleRegistry();

registry.register({
  name: 'add',
  description: 'Returns the sum of two numbers',
  parameters: [
    { name: 'a', type: 'number', description: 'First operand',  required: true },
    { name: 'b', type: 'number', description: 'Second operand', required: true },
  ],
  target: {},
  method: async (input: { a: number; b: number }) => ({ result: input.a + input.b }),
});

const server = createMcpServer({ name: 'my-server', version: '1.0.0', toolRegistry: registry });
server.listenStdio();
```

---

## Connecting to MCP Clients

### Cursor

```json
{
  "mcpServers": {
    "my-hazel-server": {
      "command": "node",
      "args": ["/absolute/path/to/dist/main.js"]
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "my-hazel-server": {
      "command": "node",
      "args": ["/absolute/path/to/dist/main.js"]
    }
  }
}
```

---

## Use Cases

### Customer support agent

AI assistant in Cursor looks up customers, checks orders, and files tickets — all via real backend calls:

```typescript
// AI does this automatically when you ask:
// "Alice says her order hasn't arrived. Check the status and open a ticket."

await adapter.invoke('lookup_customer',  { email: 'alice@example.com' });
await adapter.invoke('get_order_status', { order_id: 'ORD-1001' });
await adapter.invoke('create_ticket',    { customer_id: 'cust_001', subject: 'Order not arrived' });
```

### On-call runbook automation

Expose diagnostic tools to Claude Desktop. The AI runs queries and drafts incident reports without the engineer switching terminals:

```typescript
@Tool({ name: 'get_error_rate', description: 'Fetch error rate for a service in the last N minutes' })
async getErrorRate(input: { service: string; minutes: number }) { ... }

@Tool({ name: 'list_recent_deploys', description: 'List deployments in the last hour' })
async listRecentDeploys(input: { limit: number }) { ... }
```

### Internal admin operations

Expose admin actions safely over STDIO (local process only — not network-accessible):

```typescript
@Tool({ name: 'reset_user_password', description: 'Reset password and send email', requiresApproval: true })
async resetPassword(input: { userId: string }) { ... }

@Tool({ name: 'export_user_data', description: 'Generate a GDPR export for a user' })
async exportUserData(input: { userId: string }) { ... }
```

---

## Hazel → MCP field mapping

| Hazel (`ToolMetadata`) | MCP (`McpToolDefinition`) |
|---|---|
| `name` | `name` |
| `description` | `description` |
| `parameters[].name` | `inputSchema.properties.<key>` |
| `parameters[].type` | `inputSchema.properties.<key>.type` |
| `parameters[].description` | `inputSchema.properties.<key>.description` |
| `parameters[].enum` | `inputSchema.properties.<key>.enum` |
| `parameters[].required` | `inputSchema.required[]` |

If a tool has no `parameters`, an open schema is emitted that accepts any JSON object.

---

## API Reference

### `createMcpServer(options)`

```typescript
function createMcpServer(options: McpServerOptions): McpServer;

interface McpServerOptions {
  name: string;           // server name advertised during MCP initialize
  version: string;        // server version advertised during MCP initialize
  toolRegistry: IToolRegistry;
}

interface McpServer {
  listenStdio(): void;              // attach to process.stdin / process.stdout
  listTools(): McpToolDefinition[]; // inspect registered tools without serving
}
```

### `HazelToolAdapter`

Lower-level adapter — useful when building a custom transport:

```typescript
class HazelToolAdapter {
  static fromRegistry(registry: IToolRegistry): HazelToolAdapter;
  listTools(): McpToolDefinition[];
  invoke(toolName: string, input: Record<string, unknown>): Promise<unknown>;
  hasTool(toolName: string): boolean;
}
```

### `IToolRegistry`

The interface a registry must satisfy. `@hazeljs/agent`'s `ToolRegistry` satisfies it structurally:

```typescript
interface IToolRegistry {
  getAllTools(): HazelTool[];
  getTool(toolName: string): HazelTool | undefined;
  hasTool(toolName: string): boolean;
}

interface HazelTool {
  name: string;
  description: string;
  parameters?: Array<{ name: string; type: string; description: string; required?: boolean; enum?: unknown[] }>;
  target: object;
  method: Function;
}
```

### Supported MCP methods

| Method | Description |
|---|---|
| `initialize` | Handshake — returns server info and capabilities |
| `ping` | Liveness probe |
| `tools/list` | Returns all registered tool definitions |
| `tools/call` | Invokes a tool and returns a content block response |

### Error codes

| Code | Constant | Meaning |
|---|---|---|
| -32700 | `PARSE_ERROR` | stdin line could not be parsed as JSON |
| -32600 | `INVALID_REQUEST` | Not a valid JSON-RPC 2.0 request |
| -32601 | `METHOD_NOT_FOUND` | No handler for the given method |
| -32602 | `INVALID_PARAMS` | Required parameter missing or malformed |
| -32603 | `INTERNAL_ERROR` | Unexpected exception inside a handler |
| -32001 | `TOOL_NOT_FOUND` | Named tool is not registered |

---

## Extending for HTTP / SSE transport

The request router is transport-agnostic. To add an HTTP endpoint, wire `handleRequest` to any HTTP framework — the adapter, types, and error helpers stay unchanged:

```typescript
// Future: HTTP/SSE transport
app.post('/mcp', async (req, res) => {
  const response = await handleRequest(req.body);
  res.json(response);
});
```

---

## Examples

- [examples/stdio-server](./examples/stdio-server) — Standalone server with `SimpleToolRegistry`, no decorators required
- [examples/agent-server](./examples/agent-server) — Full `@hazeljs/agent` + `@Tool()` decorator example

---

## License

Apache 2.0

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

## Links

- [Documentation](https://hazeljs.ai/docs/packages/mcp)
- [GitHub](https://github.com/hazeljs/hazeljs)
- [Issues](https://github.com/hazeljs/hazeljs/issues)
- [Discord](https://discord.com/channels/1448263814238965833/1448263814859456575)
