/**
 * MCP Client — Connect to external MCP servers
 *
 * Allows HazelJS agents to discover and invoke tools from external
 * MCP-compatible servers via STDIO or HTTP transport.
 *
 * @example STDIO transport (e.g., connect to a local MCP server):
 * ```ts
 * const client = new McpClient({ name: 'my-app', version: '1.0.0' });
 *
 * await client.connectStdio({
 *   id: 'github',
 *   name: 'GitHub MCP',
 *   transport: {
 *     type: 'stdio',
 *     command: 'npx',
 *     args: ['-y', '@modelcontextprotocol/server-github'],
 *     env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN! },
 *   },
 * });
 *
 * const tools = client.listTools();          // discover available tools
 * const result = await client.callTool('github.create_issue', { title: 'Bug' });
 * ```
 *
 * @example Register MCP tools into an agent's ToolRegistry:
 * ```ts
 * import { ToolRegistry } from '@hazeljs/agent';
 * const registry = new ToolRegistry();
 * client.registerToolsInto(registry);
 * ```
 */

import { ChildProcess, spawn } from 'child_process';
import { createInterface, Interface as ReadlineInterface } from 'readline';

import type {
  McpClientOptions,
  McpServerConfig,
  McpRemoteTool,
  McpToolCallResult,
  McpStdioTransportConfig,
  McpHttpTransportConfig,
} from './types';

interface McpJsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

interface McpJsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface ConnectedServer {
  config: McpServerConfig;
  tools: McpRemoteTool[];
  /** Send a JSON-RPC request and get a response */
  request: (method: string, params?: unknown) => Promise<unknown>;
  /** Disconnect / cleanup */
  disconnect: () => void;
}

export class McpClient {
  private readonly clientInfo: McpClientOptions;
  private servers: Map<string, ConnectedServer> = new Map();
  private nextId = 1;

  constructor(options: McpClientOptions) {
    this.clientInfo = options;
  }

  // -------------------------------------------------------------------------
  // Connect
  // -------------------------------------------------------------------------

  /**
   * Connect to an MCP server using the specified transport.
   * Performs the initialize handshake and discovers available tools.
   */
  async connect(config: McpServerConfig): Promise<void> {
    if (this.servers.has(config.id)) {
      throw new Error(`Server "${config.id}" is already connected`);
    }

    if (config.transport.type === 'stdio') {
      await this.connectStdio(config, config.transport);
    } else if (config.transport.type === 'http') {
      await this.connectHttp(config, config.transport);
    } else {
      throw new Error(`Unknown transport type: ${(config.transport as { type: string }).type}`);
    }
  }

  // -------------------------------------------------------------------------
  // STDIO Transport
  // -------------------------------------------------------------------------

  private async connectStdio(
    config: McpServerConfig,
    transport: McpStdioTransportConfig
  ): Promise<void> {
    const child: ChildProcess = spawn(transport.command, transport.args ?? [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...(transport.env ?? {}) },
      cwd: transport.cwd,
    });

    if (!child.stdin || !child.stdout) {
      throw new Error(`Failed to spawn STDIO process for server "${config.id}"`);
    }

    const pendingRequests = new Map<
      number,
      {
        resolve: (value: unknown) => void;
        reject: (reason: Error) => void;
        timer: NodeJS.Timeout;
      }
    >();

    // Read line-delimited JSON responses
    const rl: ReadlineInterface = createInterface({ input: child.stdout });
    rl.on('line', (line: string) => {
      try {
        const response = JSON.parse(line) as McpJsonRpcResponse;
        const pending = pendingRequests.get(response.id);
        if (pending) {
          clearTimeout(pending.timer);
          pendingRequests.delete(response.id);
          if (response.error) {
            pending.reject(new Error(`MCP error: ${response.error.message}`));
          } else {
            pending.resolve(response.result);
          }
        }
      } catch {
        // Ignore non-JSON lines (server logs, etc.)
      }
    });

    const requestFn = (method: string, params?: unknown): Promise<unknown> => {
      return new Promise((resolve, reject) => {
        const id = this.nextId++;
        const request: McpJsonRpcRequest = {
          jsonrpc: '2.0',
          id,
          method,
          ...(params !== undefined ? { params } : {}),
        };

        // Timeout after 30s
        const timer = setTimeout(() => {
          if (pendingRequests.has(id)) {
            pendingRequests.delete(id);
            reject(new Error(`MCP request timed out: ${method}`));
          }
        }, 30000);

        pendingRequests.set(id, { resolve, reject, timer });
        child.stdin!.write(JSON.stringify(request) + '\n');
      });
    };

    const disconnectFn = (): void => {
      rl.close();
      child.kill();
    };

    // Initialize handshake
    await requestFn('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: this.clientInfo.name, version: this.clientInfo.version },
    });

    // Send initialized notification
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialized' }) + '\n');

    // Discover tools
    const toolsResult = (await requestFn('tools/list')) as {
      tools: Array<{
        name: string;
        description: string;
        inputSchema: McpRemoteTool['inputSchema'];
      }>;
    };

    const tools: McpRemoteTool[] = (toolsResult.tools ?? []).map((t) => ({
      qualifiedName: `${config.id}.${t.name}`,
      name: t.name,
      serverId: config.id,
      description: t.description,
      inputSchema: t.inputSchema,
    }));

    this.servers.set(config.id, {
      config,
      tools,
      request: requestFn,
      disconnect: disconnectFn,
    });
  }

  // -------------------------------------------------------------------------
  // HTTP Transport
  // -------------------------------------------------------------------------

  private async connectHttp(
    config: McpServerConfig,
    transport: McpHttpTransportConfig
  ): Promise<void> {
    const requestFn = async (method: string, params?: unknown): Promise<unknown> => {
      const id = this.nextId++;
      const body: McpJsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        ...(params !== undefined ? { params } : {}),
      };

      const response = await fetch(transport.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(transport.headers ?? {}),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`MCP HTTP error: ${response.status} ${response.statusText}`);
      }

      const result = (await response.json()) as McpJsonRpcResponse;
      if (result.error) {
        throw new Error(`MCP error: ${result.error.message}`);
      }

      return result.result;
    };

    // Initialize handshake
    await requestFn('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: this.clientInfo.name, version: this.clientInfo.version },
    });

    // Discover tools
    const toolsResult = (await requestFn('tools/list')) as {
      tools: Array<{
        name: string;
        description: string;
        inputSchema: McpRemoteTool['inputSchema'];
      }>;
    };

    const tools: McpRemoteTool[] = (toolsResult.tools ?? []).map((t) => ({
      qualifiedName: `${config.id}.${t.name}`,
      name: t.name,
      serverId: config.id,
      description: t.description,
      inputSchema: t.inputSchema,
    }));

    this.servers.set(config.id, {
      config,
      tools,
      request: requestFn,
      disconnect: () => {
        /* HTTP is stateless */
      },
    });
  }

  // -------------------------------------------------------------------------
  // Tool Operations
  // -------------------------------------------------------------------------

  /**
   * List all tools from all connected servers.
   */
  listTools(): McpRemoteTool[] {
    const tools: McpRemoteTool[] = [];
    for (const server of this.servers.values()) {
      tools.push(...server.tools);
    }
    return tools;
  }

  /**
   * List tools from a specific server.
   */
  listServerTools(serverId: string): McpRemoteTool[] {
    const server = this.servers.get(serverId);
    return server?.tools ?? [];
  }

  /**
   * Call a tool by its qualified name (e.g., "github.create_issue").
   */
  async callTool(
    qualifiedName: string,
    args: Record<string, unknown> = {}
  ): Promise<McpToolCallResult> {
    const [serverId, ...nameParts] = qualifiedName.split('.');
    const toolName = nameParts.join('.');

    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server not connected: ${serverId}`);
    }

    const tool = server.tools.find((t) => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${qualifiedName}`);
    }

    const result = (await server.request('tools/call', {
      name: toolName,
      arguments: args,
    })) as McpToolCallResult;

    return result;
  }

  /**
   * Check if a tool exists by qualified name.
   */
  hasTool(qualifiedName: string): boolean {
    return this.listTools().some((t) => t.qualifiedName === qualifiedName);
  }

  // -------------------------------------------------------------------------
  // Server Management
  // -------------------------------------------------------------------------

  /**
   * Disconnect from a specific server.
   */
  disconnect(serverId: string): void {
    const server = this.servers.get(serverId);
    if (server) {
      server.disconnect();
      this.servers.delete(serverId);
    }
  }

  /**
   * Disconnect from all servers.
   */
  disconnectAll(): void {
    for (const [id] of this.servers) {
      this.disconnect(id);
    }
  }

  /**
   * Get connected server IDs.
   */
  getConnectedServers(): string[] {
    return Array.from(this.servers.keys());
  }
}
