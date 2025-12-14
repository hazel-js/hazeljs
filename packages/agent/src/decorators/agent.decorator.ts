/**
 * @Agent Decorator
 * Marks a class as an Agent with configuration
 */

import 'reflect-metadata';
import { AgentConfig, AgentMetadata } from '../types/agent.types';

type NewableFunction = new (...args: unknown[]) => unknown;

const AGENT_METADATA_KEY = Symbol('agent');

/**
 * Agent decorator - marks a class as an agent
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
  }) as ClassDecorator;
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
