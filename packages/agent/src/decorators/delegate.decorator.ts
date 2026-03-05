/**
 * @Delegate Decorator
 *
 * Marks a method on an agent class as a delegation point to another agent.
 * The method body is replaced at runtime by `AgentRuntime.registerAgentInstance()`,
 * which patches it with an actual call to `runtime.execute(targetAgent, input)`.
 *
 * This lets the LLM naturally "call" other agents as if they were tools —
 * the agent-to-agent communication is completely transparent to the LLM.
 *
 * @example
 * ```ts
 * @Agent({
 *   name: 'orchestrator',
 *   description: 'Orchestrates research and writing tasks',
 * })
 * class OrchestratorAgent {
 *   // The LLM can call this as a tool; it internally runs ResearchAgent
 *   @Delegate({
 *     agent: 'ResearchAgent',
 *     description: 'Research a topic in depth and return key findings',
 *     inputField: 'query',
 *   })
 *   async researchTopic(query: string): Promise<string> {
 *     return ''; // body is replaced at runtime
 *   }
 *
 *   // The LLM can call this as a tool; it internally runs WriterAgent
 *   @Delegate({
 *     agent: 'WriterAgent',
 *     description: 'Write a professional article based on provided research',
 *     inputField: 'content',
 *   })
 *   async writeArticle(content: string): Promise<string> {
 *     return ''; // body is replaced at runtime
 *   }
 * }
 * ```
 *
 * Note: @Delegate implicitly registers the method as a @Tool.
 * You do NOT need to add @Tool separately.
 */

import 'reflect-metadata';
import {
  DelegateConfig,
  DELEGATE_METADATA_KEY,
  DELEGATES_LIST_KEY,
} from '../graph/agent-graph.types';
import { Tool } from './tool.decorator';

/**
 * Decorate a method to delegate its execution to another agent.
 *
 * When `AgentRuntime.registerAgentInstance()` is called, it patches each
 * `@Delegate` method on the instance to actually call
 * `runtime.execute(config.agent, input)` where `input` is extracted from the
 * tool call arguments using `config.inputField` (default: `'input'`).
 */
export function Delegate(config: DelegateConfig): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const methodName = String(propertyKey);

    // Store delegate-specific metadata
    Reflect.defineMetadata(DELEGATE_METADATA_KEY, config, target, propertyKey);

    // Track all delegated methods on the class for fast lookup
    const existing: string[] = Reflect.getMetadata(DELEGATES_LIST_KEY, target.constructor) ?? [];
    if (!existing.includes(methodName)) {
      existing.push(methodName);
      Reflect.defineMetadata(DELEGATES_LIST_KEY, existing, target.constructor);
    }

    // Also register as a @Tool so the LLM sees it in the tool list.
    // The parameter list mirrors how the LLM will call it.
    const inputField = config.inputField ?? 'input';
    const toolDecorator = Tool({
      name: config.agent,
      description: config.description,
      parameters: [
        {
          name: inputField,
          type: 'string',
          description: `Input for ${config.agent}`,
          required: true,
        },
      ],
    });

    toolDecorator(target, propertyKey, descriptor);

    return descriptor;
  };
}

/**
 * Retrieve the `@Delegate` config from a method.
 */
export function getDelegateMetadata(
  target: object,
  propertyKey: string
): DelegateConfig | undefined {
  return Reflect.getMetadata(DELEGATE_METADATA_KEY, target, propertyKey);
}

/**
 * Get the names of all `@Delegate`-decorated methods on a class.
 */
export function getDelegatedMethods(agentClass: new (...args: unknown[]) => unknown): string[] {
  return Reflect.getMetadata(DELEGATES_LIST_KEY, agentClass) ?? [];
}

/**
 * Check if a method has the `@Delegate` decorator.
 */
export function isDelegate(target: object, propertyKey: string): boolean {
  return Reflect.hasMetadata(DELEGATE_METADATA_KEY, target, propertyKey);
}
