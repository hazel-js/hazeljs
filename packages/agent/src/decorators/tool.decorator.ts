/**
 * @Tool Decorator
 * Marks a method as a tool that can be used by agents
 */

import 'reflect-metadata';
import { ToolConfig, ToolMetadata } from '../types/tool.types';

const TOOL_METADATA_KEY = Symbol('tool');
const TOOLS_LIST_KEY = Symbol('tools');

/**
 * Tool decorator - marks a method as a tool
 */
export function Tool(config?: Partial<ToolConfig>): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const methodName = String(propertyKey);

    const metadata: ToolMetadata = {
      name: config?.name || methodName,
      description: config?.description || `Tool: ${methodName}`,
      parameters: config?.parameters || [],
      requiresApproval: config?.requiresApproval || false,
      timeout: config?.timeout || 30000,
      retries: config?.retries || 0,
      policy: config?.policy,
      metadata: config?.metadata,
      target,
      propertyKey: methodName,
      method: descriptor.value,
      agentClass: target.constructor as new (...args: unknown[]) => unknown,
    };

    Reflect.defineMetadata(TOOL_METADATA_KEY, metadata, target, propertyKey);

    const existingTools: string[] = Reflect.getMetadata(TOOLS_LIST_KEY, target.constructor) || [];
    if (!existingTools.includes(methodName)) {
      existingTools.push(methodName);
      Reflect.defineMetadata(TOOLS_LIST_KEY, existingTools, target.constructor);
    }

    return descriptor;
  };
}

/**
 * Get tool metadata from a method
 */
export function getToolMetadata(target: object, propertyKey: string): ToolMetadata | undefined {
  return Reflect.getMetadata(TOOL_METADATA_KEY, target, propertyKey);
}

/**
 * Get all tools from an agent class
 */
export function getAgentTools(agentClass: new (...args: unknown[]) => unknown): string[] {
  return Reflect.getMetadata(TOOLS_LIST_KEY, agentClass) || [];
}

/**
 * Check if a method is a tool
 */
export function isTool(target: object, propertyKey: string): boolean {
  return Reflect.hasMetadata(TOOL_METADATA_KEY, target, propertyKey);
}
