/**
 * Tool Registry
 * Central registry for all tools in the system
 */

import { ToolMetadata, ToolDefinition } from '../types/tool.types';
import { LLMToolDefinition } from '../types/llm.types';
import { getToolMetadata, getAgentTools } from '../decorators/tool.decorator';

/**
 * Tool Registry - manages tool registration and lookup
 */
export class ToolRegistry {
  private tools: Map<string, ToolMetadata> = new Map();
  private agentTools: Map<string, Set<string>> = new Map();

  /**
   * Register tools from an agent instance
   */
  registerAgentTools(agentName: string, agentInstance: unknown): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentClass = (agentInstance as any).constructor;
    const toolNames = getAgentTools(agentClass);

    if (toolNames.length === 0) {
      return;
    }

    const agentToolSet = new Set<string>();

    for (const toolName of toolNames) {
      const metadata = getToolMetadata(agentInstance as object, toolName);

      if (!metadata) {
        // Tool metadata not found, skip
        continue;
      }

      const fullToolName = `${agentName}.${toolName}`;

      if (this.tools.has(fullToolName)) {
        // Tool already registered, skip
        continue;
      }

      // Update metadata to use the actual instance instead of prototype
      const instanceMetadata: ToolMetadata = {
        ...metadata,
        target: agentInstance as object,
      };

      this.tools.set(fullToolName, instanceMetadata);
      agentToolSet.add(fullToolName);
    }

    this.agentTools.set(agentName, agentToolSet);
  }

  /**
   * Get tool metadata by name
   */
  getTool(toolName: string): ToolMetadata | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Get all tools for an agent
   */
  getAgentTools(agentName: string): ToolMetadata[] {
    const toolNames = this.agentTools.get(agentName);
    if (!toolNames) {
      return [];
    }

    return Array.from(toolNames)
      .map((name) => this.tools.get(name))
      .filter((tool): tool is ToolMetadata => tool !== undefined);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): ToolMetadata[] {
    return Array.from(this.tools.values());
  }

  /**
   * Check if a tool is registered
   */
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Get tool definitions for LLM (OpenAI function calling format)
   */
  getToolDefinitions(agentName: string): ToolDefinition[] {
    const tools = this.getAgentTools(agentName);

    return tools.map((tool) => {
      const properties: Record<
        string,
        {
          type: string;
          description: string;
          enum?: unknown[];
        }
      > = {};
      const required: string[] = [];

      if (tool.parameters) {
        for (const param of tool.parameters) {
          properties[param.name] = {
            type: param.type,
            description: param.description,
          };

          if (param.enum) {
            properties[param.name].enum = param.enum;
          }

          if (param.required) {
            required.push(param.name);
          }
        }
      }

      return {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties,
          required,
        },
      };
    });
  }

  /**
   * Unregister all tools for an agent
   */
  unregisterAgentTools(agentName: string): void {
    const toolNames = this.agentTools.get(agentName);
    if (toolNames) {
      for (const toolName of toolNames) {
        this.tools.delete(toolName);
      }
      this.agentTools.delete(agentName);
    }
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
    this.agentTools.clear();
  }

  /**
   * Get tool count
   */
  get count(): number {
    return this.tools.size;
  }

  /**
   * Convert tool definitions to LLM format (OpenAI function calling)
   */
  getToolDefinitionsForLLM(agentName: string): LLMToolDefinition[] {
    const tools = this.getToolDefinitions(agentName);

    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }
}
