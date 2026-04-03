/**
 * Agent Registry
 * Central registry for all agents in the system
 */
import { AgentMetadata } from '../types/agent.types';
/**
 * Agent Registry - manages agent registration and lookup
 */
export declare class AgentRegistry {
    private agents;
    private instances;
    /**
     * Register an agent class
     */
    register(agentClass: new (...args: unknown[]) => unknown): void;
    /**
     * Register an agent instance
     */
    registerInstance(agentName: string, instance: unknown): void;
    /**
     * Get agent metadata by name
     */
    getAgent(name: string): AgentMetadata | undefined;
    /**
     * Get agent instance by name
     */
    getInstance(name: string): unknown | undefined;
    /**
     * Get all registered agents
     */
    getAllAgents(): AgentMetadata[];
    /**
     * Check if an agent is registered
     */
    hasAgent(name: string): boolean;
    /**
     * Unregister an agent
     */
    unregister(name: string): void;
    /**
     * Clear all agents
     */
    clear(): void;
    /**
     * Get agent count
     */
    get count(): number;
}
//# sourceMappingURL=agent.registry.d.ts.map