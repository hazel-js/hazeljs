import { AIEnhancedService } from '../ai-enhanced.service';
import { ChatFacade } from '../facades/chat.facade';
import { RAGFacade } from '../facades/rag.facade';
import { AgentFacade } from '../facades/agent.facade';
import { MLFacade } from '../facades/ml.facade';
import { WorkflowFacade } from '../facades/workflow.facade';
import { AssistantFacade } from '../facades/assistant.facade';
import { HCELBuilder } from './hcel/hcel.builder';
import type {
  HazelAIConfig,
  ChatOptions,
  ClassifyOptions,
  ScoreOptions,
  AssistantConfig,
  ClassifyResult,
  SentimentResult,
  ScoreResult,
  AIMetrics,
  RAGFacadeInterface,
  WorkflowBuilder,
  AssistantInstance,
} from './hazel-ai.types';
import type { IAIProvider } from '../ai-enhanced.types';
import type { AgentExecutionResult } from '@hazeljs/agent';
import type {
  AgentGraph,
  CompiledGraph,
  GraphExecutionOptions,
  GraphExecutionResult,
  SupervisorConfig,
  SupervisorResult,
} from './agent-orchestration.types';
import { Service } from '@hazeljs/core';

/**
 * HazelAI — The unified entry point for all AI capabilities in HazelJS.
 *
 * This class provides a simple, high-level API for chat, RAG, agents,
 * classification, scoring, workflows, and assistants. It composes the
 * underlying packages (@hazeljs/ai, @hazeljs/rag, @hazeljs/agent, etc.)
 * while keeping them independently usable.
 */
@Service()
export class HazelAI {
  private chatFacade: ChatFacade;
  private ragFacade: RAGFacade;
  private agentFacade: AgentFacade;
  private mlFacade: MLFacade;
  private workflowFacade: WorkflowFacade;
  private assistantFacade: AssistantFacade;
  private aiService: AIEnhancedService;

  constructor(private config: HazelAIConfig = {}) {
    this.aiService = new AIEnhancedService(undefined, undefined, {
      onCompletion: (evt) => {
        this.config.usageHooks?.onCompletion?.({
          provider: evt.provider,
          model: evt.model,
          latencyMs: evt.latencyMs,
          error: evt.error,
          usage: evt.usage
            ? {
                promptTokens: evt.usage.promptTokens,
                completionTokens: evt.usage.completionTokens,
                totalTokens: evt.usage.totalTokens,
                estimatedCost: undefined,
              }
            : undefined,
        });
      },
    });
    this.chatFacade = new ChatFacade(this.aiService, config);
    this.ragFacade = new RAGFacade(this.aiService, config);
    this.agentFacade = new AgentFacade(this.aiService, config);
    this.mlFacade = new MLFacade(this.aiService, config);
    this.workflowFacade = new WorkflowFacade();
    this.assistantFacade = new AssistantFacade(this.aiService, config);
  }

  /**
   * Factory for standalone usage (no DI required).
   * Auto-detects providers from environment variables.
   */
  static create(config?: Partial<HazelAIConfig>): HazelAI {
    return new HazelAI(config);
  }

  // ── Chat ─────────────────────────────────────────────────

  /**
   * Send a message to the LLM and get a response.
   *
   * @param message The user message
   * @param options Optional configuration (provider, model, temperature, etc.)
   * @returns The assistant's response
   */
  async chat(message: string, options?: ChatOptions): Promise<string> {
    return this.chatFacade.chat(message, options);
  }

  /**
   * Stream a response from the LLM.
   *
   * @param message The user message
   * @param options Optional configuration
   * @returns AsyncGenerator yielding response chunks
   */
  async *stream(message: string, options?: ChatOptions): AsyncGenerator<string> {
    yield* this.chatFacade.stream(message, options);
  }

  // ── RAG ──────────────────────────────────────────────────

  /**
   * Access RAG (Retrieval-Augmented Generation) capabilities.
   */
  get rag(): RAGFacadeInterface {
    return this.ragFacade;
  }

  // ── Agents ───────────────────────────────────────────────

  /**
   * Execute an agent by name.
   *
   * @param name The registered agent name
   * @param input The input/prompt for the agent
   * @param options Optional execution options
   * @returns Agent execution result
   */
  async agent(
    name: string,
    input: string,
    options?: Record<string, unknown>
  ): Promise<AgentExecutionResult> {
    return this.agentFacade.execute(name, input, options);
  }

  /**
   * Create a multi-agent sequential pipeline (compiled graph).
   * `execute()` returns `GraphExecutionResult` (final `response` in `state.output` / `response`).
   */
  pipeline(
    id: string,
    agents: string[]
  ): {
    execute: (input: string, options?: GraphExecutionOptions) => Promise<GraphExecutionResult>;
  } {
    return this.agentFacade.pipeline(id, agents);
  }

  /**
   * Run a sequential agent pipeline in one call.
   */
  async agentPipeline(
    pipelineId: string,
    agents: string[],
    input: string,
    options?: GraphExecutionOptions
  ): Promise<GraphExecutionResult> {
    return this.agentFacade.runPipeline(pipelineId, agents, input, options);
  }

  /**
   * Run a supervisor that delegates subtasks to worker agents (LLM required on agent runtime).
   */
  async supervisor(
    config: SupervisorConfig,
    task: string,
    runOptions?: { sessionId?: string; userId?: string }
  ): Promise<SupervisorResult> {
    return this.agentFacade.runSupervisor(config, task, runOptions);
  }

  /**
   * Start building a custom `AgentGraph` for this app’s agent runtime.
   */
  async createAgentGraph(graphId: string): Promise<AgentGraph> {
    return this.agentFacade.createAgentGraph(graphId);
  }

  /**
   * Run a graph produced by `createAgentGraph(...).addNode(...).compile()`.
   */
  async runAgentGraph(
    compiled: Pick<CompiledGraph, 'execute'>,
    input: string,
    options?: GraphExecutionOptions
  ): Promise<GraphExecutionResult> {
    return this.agentFacade.runCompiledGraph(compiled, input, options);
  }

  // ── Classification ───────────────────────────────────────

  /**
   * Classify text into one of the provided labels.
   *
   * @param text The text to classify
   * @param options Labels and configuration
   * @returns Classification result with confidence
   */
  async classify(text: string, options: ClassifyOptions): Promise<ClassifyResult> {
    return this.mlFacade.classify(text, options);
  }

  /**
   * Analyze sentiment of text.
   *
   * @param text The text to analyze
   * @returns Sentiment result (positive/negative/neutral with score)
   */
  async sentiment(text: string): Promise<SentimentResult> {
    return this.mlFacade.sentiment(text);
  }

  // ── Scoring ──────────────────────────────────────────────

  /**
   * Score items against a criteria.
   *
   * @param prompt The scoring prompt/criteria
   * @param options Items to score and criteria
   * @returns Array of scores with reasoning
   */
  async score(prompt: string, options: ScoreOptions): Promise<ScoreResult[]> {
    return this.mlFacade.score(prompt, options);
  }

  // ── Workflows ────────────────────────────────────────────

  /**
   * Create a workflow builder for chaining steps.
   *
   * @param id Unique workflow identifier
   * @returns Workflow builder
   */
  workflow(id: string): WorkflowBuilder {
    return this.workflowFacade.create(id);
  }

  // ── Assistants ───────────────────────────────────────────

  /**
   * Create a conversational assistant with memory.
   *
   * @param config Assistant configuration
   * @returns Assistant instance with session management
   */
  async assistant(config: AssistantConfig): Promise<AssistantInstance> {
    return this.assistantFacade.create(config);
  }

  // ── Provider Management ──────────────────────────────────

  /**
   * Register a custom AI provider.
   *
   * @param provider The provider implementation
   */
  registerProvider(provider: IAIProvider): void {
    this.aiService.registerProvider(provider);
  }

  // ── HCEL - HazelJS Composable Expression Language ─────────────────

  /**
   * Get the HCEL builder for composable AI operations.
   *
   * HCEL provides a fluent, TypeScript-native way to compose AI operations:
   *
   * ```typescript
   * const result = await ai.hazel
   *   .prompt('Analyze: {topic}')
   *   .rag('knowledge-base')
   *   .agent('analyst')
   *   .ml('sentiment')
   *   .execute();
   * ```
   */
  get hazel(): HCELBuilder {
    return new HCELBuilder(this);
  }

  // ── Observability ────────────────────────────────────────

  /**
   * Get usage metrics and statistics.
   *
   * @returns Metrics object with request counts, token usage, costs, etc.
   */
  getMetrics(): AIMetrics {
    return this.aiService.getAIMetrics();
  }
}
