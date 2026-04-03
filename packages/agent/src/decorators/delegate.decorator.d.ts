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
import { DelegateConfig } from '../graph/agent-graph.types';
/**
 * Decorate a method to delegate its execution to another agent.
 *
 * When `AgentRuntime.registerAgentInstance()` is called, it patches each
 * `@Delegate` method on the instance to actually call
 * `runtime.execute(config.agent, input)` where `input` is extracted from the
 * tool call arguments using `config.inputField` (default: `'input'`).
 */
export declare function Delegate(config: DelegateConfig): MethodDecorator;
/**
 * Retrieve the `@Delegate` config from a method.
 */
export declare function getDelegateMetadata(target: object, propertyKey: string): DelegateConfig | undefined;
/**
 * Get the names of all `@Delegate`-decorated methods on a class.
 */
export declare function getDelegatedMethods(agentClass: new (...args: unknown[]) => unknown): string[];
/**
 * Check if a method has the `@Delegate` decorator.
 */
export declare function isDelegate(target: object, propertyKey: string): boolean;
//# sourceMappingURL=delegate.decorator.d.ts.map