/**
 * @hazeljs/mcp — Public API
 *
 * Exposes HazelJS tools as MCP (Model Context Protocol) tools over STDIO.
 *
 * Quickstart:
 *   import { createMcpServer } from '@hazeljs/mcp';
 *   import { ToolRegistry } from '@hazeljs/agent';
 *
 *   const server = createMcpServer({
 *     name: 'my-hazel-server',
 *     version: '1.0.0',
 *     toolRegistry: new ToolRegistry(), // pre-populated with agent tools
 *   });
 *
 *   server.listenStdio();
 */

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

// Types
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
