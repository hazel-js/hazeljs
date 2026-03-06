/**
 * MCP Protocol Types — JSON-RPC 2.0
 *
 * This module defines the minimal set of types needed for the Model Context
 * Protocol over STDIO. The full spec lives at:
 * https://spec.modelcontextprotocol.io/
 *
 * Extension note: When adding HTTP/SSE transport in the future, only the
 * transport layer changes. These types remain unchanged because they describe
 * the protocol messages, not the transport mechanism.
 */

// ---------------------------------------------------------------------------
// Tool types
// ---------------------------------------------------------------------------

/** A single JSON Schema property descriptor used in inputSchema */
export interface JsonSchemaProperty {
  type: string;
  description: string;
  enum?: unknown[];
}

/**
 * MCP tool definition — what is advertised to clients on tools/list.
 *
 * Mapping from Hazel:
 *   ToolMetadata.name        → name
 *   ToolMetadata.description → description
 *   ToolMetadata.parameters  → inputSchema.properties / required
 */
export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, JsonSchemaProperty>;
    required: string[];
  };
}

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 wire types
// ---------------------------------------------------------------------------

/** JSON-RPC 2.0 inbound request */
export interface McpRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: unknown;
}

/** JSON-RPC 2.0 successful response */
export interface McpResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result: unknown;
}

/** JSON-RPC 2.0 error object */
export interface McpError {
  code: number;
  message: string;
  data?: unknown;
}

/** JSON-RPC 2.0 error response */
export interface McpErrorResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  error: McpError;
}

// ---------------------------------------------------------------------------
// MCP-specific params
// ---------------------------------------------------------------------------

/** Params received with the initialize request */
export interface InitializeParams {
  protocolVersion: string;
  capabilities?: Record<string, unknown>;
  clientInfo?: { name: string; version: string };
}

/** Params received with tools/call */
export interface CallToolParams {
  name: string;
  arguments?: Record<string, unknown>;
}

/** Server capabilities advertised during the initialize handshake */
export interface ServerCapabilities {
  tools?: { listChanged?: boolean };
}

// ---------------------------------------------------------------------------
// Hazel tool abstraction — decoupled from @hazeljs/agent
// ---------------------------------------------------------------------------

/**
 * Minimal representation of a Hazel tool as seen by the MCP adapter.
 *
 * @hazeljs/agent's ToolMetadata is a structural superset of this interface,
 * so a ToolRegistry instance can be passed as IToolRegistry without any cast.
 *
 * If you use a custom registry (no decorators), implement this interface
 * directly — see examples/stdio-server for a reference implementation.
 */
export interface HazelTool {
  name: string;
  description: string;
  parameters?: Array<{
    name: string;
    type: string;
    description: string;
    required?: boolean;
    enum?: unknown[];
  }>;
  /** The object whose context the method should be called with */
  target: object;
  /** The callable function — invoked as method.call(target, input) */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  method: Function;
}

/**
 * The interface a tool registry must satisfy to work with @hazeljs/mcp.
 *
 * @hazeljs/agent's ToolRegistry satisfies this interface out of the box.
 * You can also roll your own for standalone MCP servers — see the example.
 */
export interface IToolRegistry {
  getAllTools(): HazelTool[];
  getTool(toolName: string): HazelTool | undefined;
  hasTool(toolName: string): boolean;
}

// ---------------------------------------------------------------------------
// Public server surface
// ---------------------------------------------------------------------------

/** Options passed to createMcpServer() */
export interface McpServerOptions {
  /** Server name advertised to MCP clients during initialize */
  name: string;
  /** Server version advertised to MCP clients during initialize */
  version: string;
  /** Hazel tool registry — @hazeljs/agent ToolRegistry or a custom one */
  toolRegistry: IToolRegistry;
}

/** The object returned by createMcpServer() */
export interface McpServer {
  /** Attach to process.stdin / process.stdout and start serving */
  listenStdio(): void;
  /** Return the current list of MCP tool definitions */
  listTools(): McpToolDefinition[];
}
