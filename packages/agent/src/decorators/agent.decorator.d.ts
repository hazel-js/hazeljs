/**
 * @Agent Decorator
 * Marks a class as an Agent with configuration
 */
import 'reflect-metadata';
import { AgentConfig, AgentMetadata } from '../types/agent.types';
type NewableFunction = new (...args: unknown[]) => unknown;
/**
 * Agent decorator - marks a class as an agent and registers it globally
 */
export declare function Agent(config: AgentConfig): ClassDecorator;
/**
 * Get all registered agent classes
 */
export declare function getRegisteredAgents(): NewableFunction[];
/**
 * Get agent metadata from a class
 */
export declare function getAgentMetadata(target: NewableFunction): AgentMetadata | undefined;
/**
 * Check if a class is an agent
 */
export declare function isAgent(target: NewableFunction): boolean;
export {};
//# sourceMappingURL=agent.decorator.d.ts.map
