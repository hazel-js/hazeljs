# Customer Support Agent — MCP STDIO Server

A real-world example showing how to expose backend business logic as MCP tools so an AI assistant (Cursor, Claude Desktop, or any MCP-compatible client) can act as a first-line customer support agent.

---

## The scenario

Your support team uses Cursor or Claude Desktop as their AI assistant. Instead of manually switching between the CRM, order management system, and ticketing tool, the AI can call your backend directly:

```
Support rep: "Alice says her order hasn't arrived. Can you check and file a ticket?"

AI:
  1. lookup_customer(email: "alice@example.com")     → customer ID + plan
  2. get_order_status(order_id: "ORD-1001")          → status: "shipped"
  3. search_knowledge_base(query: "order not arrived") → tracking article
  4. create_support_ticket(...)                       → TKT-1001 opened
```

The support rep never leaves the chat window. The AI handles the data layer.

---

## Tools

| Tool | Description |
|---|---|
| `lookup_customer` | Find a customer record by email. Returns ID, name, plan, join date. |
| `get_order_status` | Get current status, items, and total for an order ID. |
| `search_knowledge_base` | Full-text search over help articles. Returns title, excerpt, URL. |
| `create_support_ticket` | Open a new ticket with subject, body, and priority. |

---

## Running locally

```bash
cd packages/mcp/examples/stdio-server
pnpm install
pnpm dev
```

The server writes startup logs to **stderr** and listens for JSON-RPC messages on **stdin**. Paste any of the test requests below to try it out.

---

## Manual test session

Copy and paste each line one at a time after `pnpm dev`:

**1. Handshake**
```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","clientInfo":{"name":"test","version":"1.0.0"}}}
```

**2. List available tools**
```json
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
```

**3. Look up a customer by email**
```json
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"lookup_customer","arguments":{"email":"alice@example.com"}}}
```

Expected:
```json
{"found":true,"customer":{"id":"cust_001","name":"Alice Johnson","email":"alice@example.com","plan":"pro","joinedAt":"2023-03-15"}}
```

**4. Check order status**
```json
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_order_status","arguments":{"order_id":"ORD-1001"}}}
```

Expected:
```json
{"found":true,"order":{"id":"ORD-1001","status":"shipped","total":149.99,...}}
```

**5. Search the knowledge base**
```json
{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"search_knowledge_base","arguments":{"query":"order not arrived refund"}}}
```

**6. Open a support ticket**
```json
{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"create_support_ticket","arguments":{"customer_id":"cust_001","subject":"Order ORD-1001 not delivered","body":"Customer reports item shipped 2 weeks ago has not arrived. Requesting investigation or refund.","priority":"high"}}}
```

Expected:
```json
{"success":true,"ticket":{"id":"TKT-1001","status":"open","priority":"high",...}}
```

**7. Handle an unknown customer gracefully**
```json
{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"lookup_customer","arguments":{"email":"unknown@example.com"}}}
```

Expected:
```json
{"found":false,"error":"No customer found for email: unknown@example.com"}
```

---

## Connecting to Cursor

Add this to `.cursor/mcp.json` in your project root (build the server first with `pnpm build`):

```json
{
  "mcpServers": {
    "support-agent": {
      "command": "node",
      "args": ["packages/mcp/examples/stdio-server/dist/main.js"]
    }
  }
}
```

Reload Cursor. The four support tools will appear in the AI's tool palette. You can now ask Cursor things like:

> "Look up customer bob@example.com and tell me his open orders."

> "Search the knowledge base for warranty information and summarise it."

> "Alice (alice@example.com) says her order ORD-1001 hasn't arrived. Check the status and open a high-priority ticket."

---

## Connecting to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "support-agent": {
      "command": "node",
      "args": ["/absolute/path/to/examples/stdio-server/dist/main.js"]
    }
  }
}
```

---

## Replacing mock data with a real database

Every tool function is a plain async function. Swap the in-memory arrays for your real data layer:

```ts
// Before (mock)
async function lookupCustomer(input: { email: string }) {
  const customer = CUSTOMERS.find(c => c.email === input.email);
  ...
}

// After (Prisma)
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function lookupCustomer(input: { email: string }) {
  const customer = await prisma.customer.findUnique({
    where: { email: input.email },
  });
  ...
}
```

No changes to the registry setup, the MCP server, or the transport layer.

---

## Replacing the simple registry with `@hazeljs/agent`

If your backend already uses `@hazeljs/agent`, you can pass your `ToolRegistry` directly instead of the `SimpleToolRegistry`:

```ts
import { createMcpServer } from '@hazeljs/mcp';
import { ToolRegistry } from '@hazeljs/agent';

class SupportService {
  @Tool({ name: 'lookup_customer', description: '...' })
  async lookupCustomer(input: { email: string }) { ... }
}

const registry = new ToolRegistry();
registry.registerAgentTools('support', new SupportService());

const server = createMcpServer({ name: 'hazel-support-agent', version: '1.0.0', toolRegistry: registry });
server.listenStdio();
```

---

## Mock data reference

**Customers**

| Email | ID | Plan |
|---|---|---|
| alice@example.com | cust_001 | pro |
| bob@example.com | cust_002 | enterprise |
| carol@example.com | cust_003 | free |

**Orders**

| Order ID | Customer | Status |
|---|---|---|
| ORD-1001 | cust_001 | shipped |
| ORD-1002 | cust_001 | delivered |
| ORD-1003 | cust_002 | processing |
