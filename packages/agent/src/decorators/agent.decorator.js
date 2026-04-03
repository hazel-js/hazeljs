"use strict";
/**
 * @Agent Decorator
 * Marks a class as an Agent with configuration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Agent = Agent;
exports.getRegisteredAgents = getRegisteredAgents;
exports.getAgentMetadata = getAgentMetadata;
exports.isAgent = isAgent;
require("reflect-metadata");
const AGENT_METADATA_KEY = Symbol('agent');
/**
 * Global registry of all @Agent decorated classes
 * This is populated automatically when the @Agent decorator is applied
 */
const GLOBAL_AGENT_REGISTRY = new Set();
/**
 * Agent decorator - marks a class as an agent and registers it globally
 */
function Agent(config) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    return ((target) => {
        const metadata = {
            ...config,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
            target: target,
        };
        Reflect.defineMetadata(AGENT_METADATA_KEY, metadata, target);
        // Automatically register the agent class globally
        GLOBAL_AGENT_REGISTRY.add(target);
    });
}
/**
 * Get all registered agent classes
 */
function getRegisteredAgents() {
    return Array.from(GLOBAL_AGENT_REGISTRY);
}
/**
 * Get agent metadata from a class
 */
function getAgentMetadata(target) {
    return Reflect.getMetadata(AGENT_METADATA_KEY, target);
}
/**
 * Check if a class is an agent
 */
function isAgent(target) {
    return Reflect.hasMetadata(AGENT_METADATA_KEY, target);
}
