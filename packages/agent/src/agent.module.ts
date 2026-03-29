import { Service, Inject, HazelModule } from '@hazeljs/core';
import { AgentRuntime, AgentRuntimeConfig } from './runtime/agent.runtime';
import { AgentEventType } from './types/event.types';
import { getAgentMetadata, getRegisteredAgents } from './decorators/agent.decorator';
import type { AgentContext, AgentExecutionResult, AgentStreamChunk } from './types/agent.types';
import type { LLMStreamChunk } from './types/llm.types';

type NewableFunction = new (...args: unknown[]) => unknown;

/** Token for optional GuardrailsService injection (from @hazeljs/guardrails) */
export const GUARDRAILS_SERVICE_TOKEN = 'GuardrailsService';

// Define interface for AIEnhancedService to avoid circular dependency
interface _IAIEnhancedService {
  complete: (request: unknown, config?: unknown) => Promise<unknown>;
  stream: (request: unknown, config?: unknown) => AsyncGenerator<unknown>;
}

/**
 * Agent Module Options
 */
export interface AgentModuleOptions {
  runtime?: AgentRuntimeConfig;
  agents?: NewableFunction[];
  autoDiscover?: boolean; // Enable auto-discovery of @Agent decorated classes
}

/**
 * Agent Service
 * Injectable service for agent runtime
 */
@Service()
export class AgentService {
  private runtime: AgentRuntime;
  private agentInstances: Map<string, unknown> = new Map();
  private discoveryComplete = false;

  constructor(
    @Inject(GUARDRAILS_SERVICE_TOKEN)
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
    config: AgentRuntimeConfig = {}
  ) {
    const moduleOpts = AgentModule.getOptions();

    const runtimeConfig: AgentRuntimeConfig = {
      ...(moduleOpts.runtime || config),
      guardrailsService:
        guardrailsService ?? moduleOpts.runtime?.guardrailsService ?? config.guardrailsService,
      llmProvider: moduleOpts.runtime?.llmProvider ?? config.llmProvider,
    };
    this.runtime = new AgentRuntime(runtimeConfig);

    // Defer agent discovery and LLM provider resolution until after all modules are loaded
    setImmediate(() => {
      this.autoDiscoverAgents();
      this.resolveLLMProvider();
    });
  }

  /**
   * Resolve AIEnhancedService from global registry if no LLM provider is configured
   */
  private resolveLLMProvider(retryCount = 0): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aiService = (global as any).__HAZELJS_AI_ENHANCED_SERVICE__;

    if (aiService && typeof aiService.complete === 'function') {
      const llmProvider = AgentService.createLLMProviderFromAI(aiService);
      this.runtime.setLLMProvider(llmProvider);
      // eslint-disable-next-line no-console
      console.log('AgentService: ✓ LLM provider configured from AIEnhancedService');
    } else if (retryCount < 10) {
      setTimeout(() => this.resolveLLMProvider(retryCount + 1), 50);
    }
  }

  /**
   * Create an LLM provider adapter from AIEnhancedService
   * Users can call this to create an LLM provider from AIEnhancedService
   */
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-inferrable-types, @typescript-eslint/explicit-module-boundary-types */
  static createLLMProviderFromAI(aiService: {
    complete: (request: any, config?: any) => Promise<any>;
    stream?: (request: any, config?: any) => AsyncGenerator<any>;
  }): {
    chat: (request: any) => Promise<any>;
    streamChat: (request: any) => AsyncGenerator<LLMStreamChunk>;
  } {
    return {
      async chat(request: any): Promise<any> {
        try {
          const msgs = request.messages as Array<{ role: string; content: string }>;

          // Don't pass tools on follow-up calls that already have tool results in history.
          // The executor appends the user input last, so if there are assistant messages
          // before the final user message they are tool summaries — the LLM should
          // synthesise a final answer, not call tools again.
          const hasToolResultsInHistory = msgs.some(
            (m) =>
              m.role === 'assistant' &&
              typeof m.content === 'string' &&
              m.content.startsWith('[Tool:')
          );

          // Map LLMToolDefinition[] → AIFunction[] (extract .function wrapper)
          const functions =
            !hasToolResultsInHistory && request.tools && request.tools.length > 0
              ? (
                  request.tools as Array<{
                    function: { name: string; description: string; parameters: unknown };
                  }>
                ).map((t) => t.function)
              : undefined;

          const aiRequest = {
            messages: msgs,
            temperature: request.temperature,
            maxTokens: request.maxTokens,
            ...(functions ? { functions, functionCall: 'auto' as const } : {}),
          };

          const response = (await aiService.complete(aiRequest)) as {
            content: string;
            functionCall?: { name: string; arguments: string };
            toolCalls?: Array<{
              id: string;
              type: string;
              function: { name: string; arguments: string };
            }>;
            usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
          };

          // Handle both toolCalls (new) and functionCall (legacy) formats
          const tool_calls =
            response.toolCalls && response.toolCalls.length > 0
              ? response.toolCalls.map((tc) => ({ ...tc, type: 'function' as const }))
              : response.functionCall
                ? [
                    {
                      id: `call_${Date.now()}`,
                      type: 'function' as const,
                      function: {
                        name: response.functionCall.name,
                        arguments: response.functionCall.arguments,
                      },
                    },
                  ]
                : undefined;

          return {
            content: response.content || '',
            tool_calls,
            usage: response.usage,
          };
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('AgentService: LLM adapter error:', error);
          throw error;
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async *streamChat(request: any): AsyncGenerator<LLMStreamChunk> {
        if (!aiService.stream) {
          throw new Error('AIEnhancedService does not support streaming');
        }

        const stream = aiService.stream({
          messages: request.messages,
          functions: request.tools,
        });

        for await (const chunk of stream) {
          yield chunk as LLMStreamChunk;
        }
      },
    };
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-inferrable-types, @typescript-eslint/explicit-module-boundary-types */
  }

  /**
   * Ensure agent discovery has completed
   */
  private ensureDiscovery(): void {
    if (!this.discoveryComplete) {
      this.autoDiscoverAgents();
    }
  }

  /**
   * Auto-discover @Agent decorated classes from the global registry
   */
  private autoDiscoverAgents(): void {
    if (this.discoveryComplete) {
      return;
    }

    try {
      // Get all registered agents from the global registry
      const registeredAgents = getRegisteredAgents();

      for (const agentClass of registeredAgents) {
        try {
          // Register the agent class with the runtime
          this.runtime.registerAgent(agentClass);

          // Get agent name from metadata
          const agentName = this.getAgentName(agentClass);

          // Create and register instance
          const agentInstance = this.createAgentInstance(agentClass, agentName);
          this.runtime.registerAgentInstance(agentName, agentInstance);
          this.agentInstances.set(agentName, agentInstance);
        } catch (_error) {
          // eslint-disable-next-line no-console
          console.warn(`AgentService: Failed to register agent ${agentClass.name}:`, _error);
        }
      }

      this.discoveryComplete = true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('AgentService: Auto-discovery failed:', error);
    }
  }

  private getAgentName(agentClass: NewableFunction): string {
    // Try to get the agent name from the @Agent decorator metadata
    const metadata = getAgentMetadata(agentClass);
    if (metadata && metadata.name) {
      return metadata.name;
    }

    // Fallback to class name
    return agentClass.name.toLowerCase().replace('agent', '-agent');
  }

  private createAgentInstance(agentClass: NewableFunction, _agentName: string): unknown {
    // Create instance with runtime injection
    try {
      const instance = new agentClass(this.runtime);
      return instance;
    } catch {
      // Try without dependencies
      const instance = new agentClass();
      return instance;
    }
  }

  getRuntime(): AgentRuntime {
    this.ensureDiscovery();
    return this.runtime;
  }

  async execute(
    agentName: string,
    input: string,
    options?: Record<string, unknown>
  ): Promise<AgentExecutionResult> {
    this.ensureDiscovery();
    return this.runtime.execute(
      agentName,
      input,
      options as Parameters<AgentRuntime['execute']>[2]
    );
  }

  async resume(executionId: string, input?: string): Promise<AgentExecutionResult> {
    return this.runtime.resume(executionId, input);
  }

  async getContext(executionId: string): Promise<AgentContext | undefined> {
    return this.runtime.getContext(executionId);
  }

  /**
   * Execute with streaming; yields step and token chunks when LLM supports streamChat.
   */
  async *executeStream(
    agentName: string,
    input: string,
    options?: Record<string, unknown>
  ): AsyncGenerator<AgentStreamChunk> {
    yield* this.runtime.executeStream(
      agentName,
      input,
      options as Parameters<AgentRuntime['executeStream']>[2]
    );
  }

  /**
   * Cancel an in-flight execution by executionId.
   */
  cancel(executionId: string): void {
    this.runtime.cancel(executionId);
  }

  on(type: AgentEventType, handler: (event: unknown) => void): void {
    return this.runtime.on(type, handler);
  }

  getAgents(): unknown[] {
    this.ensureDiscovery();
    return this.runtime.getAgents();
  }

  approveToolExecution(requestId: string, approvedBy: string): void {
    return this.runtime.approveToolExecution(requestId, approvedBy);
  }

  rejectToolExecution(requestId: string): void {
    return this.runtime.rejectToolExecution(requestId);
  }

  getPendingApprovals(): unknown[] {
    return this.runtime.getPendingApprovals();
  }
}

/**
 * Agent Module
 * Uses static configuration pattern compatible with HazelJS DI
 */
@HazelModule({
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {
  private static options: AgentModuleOptions = {};

  static forRoot(config: AgentModuleOptions = {}): typeof AgentModule {
    AgentModule.options = config;
    return AgentModule;
  }

  static getOptions(): AgentModuleOptions {
    return AgentModule.options;
  }

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
  // Delegate to AgentService implementation
  static createLLMProviderFromAI = AgentService.createLLMProviderFromAI;
}
