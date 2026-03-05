/**
 * createMcpServer
 *
 * The main entry point of @hazeljs/mcp. Wires together:
 *   1. HazelToolAdapter  — converts Hazel tools to MCP definitions
 *   2. Request router    — dispatches JSON-RPC methods to handlers
 *   3. STDIO transport   — reads/writes newline-delimited JSON
 *
 * Supported JSON-RPC methods:
 *   initialize    — MCP handshake; returns server name, version, capabilities
 *   ping          — liveness probe; returns empty result
 *   tools/list    — returns all registered MCP tool definitions
 *   tools/call    — invokes a named tool with provided arguments
 *
 * Usage:
 *   const server = createMcpServer({ name, version, toolRegistry });
 *   server.listenStdio();
 *
 * Extension note:
 *   To expose the same tools over HTTP/SSE, call handleRequest() from an
 *   HTTP handler instead of wiring it to createStdioTransport(). The router
 *   logic and adapter are reusable across transports.
 */

import type {
  McpServerOptions,
  McpServer,
  McpRequest,
  McpResponse,
  McpErrorResponse,
  McpToolDefinition,
  CallToolParams,
} from './types';
import { HazelToolAdapter } from './hazelToolAdapter';
import { createStdioTransport } from './stdioTransport';
import {
  methodNotFoundError,
  invalidParamsError,
  toolNotFoundError,
  internalError,
} from './errors';

export function createMcpServer(options: McpServerOptions): McpServer {
  const { name, version, toolRegistry } = options;

  // Snapshot the registry once at startup. Tools registered after this point
  // won't be visible until the server is restarted or the adapter is rebuilt.
  const adapter = HazelToolAdapter.fromRegistry(toolRegistry);

  // ---------------------------------------------------------------------------
  // Request router
  // ---------------------------------------------------------------------------

  async function handleRequest(req: McpRequest): Promise<McpResponse | McpErrorResponse> {
    const id = req.id ?? null;

    switch (req.method) {
      case 'initialize':
        return handleInitialize(id);

      case 'initialized':
        // Notification — no response required by spec, but we send an ack
        // to avoid clients hanging on a missing reply
        return { jsonrpc: '2.0', id, result: {} };

      case 'ping':
        return { jsonrpc: '2.0', id, result: {} };

      case 'tools/list':
        return handleListTools(id);

      case 'tools/call':
        return handleCallTool(id, req);

      default:
        return methodNotFoundError(id, req.method);
    }
  }

  // ---------------------------------------------------------------------------
  // Method handlers
  // ---------------------------------------------------------------------------

  function handleInitialize(id: string | number | null): McpResponse {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: { name, version },
        capabilities: {
          // Advertise tool support; set listChanged: true if dynamic
          // registration is added in a future version
          tools: {},
        },
      },
    };
  }

  function handleListTools(id: string | number | null): McpResponse {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: adapter.listTools(),
      },
    };
  }

  async function handleCallTool(
    id: string | number | null,
    req: McpRequest
  ): Promise<McpResponse | McpErrorResponse> {
    const params = req.params as CallToolParams | undefined;

    if (!params?.name) {
      return invalidParamsError(id, 'Missing required field: name');
    }

    if (!adapter.hasTool(params.name)) {
      return toolNotFoundError(id, params.name);
    }

    try {
      const result = await adapter.invoke(params.name, params.arguments ?? {});

      return {
        jsonrpc: '2.0',
        id,
        result: {
          // MCP content block format — clients render type: 'text' as plain text
          content: [{ type: 'text', text: JSON.stringify(result) }],
          isError: false,
        },
      };
    } catch (err) {
      return internalError(id, err);
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  return {
    listenStdio(): void {
      createStdioTransport(handleRequest);
    },

    listTools(): McpToolDefinition[] {
      return adapter.listTools();
    },
  };
}
