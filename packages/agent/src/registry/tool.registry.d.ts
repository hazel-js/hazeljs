/**
 * Tool Registry
 * Central registry for all tools in the system
 */
import { ToolMetadata, ToolDefinition } from '../types/tool.types';
import { LLMToolDefinition } from '../types/llm.types';
/**
 * Tool Registry - manages tool registration and lookup
 */
export declare class ToolRegistry {
  private tools;
  private agentTools;
  /**
   * Register tools from an agent instance
   */
  registerAgentTools(agentName: string, agentInstance: unknown): void;
  /**
   * Get tool metadata by name
   */
  getTool(toolName: string): ToolMetadata | undefined;
  /**
   * Get all tools for an agent
   */
  getAgentTools(agentName: string): ToolMetadata[];
  /**
   * Get all registered tools
   */
  getAllTools(): ToolMetadata[];
  /**
   * Check if a tool is registered
   */
  hasTool(toolName: string): boolean;
  /**
   * Get tool definitions for LLM (OpenAI function calling format)
   */
  getToolDefinitions(agentName: string): ToolDefinition[];
  /**
   * Unregister all tools for an agent
   */
  unregisterAgentTools(agentName: string): void;
  /**
   * Clear all tools
   */
  clear(): void;
  /**
   * Get tool count
   */
  get count(): number;
  /**
   * Convert tool definitions to LLM format (OpenAI function calling)
   */
  getToolDefinitionsForLLM(agentName: string): LLMToolDefinition[];
}
//# sourceMappingURL=tool.registry.d.ts.map
