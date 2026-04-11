/**
 * @Tool Decorator
 * Marks a method as a tool that can be used by agents
 */
import 'reflect-metadata';
import { ToolConfig, ToolMetadata } from '../types/tool.types';
/**
 * Tool decorator - marks a method as a tool
 */
export declare function Tool(config?: Partial<ToolConfig>): MethodDecorator;
/**
 * Get tool metadata from a method
 */
export declare function getToolMetadata(
  target: object,
  propertyKey: string
): ToolMetadata | undefined;
/**
 * Get all tools from an agent class
 */
export declare function getAgentTools(agentClass: new (...args: unknown[]) => unknown): string[];
/**
 * Check if a method is a tool
 */
export declare function isTool(target: object, propertyKey: string): boolean;
//# sourceMappingURL=tool.decorator.d.ts.map
