import { AIEnhancedService } from '../ai-enhanced.service';
import type { HazelAIConfig } from '../platform/hazel-ai.types';
import type { AgentExecutionResult } from '@hazeljs/agent';

/**
 * Agent Facade — Provides high-level agent execution APIs.
 *
 * This facade lazily loads @hazeljs/agent and provides simple methods
 * for executing agents and creating multi-agent pipelines. It gracefully
 * handles missing @hazeljs/agent with helpful errors.
 */
export class AgentFacade {
  private agentService: unknown = null;
  private resolved = false;

  constructor(
    private aiService: AIEnhancedService,
    private config: HazelAIConfig
  ) {}

  /**
   * Ensure @hazeljs/agent is loaded and initialized.
   * Throws a helpful error if the package is not installed.
   */
  private async ensureAgent(): Promise<void> {
    if (this.resolved) return;

    try {
      // Dynamically import @hazeljs/agent
      const { AgentService } = await import('@hazeljs/agent');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.agentService = new AgentService(this.aiService as any);
      this.resolved = true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Cannot find module')) {
        throw new Error(
          '@hazeljs/agent is required for agent features. Install it:\n' +
            '  npm install @hazeljs/agent'
        );
      }
      throw error;
    }
  }

  /**
   * Execute an agent by name.
   *
   * @param name The registered agent name
   * @param input The input/prompt for the agent
   * @param options Optional execution options
   * @returns Agent execution result
   */
  async execute(
    name: string,
    input: string,
    options?: Record<string, unknown>
  ): Promise<AgentExecutionResult> {
    await this.ensureAgent();
    const service = this.agentService as {
      execute: (
        name: string,
        input: string,
        options?: Record<string, unknown>
      ) => Promise<AgentExecutionResult>;
    };
    return service.execute(name, input, options);
  }

  /**
   * Create a multi-agent pipeline.
   *
   * @param id Unique pipeline identifier
   * @param agents Array of agent names in execution order
   * @returns Pipeline executor
   */
  pipeline(
    id: string,
    agents: string[]
  ): { execute: (input: string) => Promise<AgentExecutionResult> } {
    const ensureAgent = this.ensureAgent.bind(this);
    const agentService = this.agentService;

    return {
      async execute(input: string): Promise<AgentExecutionResult> {
        await ensureAgent();
        const service = agentService as {
          pipeline: (
            id: string,
            agents: string[]
          ) => { execute: (input: string) => Promise<AgentExecutionResult> };
        };
        return service.pipeline(id, agents).execute(input);
      },
    };
  }
}
