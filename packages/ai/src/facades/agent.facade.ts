import { AIEnhancedService } from '../ai-enhanced.service';
import type { HazelAIConfig } from '../platform/hazel-ai.types';
import type {
  AgentGraph,
  CompiledGraph,
  GraphExecutionOptions,
  GraphExecutionResult,
  SupervisorConfig,
  SupervisorResult,
} from '../platform/agent-orchestration.types';
import type { AgentExecutionResult } from '@hazeljs/agent';

/**
 * Agent Facade — Provides high-level agent execution APIs.
 *
 * This facade lazily loads @hazeljs/agent and provides simple methods
 * for executing agents, multi-agent pipelines, supervisors, and graphs.
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
   */
  private async ensureAgent(): Promise<void> {
    if (this.resolved) return;

    if (this.config.agentService) {
      this.agentService = this.config.agentService;
      this.resolved = true;
      return;
    }

    try {
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
   * Run a compiled sequential pipeline of registered agents (uses `AgentRuntime.pipeline`).
   */
  async runPipeline(
    pipelineId: string,
    agents: string[],
    input: string,
    options?: GraphExecutionOptions
  ): Promise<GraphExecutionResult> {
    await this.ensureAgent();
    const service = this.agentService as {
      pipeline: (id: string, agentNames: string[]) => CompiledGraph;
    };
    const compiled = service.pipeline(pipelineId, agents);
    return compiled.execute(input, options) as Promise<GraphExecutionResult>;
  }

  /**
   * Run a supervisor that delegates to worker agents (requires LLM on agent runtime).
   */
  async runSupervisor(
    config: SupervisorConfig,
    task: string,
    runOptions?: { sessionId?: string; userId?: string }
  ): Promise<SupervisorResult> {
    await this.ensureAgent();
    const service = this.agentService as {
      createSupervisor: (c: SupervisorConfig) => {
        run: (
          task: string,
          options?: { sessionId?: string; userId?: string }
        ) => Promise<SupervisorResult>;
      };
    };
    const supervisor = service.createSupervisor(config);
    return supervisor.run(task, runOptions) as Promise<SupervisorResult>;
  }

  /**
   * Obtain an `AgentGraph` builder bound to the shared runtime (call `.compile()` then pass to HCEL or run `.execute()`).
   */
  async createAgentGraph(graphId: string): Promise<AgentGraph> {
    await this.ensureAgent();
    const service = this.agentService as {
      createGraph: (id: string) => AgentGraph;
    };
    return service.createGraph(graphId) as AgentGraph;
  }

  /**
   * Execute a pre-compiled graph (from `createAgentGraph(...).compile()`).
   */
  async runCompiledGraph(
    compiled: Pick<CompiledGraph, 'execute'>,
    input: string,
    options?: GraphExecutionOptions
  ): Promise<GraphExecutionResult> {
    return compiled.execute(input, options) as Promise<GraphExecutionResult>;
  }

  /**
   * Lazy pipeline handle — prefer `runPipeline` for one-shot execution.
   *
   * @deprecated The returned `execute` resolves to `GraphExecutionResult`, not `AgentExecutionResult`.
   */
  pipeline(
    id: string,
    agents: string[]
  ): {
    execute: (input: string, options?: GraphExecutionOptions) => Promise<GraphExecutionResult>;
  } {
    const ensureAgent = this.ensureAgent.bind(this);
    const agentService = this.agentService;

    return {
      async execute(input: string, options?: GraphExecutionOptions): Promise<GraphExecutionResult> {
        await ensureAgent();
        const service = agentService as {
          pipeline: (pipelineId: string, agentNames: string[]) => CompiledGraph;
        };
        return service
          .pipeline(id, agents)
          .execute(input, options) as Promise<GraphExecutionResult>;
      },
    };
  }
}
