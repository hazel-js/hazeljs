"use strict";
/**
 * Agent Registry
 * Central registry for all agents in the system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRegistry = void 0;
const agent_decorator_1 = require("../decorators/agent.decorator");
/**
 * Agent Registry - manages agent registration and lookup
 */
class AgentRegistry {
    constructor() {
        this.agents = new Map();
        this.instances = new Map();
    }
    /**
     * Register an agent class
     */
    register(agentClass) {
        if (!(0, agent_decorator_1.isAgent)(agentClass)) {
            throw new Error(`Class ${agentClass.name} is not decorated with @Agent`);
        }
        const metadata = (0, agent_decorator_1.getAgentMetadata)(agentClass);
        if (!metadata) {
            throw new Error(`Failed to get metadata for agent ${agentClass.name}`);
        }
        if (this.agents.has(metadata.name)) {
            throw new Error(`Agent ${metadata.name} is already registered`);
        }
        this.agents.set(metadata.name, metadata);
    }
    /**
     * Register an agent instance
     */
    registerInstance(agentName, instance) {
        if (!this.agents.has(agentName)) {
            throw new Error(`Agent ${agentName} is not registered`);
        }
        this.instances.set(agentName, instance);
        const metadata = this.agents.get(agentName);
        metadata.instance = instance;
    }
    /**
     * Get agent metadata by name
     */
    getAgent(name) {
        return this.agents.get(name);
    }
    /**
     * Get agent instance by name
     */
    getInstance(name) {
        return this.instances.get(name);
    }
    /**
     * Get all registered agents
     */
    getAllAgents() {
        return Array.from(this.agents.values());
    }
    /**
     * Check if an agent is registered
     */
    hasAgent(name) {
        return this.agents.has(name);
    }
    /**
     * Unregister an agent
     */
    unregister(name) {
        this.agents.delete(name);
        this.instances.delete(name);
    }
    /**
     * Clear all agents
     */
    clear() {
        this.agents.clear();
        this.instances.clear();
    }
    /**
     * Get agent count
     */
    get count() {
        return this.agents.size;
    }
}
exports.AgentRegistry = AgentRegistry;
