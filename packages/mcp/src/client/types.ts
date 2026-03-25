/**
 * MCP Client Types
 *
 * Types for connecting to external MCP servers as a client,
 * allowing HazelJS agents to consume tools from other systems.
 */

// ---------------------------------------------------------------------------
// Client configuration
// ---------------------------------------------------------------------------

export interface McpClientOptions {
  /** Human-readable name for this client */
  name: string;
  /** Client version */
  version: string;
}

/** Configuration for connecting to an MCP server */
export interface McpServerConfig {
  /** Unique identifier for this server connection */
  id: string;
  /** Human-readable name */
  name: string;
  /** Transport type */
  transport: McpTransportConfig;
}

export type McpTransportConfig = McpStdioTransportConfig | McpHttpTransportConfig;

export interface McpStdioTransportConfig {
  type: 'stdio';
  /** Command to spawn the MCP server */
  command: string;
  /** Arguments to the command */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
}

export interface McpHttpTransportConfig {
  type: 'http';
  /** URL of the MCP server */
  url: string;
  /** HTTP headers to include */
  headers?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Tool discovery results
// ---------------------------------------------------------------------------

export interface McpRemoteTool {
  /** Server ID + tool name (e.g., "github.create_issue") */
  qualifiedName: string;
  /** Original tool name from the server */
  name: string;
  /** Server ID this tool belongs to */
  serverId: string;
  /** Tool description */
  description: string;
  /** JSON Schema for input */
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: unknown[] }>;
    required: string[];
  };
}

/** Result of calling a remote MCP tool */
export interface McpToolCallResult {
  content: Array<{ type: string; text?: string; data?: unknown }>;
  isError: boolean;
}
