/**
 * @Agent Decorator
 * Marks a class as an Agent with configuration
 */

import 'reflect-metadata';
import { AgentConfig, AgentMetadata } from '../types/agent.types';

type NewableFunction = new (...args: unknown[]) => unknown;

const AGENT_METADATA_KEY = Symbol('agent');

/**
 * Global registry of all @Agent decorated classes
 * This is populated automatically when the @Agent decorator is applied
 */
const GLOBAL_AGENT_REGISTRY = new Set<NewableFunction>();

/**
 * Agent decorator - marks a class as an agent and registers it globally
 */
export function Agent(config: AgentConfig): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  return ((target: Function) => {
    const metadata: AgentMetadata = {
      ...config,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      target: target as NewableFunction,
    };

    Reflect.defineMetadata(AGENT_METADATA_KEY, metadata, target);

    // Automatically register the agent class globally
    GLOBAL_AGENT_REGISTRY.add(target as NewableFunction);
  }) as ClassDecorator;
}

/**
 * Get all registered agent classes
 */
export function getRegisteredAgents(): NewableFunction[] {
  return Array.from(GLOBAL_AGENT_REGISTRY);
}

/**
 * Get agent metadata from a class
 */
export function getAgentMetadata(target: NewableFunction): AgentMetadata | undefined {
  return Reflect.getMetadata(AGENT_METADATA_KEY, target);
}

/**
 * Check if a class is an agent
 */
export function isAgent(target: NewableFunction): boolean {
  return Reflect.hasMetadata(AGENT_METADATA_KEY, target);
}
