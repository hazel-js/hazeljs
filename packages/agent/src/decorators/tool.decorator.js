"use strict";
/**
 * @Tool Decorator
 * Marks a method as a tool that can be used by agents
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tool = Tool;
exports.getToolMetadata = getToolMetadata;
exports.getAgentTools = getAgentTools;
exports.isTool = isTool;
require("reflect-metadata");
const TOOL_METADATA_KEY = Symbol('tool');
const TOOLS_LIST_KEY = Symbol('tools');
/**
 * Tool decorator - marks a method as a tool
 */
function Tool(config) {
    return (target, propertyKey, descriptor) => {
        const methodName = String(propertyKey);
        const metadata = {
            name: config?.name || methodName,
            description: config?.description || `Tool: ${methodName}`,
            parameters: config?.parameters || [],
            schema: config?.schema,
            requiresApproval: config?.requiresApproval || false,
            timeout: config?.timeout || 30000,
            retries: config?.retries || 0,
            policy: config?.policy,
            metadata: config?.metadata,
            target,
            propertyKey: methodName,
            method: descriptor.value,
            agentClass: target.constructor,
        };
        Reflect.defineMetadata(TOOL_METADATA_KEY, metadata, target, propertyKey);
        const existingTools = Reflect.getMetadata(TOOLS_LIST_KEY, target.constructor) || [];
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
function getToolMetadata(target, propertyKey) {
    return Reflect.getMetadata(TOOL_METADATA_KEY, target, propertyKey);
}
/**
 * Get all tools from an agent class
 */
function getAgentTools(agentClass) {
    return Reflect.getMetadata(TOOLS_LIST_KEY, agentClass) || [];
}
/**
 * Check if a method is a tool
 */
function isTool(target, propertyKey) {
    return Reflect.hasMetadata(TOOL_METADATA_KEY, target, propertyKey);
}
