/**
 * HazelToolAdapter
 *
 * Converts a Hazel tool registry into MCP tool definitions and handles
 * tool invocation on behalf of the MCP server.
 *
 * Hazel → MCP field mapping:
 *   ToolMetadata.name        → McpToolDefinition.name
 *   ToolMetadata.description → McpToolDefinition.description
 *   ToolMetadata.parameters  → McpToolDefinition.inputSchema (JSON Schema object)
 *
 * Invocation:
 *   The adapter calls method.call(target, input) to preserve the `this`
 *   context of the original decorated class instance. This means tools
 *   registered via @Tool() on an agent class work out of the box.
 *
 * Schema handling:
 *   - parameters[] present  → converted to JSON Schema (type/description/enum)
 *   - parameters absent     → empty schema, accepts any JSON object
 *
 * Extension note:
 *   To support input validation via Zod, replace the direct method.call with
 *   a validation step: parse input with the Zod schema, then call the method.
 *   The validation hook below is a placeholder for that upgrade path.
 *
 * The adapter is designed to be transport-agnostic. The same instance can be
 * used by STDIO, HTTP, or SSE transports — only the transport glue changes.
 */

import type { IToolRegistry, HazelTool, McpToolDefinition } from './types';

export class HazelToolAdapter {
  private readonly tools: Map<string, HazelTool> = new Map();

  private constructor() {}

  /**
   * Build an adapter from a Hazel tool registry.
   *
   * The registry is snapshotted at construction time. If tools are registered
   * dynamically after server start, call fromRegistry() again and replace the
   * server's adapter (or extend this class to hold a live registry reference).
   */
  static fromRegistry(registry: IToolRegistry): HazelToolAdapter {
    const adapter = new HazelToolAdapter();

    for (const tool of registry.getAllTools()) {
      adapter.tools.set(tool.name, tool);
    }

    return adapter;
  }

  /** Return all tools as MCP definitions for a tools/list response */
  listTools(): McpToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => this.toMcpDefinition(tool));
  }

  /**
   * Invoke a named tool with the given input object.
   *
   * Throws if the tool is not found — callers should check hasTool() first
   * or catch the error and convert it to a JSON-RPC error response.
   */
  async invoke(toolName: string, input: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // Preserve the original `this` context from the registered class instance
    return tool.method.call(tool.target, input) as Promise<unknown>;
  }

  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Convert a Hazel tool's parameter list into an MCP JSON Schema inputSchema.
   *
   * If parameters is empty or undefined, an open schema is emitted
   * ({ type: 'object', properties: {}, required: [] }) which accepts any input.
   */
  private toMcpDefinition(tool: HazelTool): McpToolDefinition {
    const properties: McpToolDefinition['inputSchema']['properties'] = {};
    const required: string[] = [];

    for (const param of tool.parameters ?? []) {
      properties[param.name] = {
        type: param.type,
        description: param.description,
        ...(param.enum !== undefined ? { enum: param.enum } : {}),
      };

      if (param.required) {
        required.push(param.name);
      }
    }

    return {
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: 'object',
        properties,
        required,
      },
    };
  }
}
