import { AgentRuntime, AgentRuntimeConfig } from './runtime/agent.runtime';
import { AgentGraph } from './graph/agent-graph';
import type { SupervisorConfig } from './graph/agent-graph.types';
import { SupervisorAgent } from './supervisor/supervisor';
import { AgentEventType } from './types/event.types';
import type { AgentContext, AgentExecutionResult, AgentStreamChunk } from './types/agent.types';
import type { LLMStreamChunk } from './types/llm.types';
type NewableFunction = new (...args: unknown[]) => unknown;
/** Token for optional GuardrailsService injection (from @hazeljs/guardrails) */
export declare const GUARDRAILS_SERVICE_TOKEN = 'GuardrailsService';
/**
 * Agent Module Options
 */
export interface AgentModuleOptions {
  runtime?: AgentRuntimeConfig;
  agents?: NewableFunction[];
  autoDiscover?: boolean;
}
/**
 * Agent Service
 * Injectable service for agent runtime
 */
export declare class AgentService {
  private runtime;
  private agentInstances;
  private discoveryComplete;
  constructor(
    guardrailsService?: {
      checkInput: (
        input: string | object,
        options?: unknown
      ) => {
        allowed: boolean;
        modified?: string | object;
        violations?: string[];
        blockedReason?: string;
      };
      checkOutput: (
        output: string | object,
        options?: unknown
      ) => {
        allowed: boolean;
        modified?: string | object;
        violations?: string[];
        blockedReason?: string;
      };
    },
    config?: AgentRuntimeConfig
  );
  /**
   * Resolve AIEnhancedService from global registry if no LLM provider is configured
   */
  private resolveLLMProvider;
  /**
   * Create an LLM provider adapter from AIEnhancedService
   * Users can call this to create an LLM provider from AIEnhancedService
   */
  static createLLMProviderFromAI(aiService: {
    complete: (request: any, config?: any) => Promise<any>;
    stream?: (request: any, config?: any) => AsyncGenerator<any>;
  }): {
    chat: (request: any) => Promise<any>;
    streamChat: (request: any) => AsyncGenerator<LLMStreamChunk>;
  };
  /**
   * Ensure agent discovery has completed
   */
  private ensureDiscovery;
  /**
   * Auto-discover @Agent decorated classes from the global registry
   */
  private autoDiscoverAgents;
  private getAgentName;
  private createAgentInstance;
  getRuntime(): AgentRuntime;
  /**
   * Build a compiled sequential pipeline graph (same as `AgentRuntime.pipeline`).
   */
  pipeline(pipelineId: string, agentNames: string[]): ReturnType<AgentRuntime['pipeline']>;
  /**
   * Create a supervisor that routes tasks to worker agents (requires LLM on runtime).
   */
  createSupervisor(config: SupervisorConfig): SupervisorAgent;
  /**
   * Start building a custom multi-agent graph for this runtime.
   */
  createGraph(graphId: string): AgentGraph;
  execute(
    agentName: string,
    input: string,
    options?: Record<string, unknown>
  ): Promise<AgentExecutionResult>;
  resume(executionId: string, input?: string): Promise<AgentExecutionResult>;
  getContext(executionId: string): Promise<AgentContext | undefined>;
  /**
   * Execute with streaming; yields step and token chunks when LLM supports streamChat.
   */
  executeStream(
    agentName: string,
    input: string,
    options?: Record<string, unknown>
  ): AsyncGenerator<AgentStreamChunk>;
  /**
   * Cancel an in-flight execution by executionId.
   */
  cancel(executionId: string): void;
  on(type: AgentEventType, handler: (event: unknown) => void): void;
  getAgents(): unknown[];
  approveToolExecution(requestId: string, approvedBy: string): void;
  rejectToolExecution(requestId: string): void;
  getPendingApprovals(): unknown[];
}
/**
 * Agent Module
 * Uses static configuration pattern compatible with HazelJS DI
 */
export declare class AgentModule {
  private static options;
  static forRoot(config?: AgentModuleOptions): typeof AgentModule;
  static getOptions(): AgentModuleOptions;
  /**
   * Create an LLM provider from AIEnhancedService
   *
   * @example
   * ```typescript
   * import { AIEnhancedService } from '@hazeljs/ai';
   *
   * AgentModule.forRoot({
   *   runtime: {
   *     llmProvider: AgentService.createLLMProviderFromAI(
   *       (global as any).__HAZELJS_AI_ENHANCED_SERVICE__
   *     ),
   *   },
   * })
   * ```
   */
  static createLLMProviderFromAI: typeof AgentService.createLLMProviderFromAI;
}
export {};
//# sourceMappingURL=agent.module.d.ts.map
