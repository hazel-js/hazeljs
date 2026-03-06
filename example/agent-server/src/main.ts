/**
 * @hazeljs/mcp — Agent Decorator Example
 *
 * This example demonstrates the native HazelJS way to build an MCP server:
 *
 *   1. Define tools as @Tool()-decorated methods on a class (SupportAgent)
 *   2. Register the class instance with ToolRegistry.registerAgentTools()
 *   3. Pass the registry to createMcpServer()
 *   4. Call server.listenStdio()
 *
 * Contrast with examples/stdio-server which uses a SimpleToolRegistry and
 * registers plain functions manually. That approach is simpler but misses
 * the full HazelJS feature set (retries, timeouts, requiresApproval, etc.).
 *
 * IMPORTANT: 'reflect-metadata' MUST be the very first import in the entry
 * file. The @Tool() decorator uses Reflect.defineMetadata() internally, and
 * the polyfill must be loaded before any decorated class is evaluated.
 *
 * Run:
 *   pnpm install
 *   pnpm dev
 *
 * Quick smoke test (paste each line into stdin after starting):
 *
 *   {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}
 *   {"jsonrpc":"2.0","id":2,"method":"tools/list"}
 *   {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"lookup_customer","arguments":{"email":"alice@example.com"}}}
 *   {"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_order_status","arguments":{"order_id":"ORD-1001"}}}
 *   {"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"search_knowledge_base","arguments":{"query":"refund policy"}}}
 *   {"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"create_support_ticket","arguments":{"customer_id":"cust_001","subject":"Order not arrived","body":"ORD-1001 shipped 2 weeks ago and has not arrived.","priority":"high"}}}
 */

// reflect-metadata MUST come before any class that uses decorators
import 'reflect-metadata';

import { ToolRegistry } from '@hazeljs/agent';
import { createMcpServer } from '@hazeljs/mcp';
import { SupportAgent } from './agents/SupportAgent';

// ---------------------------------------------------------------------------
// Registry setup
//
// registerAgentTools(agentName, instance) does three things:
//   1. Reads the TOOLS_LIST_KEY metadata from SupportAgent's constructor
//      to enumerate method names decorated with @Tool()
//   2. Reads per-method TOOL_METADATA_KEY metadata (name, description, params)
//   3. Stores each tool under the key "<agentName>.<methodName>" in its
//      internal map, with `target` updated to the live instance so that
//      method.call(target, input) preserves the correct `this` context
//
// The MCP adapter calls getAllTools() which returns the ToolMetadata[] values
// and uses tool.name (the short decorator name, e.g. "lookup_customer") as
// the MCP tool name — NOT the internal key "support.lookup_customer".
// ---------------------------------------------------------------------------

const registry = new ToolRegistry();
registry.registerAgentTools('support', new SupportAgent());

// ---------------------------------------------------------------------------
// MCP server
// ---------------------------------------------------------------------------

const server = createMcpServer({
  name: 'hazel-support-agent',
  version: '1.0.0',
  toolRegistry: registry,
});

// Log to stderr — stdout is reserved for the JSON-RPC stream
const toolNames = server.listTools().map((t) => t.name).join(', ');
process.stderr.write(`[hazel-mcp] Agent decorator server started\n`);
process.stderr.write(`[hazel-mcp] Registered tools (${registry.count}): ${toolNames}\n`);
process.stderr.write(`[hazel-mcp] Waiting for JSON-RPC messages on stdin...\n`);

server.listenStdio();
