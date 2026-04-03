"use strict";
/**
 * Tool Registry
 * Central registry for all tools in the system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistry = void 0;
const tool_decorator_1 = require("../decorators/tool.decorator");
const zod_to_json_schema_1 = require("zod-to-json-schema");
/**
 * Tool Registry - manages tool registration and lookup
 */
class ToolRegistry {
    constructor() {
        this.tools = new Map();
        this.agentTools = new Map();
    }
    /**
     * Register tools from an agent instance
     */
    registerAgentTools(agentName, agentInstance) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const agentClass = agentInstance.constructor;
        const toolNames = (0, tool_decorator_1.getAgentTools)(agentClass);
        if (toolNames.length === 0) {
            return;
        }
        const agentToolSet = new Set();
        for (const toolName of toolNames) {
            const metadata = (0, tool_decorator_1.getToolMetadata)(agentInstance, toolName);
            if (!metadata) {
                // Tool metadata not found, skip
                continue;
            }
            // Use metadata.name (the configured tool name, e.g. 'WeatherAgent' for @Delegate)
            // rather than the method name, so the LLM-returned function name matches the key.
            const registeredName = metadata.name || toolName;
            const fullToolName = `${agentName}.${registeredName}`;
            if (this.tools.has(fullToolName)) {
                // Tool already registered, skip
                continue;
            }
            // Update metadata to use the actual instance instead of prototype
            const instanceMetadata = {
                ...metadata,
                target: agentInstance,
            };
            this.tools.set(fullToolName, instanceMetadata);
            agentToolSet.add(fullToolName);
        }
        this.agentTools.set(agentName, agentToolSet);
    }
    /**
     * Get tool metadata by name
     */
    getTool(toolName) {
        return this.tools.get(toolName);
    }
    /**
     * Get all tools for an agent
     */
    getAgentTools(agentName) {
        const toolNames = this.agentTools.get(agentName);
        if (!toolNames) {
            return [];
        }
        return Array.from(toolNames)
            .map((name) => this.tools.get(name))
            .filter((tool) => tool !== undefined);
    }
    /**
     * Get all registered tools
     */
    getAllTools() {
        return Array.from(this.tools.values());
    }
    /**
     * Check if a tool is registered
     */
    hasTool(toolName) {
        return this.tools.has(toolName);
    }
    /**
     * Get tool definitions for LLM (OpenAI function calling format)
     */
    getToolDefinitions(agentName) {
        const tools = this.getAgentTools(agentName);
        return tools.map((tool) => {
            // Modern path: Zod schema available
            if (tool.schema) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const jsonSchema = (0, zod_to_json_schema_1.zodToJsonSchema)(tool.schema);
                return {
                    name: tool.name,
                    description: tool.description,
                    parameters: {
                        type: 'object',
                        properties: jsonSchema.properties ?? {},
                        required: jsonSchema.required ?? [],
                    },
                };
            }
            // Legacy path: manual parameters array
            const properties = {};
            const required = [];
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
    unregisterAgentTools(agentName) {
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
    clear() {
        this.tools.clear();
        this.agentTools.clear();
    }
    /**
     * Get tool count
     */
    get count() {
        return this.tools.size;
    }
    /**
     * Convert tool definitions to LLM format (OpenAI function calling)
     */
    getToolDefinitionsForLLM(agentName) {
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
exports.ToolRegistry = ToolRegistry;
