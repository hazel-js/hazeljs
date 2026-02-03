/**
 * Agent Registry
 * Central registry for all agents in the system
 */

import { AgentMetadata } from '../types/agent.types';
import { getAgentMetadata, isAgent } from '../decorators/agent.decorator';

/**
 * Agent Registry - manages agent registration and lookup
 */
export class AgentRegistry {
  private agents: Map<string, AgentMetadata> = new Map();
  private instances: Map<string, unknown> = new Map();

  /**
   * Register an agent class
   */
  register(agentClass: new (...args: unknown[]) => unknown): void {
    if (!isAgent(agentClass)) {
      throw new Error(`Class ${agentClass.name} is not decorated with @Agent`);
    }

    const metadata = getAgentMetadata(agentClass);
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
  registerInstance(agentName: string, instance: unknown): void {
    if (!this.agents.has(agentName)) {
      throw new Error(`Agent ${agentName} is not registered`);
    }

    this.instances.set(agentName, instance);

    const metadata = this.agents.get(agentName)!;
    metadata.instance = instance;
  }

  /**
   * Get agent metadata by name
   */
  getAgent(name: string): AgentMetadata | undefined {
    return this.agents.get(name);
  }

  /**
   * Get agent instance by name
   */
  getInstance(name: string): unknown | undefined {
    return this.instances.get(name);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): AgentMetadata[] {
    return Array.from(this.agents.values());
  }

  /**
   * Check if an agent is registered
   */
  hasAgent(name: string): boolean {
    return this.agents.has(name);
  }

  /**
   * Unregister an agent
   */
  unregister(name: string): void {
    this.agents.delete(name);
    this.instances.delete(name);
  }

  /**
   * Clear all agents
   */
  clear(): void {
    this.agents.clear();
    this.instances.clear();
  }

  /**
   * Get agent count
   */
  get count(): number {
    return this.agents.size;
  }
}
