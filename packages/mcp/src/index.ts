/**
 * @hazeljs/mcp — Public API
 *
 * MCP Server: Expose HazelJS tools as MCP tools over STDIO/HTTP.
 * MCP Client: Connect to external MCP servers and consume their tools.
 *
 * Quickstart (Server):
 *   import { createMcpServer } from '@hazeljs/mcp';
 *   const server = createMcpServer({ name: 'my-server', version: '1.0.0', toolRegistry });
 *   server.listenStdio();
 *
 * Quickstart (Client):
 *   import { McpClient } from '@hazeljs/mcp';
 *   const client = new McpClient({ name: 'my-app', version: '1.0.0' });
 *   await client.connect({ id: 'github', name: 'GitHub', transport: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] } });
 *   const tools = client.listTools();
 */

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

// Factory function
export { createMcpServer } from './server/createMcpServer';

// Adapter — useful for testing or custom transports
export { HazelToolAdapter } from './server/hazelToolAdapter';

// Error utilities — useful when building custom transports or middleware
export {
  ErrorCode,
  makeError,
  makeErrorResponse,
  parseError,
  invalidRequestError,
  methodNotFoundError,
  invalidParamsError,
  toolNotFoundError,
  internalError,
} from './server/errors';

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export { McpClient } from './client/mcp-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type {
  // Server
  McpServer,
  McpServerOptions,
  // MCP protocol
  McpToolDefinition,
  McpRequest,
  McpResponse,
  McpError,
  McpErrorResponse,
  CallToolParams,
  InitializeParams,
  ServerCapabilities,
  JsonSchemaProperty,
  // Hazel tool abstraction
  IToolRegistry,
  HazelTool,
} from './server/types';

export type {
  // Client
  McpClientOptions,
  McpServerConfig,
  McpTransportConfig,
  McpStdioTransportConfig,
  McpHttpTransportConfig,
  McpRemoteTool,
  McpToolCallResult,
} from './client/types';
