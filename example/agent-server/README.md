# Agent Decorator MCP Server

An MCP STDIO server using the native HazelJS way to define tools: `@Tool()` decorators on a class, registered through `ToolRegistry`.

This is the recommended pattern for any project that already uses `@hazeljs/agent`. Compare with [`../stdio-server`](../stdio-server/README.md) which shows the lighter-weight `SimpleToolRegistry` approach for standalone servers.

---

## How it works

```
SupportAgent class
  @Tool() lookupCustomer()
  @Tool() getOrderStatus()
  @Tool() searchKnowledgeBase()
  @Tool() createSupportTicket()
        │
        ▼
ToolRegistry.registerAgentTools('support', new SupportAgent())
        │
        │  reads reflect-metadata from class prototype
        │  stores tools as "support.lookupCustomer", etc.
        │  binds each method to the live instance
        │
        ▼
createMcpServer({ toolRegistry: registry })
        │
        │  getAllTools() → ToolMetadata[]
        │  tool.name used as MCP tool name ("lookup_customer")
        │
        ▼
server.listenStdio()
        │
        ▼
  stdin ──► JSON-RPC router ──► HazelToolAdapter.invoke() ──► method.call(instance, input)
  stdout ◄─ JSON-RPC response ◄────────────────────────────────────────────────────────────
```

---

## Running locally

```bash
cd packages/mcp/examples/agent-server
pnpm install
pnpm dev
```

Startup logs appear on **stderr**. The **stdout** stream is reserved for the JSON-RPC protocol and must not be written to directly.

---

## Manual test session

Paste each line into stdin after `pnpm dev`:

**Handshake**
```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}
```

**List tools**
```json
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
```

**Look up a customer**
```json
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"lookup_customer","arguments":{"email":"alice@example.com"}}}
```

**Check order status**
```json
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_order_status","arguments":{"order_id":"ORD-1001"}}}
```

**Search knowledge base**
```json
{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"search_knowledge_base","arguments":{"query":"refund policy","limit":2}}}
```

**Create a support ticket**
```json
{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"create_support_ticket","arguments":{"customer_id":"cust_001","subject":"Order ORD-1001 not delivered","body":"Item shipped 2 weeks ago has not arrived. Requesting investigation.","priority":"high"}}}
```

**Unknown customer (error handled gracefully)**
```json
{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"lookup_customer","arguments":{"email":"nobody@example.com"}}}
```

---

## Connecting to Cursor

Build first, then add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "hazel-support": {
      "command": "node",
      "args": ["packages/mcp/examples/agent-server/dist/main.js"]
    }
  }
}
```

Reload Cursor. You can then ask the AI:

> "Look up alice@example.com and tell me her most recent order."

> "Check order ORD-1001 and search the knowledge base for help if it's not delivered yet."

> "Open a high-priority ticket for alice@example.com about her missing order ORD-1001."

---

## Connecting to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hazel-support": {
      "command": "node",
      "args": ["/absolute/path/to/agent-server/dist/main.js"]
    }
  }
}
```

---

## Key difference vs `examples/stdio-server`

| | `stdio-server` (SimpleToolRegistry) | `agent-server` (ToolRegistry + decorators) |
|---|---|---|
| Tool definition | Plain async function passed to `registry.register()` | Method on a class decorated with `@Tool()` |
| Discovery | Manual — you call `register()` for each tool | Automatic — `registerAgentTools()` reads `reflect-metadata` |
| `@hazeljs/agent` required | No | Yes |
| `reflect-metadata` required | No | Yes, must be first import |
| Full Hazel features (retries, approval, timeout) | Not available | Available via `@Tool({ retries, timeout, requiresApproval })` |
| Best for | Standalone servers, scripts, quick prototypes | Production apps already using `@hazeljs/agent` |

---

## `@Tool()` decorator options

Every option in the decorator maps directly to the MCP tool schema:

```ts
@Tool({
  name: 'lookup_customer',          // MCP tool name
  description: '...',               // shown to the AI client
  parameters: [...],                // converted to JSON Schema inputSchema
  requiresApproval: false,          // gates execution behind human review
  timeout: 30_000,                  // ms before the method is considered hung
  retries: 1,                       // automatic retry count on failure
})
async lookupCustomer(input: Record<string, unknown>) { ... }
```

`requiresApproval`, `timeout`, and `retries` are Hazel-level features managed by the agent runtime, not by the MCP transport — they're available when running inside a full `AgentRuntime`. In this standalone example they're stored as metadata but not enforced.

---

## Replacing mock data

Every method in `SupportAgent` is a regular async function. Swap the in-memory arrays with your data layer and nothing else changes:

```ts
// Before (mock)
async lookupCustomer(input: Record<string, unknown>) {
  return CUSTOMERS.find(c => c.email === input['email']);
}

// After (Prisma)
async lookupCustomer(input: Record<string, unknown>) {
  return prisma.customer.findUnique({ where: { email: String(input['email']) } });
}
```

---

## Mock data reference

| Email | Customer ID | Plan |
|---|---|---|
| alice@example.com | cust_001 | pro |
| bob@example.com | cust_002 | enterprise |
| carol@example.com | cust_003 | free |

| Order ID | Customer | Status |
|---|---|---|
| ORD-1001 | cust_001 | shipped |
| ORD-1002 | cust_001 | delivered |
| ORD-1003 | cust_002 | processing |
