/**
 * HCEL Operations - Bridge to existing HazelAI facades
 */

import type { HazelAI } from '../hazel-ai';
import type {
  HCELOperation,
  HCELContext,
  PromptOperationConfig,
  RAGOperationConfig,
  AgentOperationConfig,
  MLOperationConfig,
  ParallelOperationConfig,
  ConditionalOperationConfig,
  SequenceOperationConfig,
  HCELOperationMetadata,
  MemoryRecallOperationConfig,
  MemorySaveOperationConfig,
  MemorySearchOperationConfig,
  AgentPipelineOperationConfig,
  AgentSupervisorOperationConfig,
  AgentGraphCompiledOperationConfig,
} from './hcel.types';
import { HCELError } from './hcel.error';
import type { MemoryItem } from '@hazeljs/memory';
import type { ClassifyOptions, ScoreOptions, RAGResult } from '../hazel-ai.types';
import type { AgentExecutionResult } from '@hazeljs/agent';
import type {
  CompiledGraph,
  GraphExecutionResult,
  SupervisorResult,
} from '../agent-orchestration.types';

// ── Prompt Operation ─────────────────────────────────────────────

export class PromptOperation implements HCELOperation<string, string> {
  id: string;
  type = 'prompt';
  metadata: HCELOperationMetadata;

  constructor(
    private ai: HazelAI,
    public config: PromptOperationConfig
  ) {
    this.id = `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.metadata = {
      name: 'prompt',
      description: 'Generate text using LLM prompt',
      streaming: config.responseFormat === 'text',
      retriable: true,
    };
  }

  /** Build the user message sent to the LLM (template + variables + input). */
  static buildMessage(config: PromptOperationConfig, input: string): string {
    let prompt = config.template;
    if (config.variables) {
      for (const [key, value] of Object.entries(config.variables)) {
        prompt = prompt.replace(new RegExp(`{${key}}`, 'g'), String(value));
      }
    }
    return prompt || input;
  }

  async execute(input: string, _context: HCELContext): Promise<string> {
    const message = PromptOperation.buildMessage(this.config, input);
    return this.ai.chat(message, {
      provider: this.config.provider,
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      systemPrompt: this.config.systemPrompt,
      responseFormat: this.config.responseFormat,
    });
  }

  async *streamChunks(input: string, _context: HCELContext): AsyncGenerator<string> {
    const message = PromptOperation.buildMessage(this.config, input);
    yield* this.ai.stream(message, {
      provider: this.config.provider,
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      systemPrompt: this.config.systemPrompt,
      responseFormat: this.config.responseFormat,
    });
  }

  validate(input: string): boolean {
    // If we have a template with no variables, we don't need input
    if (this.config.template && !this.config.template.includes('{')) {
      return true;
    }
    // Otherwise, we need valid string input
    return typeof input === 'string' && input.length > 0;
  }
}

// ── RAG Operation ───────────────────────────────────────────────

export class RAGOperation implements HCELOperation<string, RAGResult> {
  id: string;
  type = 'rag';
  metadata: HCELOperationMetadata;

  constructor(
    private ai: HazelAI,
    public config: RAGOperationConfig
  ) {
    this.id = `rag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.metadata = {
      name: 'rag',
      description: 'Retrieve and generate using knowledge base',
      retriable: true,
    };
  }

  async execute(input: string, _context: HCELContext): Promise<RAGResult> {
    const query = this.config.query || input;

    return this.ai.rag.ask(query, {
      topK: this.config.topK,
      strategy: this.config.strategy,
      minScore: this.config.minScore,
    });
  }

  validate(input: string): boolean {
    return typeof input === 'string' && input.length > 0;
  }
}

// ── Agent Operation ─────────────────────────────────────────────

export class AgentOperation implements HCELOperation<string, AgentExecutionResult> {
  id: string;
  type = 'agent';
  metadata: HCELOperationMetadata;

  constructor(
    private ai: HazelAI,
    public config: AgentOperationConfig
  ) {
    this.id = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.metadata = {
      name: 'agent',
      description: 'Execute AI agent with tools',
      retriable: false, // Agents often have side effects
    };
  }

  async execute(input: string, _context: HCELContext): Promise<AgentExecutionResult> {
    const agentInput = this.config.input || input;

    return this.ai.agent(this.config.name, agentInput, this.config.options);
  }

  validate(input: string): boolean {
    return typeof input === 'string' && input.length > 0;
  }
}

// ── Multi-agent orchestration (@hazeljs/agent) ─────────────────

export class AgentPipelineOperation implements HCELOperation<string, GraphExecutionResult> {
  id: string;
  type = 'agentPipeline';
  metadata: HCELOperationMetadata;

  constructor(
    private ai: HazelAI,
    public config: AgentPipelineOperationConfig
  ) {
    this.id = `agent-pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.metadata = {
      name: 'agentPipeline',
      description: 'Sequential multi-agent pipeline (compiled graph)',
      retriable: false,
    };
  }

  async execute(input: string, _context: HCELContext): Promise<GraphExecutionResult> {
    return this.ai.agentPipeline(
      this.config.pipelineId,
      this.config.agents,
      input,
      this.config.graphOptions
    );
  }

  validate(input: string): boolean {
    return typeof input === 'string' && input.length > 0 && this.config.agents.length > 0;
  }
}

export class AgentSupervisorOperation implements HCELOperation<string, SupervisorResult> {
  id: string;
  type = 'agentSupervisor';
  metadata: HCELOperationMetadata;

  constructor(
    private ai: HazelAI,
    public config: AgentSupervisorOperationConfig
  ) {
    this.id = `agent-supervisor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.metadata = {
      name: 'agentSupervisor',
      description: 'Supervisor routing to worker agents',
      retriable: false,
    };
  }

  async execute(input: string, context: HCELContext): Promise<SupervisorResult> {
    return this.ai.supervisor(this.config, input, {
      sessionId: context.sessionId,
      userId: context.userId,
    });
  }

  validate(input: string): boolean {
    const w = this.config.workers;
    return typeof input === 'string' && input.length > 0 && Array.isArray(w) && w.length > 0;
  }
}

export class AgentGraphCompiledOperation implements HCELOperation<string, GraphExecutionResult> {
  id: string;
  type = 'agentGraphCompiled';
  metadata: HCELOperationMetadata;
  private readonly compiled: Pick<CompiledGraph, 'execute'>;

  constructor(
    private ai: HazelAI,
    public config: AgentGraphCompiledOperationConfig,
    compiled: Pick<CompiledGraph, 'execute'>
  ) {
    this.compiled = compiled;
    this.id = `agent-graph-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.metadata = {
      name: 'agentGraphCompiled',
      description: 'Execute a pre-compiled AgentGraph',
      retriable: false,
    };
  }

  async execute(input: string, context: HCELContext): Promise<GraphExecutionResult> {
    const initialData = {
      ...(this.config.graphOptions?.initialData ?? {}),
      ...(context.userId ? { userId: context.userId } : {}),
      ...(context.sessionId ? { sessionId: context.sessionId } : {}),
    };
    const options = {
      ...this.config.graphOptions,
      ...(Object.keys(initialData).length ? { initialData } : {}),
    };
    return this.ai.runAgentGraph(this.compiled, input, options);
  }

  validate(input: string): boolean {
    return typeof input === 'string' && input.length > 0;
  }
}

// ── ML Operation ────────────────────────────────────────────────

export class MLOperation implements HCELOperation<unknown, unknown> {
  id: string;
  type = 'ml';
  metadata: HCELOperationMetadata;

  constructor(
    private ai: HazelAI,
    public config: MLOperationConfig
  ) {
    this.id = `ml-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.metadata = {
      name: 'ml',
      description: `ML operation: ${config.operation}`,
      retriable: true,
    };
  }

  async execute(input: unknown, _context: HCELContext): Promise<unknown> {
    switch (this.config.operation) {
      case 'sentiment':
        if (typeof input !== 'string') {
          throw new Error('Sentiment analysis requires string input');
        }
        return this.ai.sentiment(input);

      case 'classify': {
        if (typeof input !== 'string') {
          throw new Error('Classification requires string input');
        }
        const classifyOptions = this.config.options as ClassifyOptions;
        return this.ai.classify(input, classifyOptions);
      }

      case 'score': {
        const scoreOptions = this.config.options as ScoreOptions;
        return this.ai.score(input as string, scoreOptions);
      }

      default:
        throw new Error(`Unknown ML operation: ${this.config.operation}`);
    }
  }

  validate(input: unknown): boolean {
    return input !== null && input !== undefined;
  }
}

// ── Parallel Operation ───────────────────────────────────────────

export class ParallelOperation implements HCELOperation<unknown, unknown[]> {
  id: string;
  type = 'parallel';
  metadata: HCELOperationMetadata;

  constructor(
    private ai: HazelAI,
    public config: ParallelOperationConfig
  ) {
    this.id = `parallel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.metadata = {
      name: 'parallel',
      description: 'Execute operations in parallel',
      retriable: true,
    };
  }

  async execute(input: unknown, context: HCELContext): Promise<unknown[]> {
    const { operations, strategy = 'all' } = this.config;

    switch (strategy) {
      case 'all':
        // Execute all operations and wait for all to complete
        return Promise.all(operations.map((op) => op.execute(input, context)));

      case 'any': {
        // Execute all and return first successful result
        const results = await Promise.allSettled(
          operations.map((op) => op.execute(input, context))
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            return [result.value];
          }
        }

        throw new Error('All parallel operations failed');
      }

      case 'race': {
        // Return first result (successful or not)
        const raceResult = await Promise.race(operations.map((op) => op.execute(input, context)));
        return [raceResult]; // Always return array
      }

      default:
        throw new Error(`Unknown parallel strategy: ${strategy}`);
    }
  }

  validate(_input: unknown): boolean {
    return this.config.operations.length > 0;
  }
}

// ── Conditional Operation ─────────────────────────────────────────

export class ConditionalOperation implements HCELOperation<unknown, unknown> {
  id: string;
  type = 'conditional';
  metadata: HCELOperationMetadata;

  constructor(
    private ai: HazelAI,
    public config: ConditionalOperationConfig
  ) {
    this.id = `conditional-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.metadata = {
      name: 'conditional',
      description: 'Conditionally execute operations',
      retriable: true,
    };
  }

  async execute(input: unknown, context: HCELContext): Promise<unknown> {
    const conditionResult = this.config.condition(input);

    if (conditionResult) {
      return this.config.trueBranch.execute(input, context);
    } else if (this.config.falseBranch) {
      return this.config.falseBranch.execute(input, context);
    } else {
      return input; // Pass through unchanged
    }
  }

  validate(_input: unknown): boolean {
    return this.config.trueBranch !== undefined;
  }
}

// ── Sequence Operation (run multiple ops in order; used by ifElse) ─────────

export class SequenceOperation implements HCELOperation<unknown, unknown> {
  id: string;
  type = 'sequence';
  metadata: HCELOperationMetadata;
  public config: SequenceOperationConfig & Record<string, unknown>;

  constructor(
    private ai: HazelAI,
    config: SequenceOperationConfig
  ) {
    this.id = `sequence-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.config = { ...config, operations: config.operations };
    this.metadata = {
      name: 'sequence',
      description: 'Run nested operations sequentially',
      retriable: true,
    };
  }

  async execute(input: unknown, context: HCELContext): Promise<unknown> {
    let current: unknown = input;
    for (const op of this.config.operations) {
      if (op.validate && !op.validate(current)) {
        throw new Error(`Sequence child ${op.type} validation failed`);
      }
      current = await op.execute(current, context);
    }
    return current;
  }

  validate(_input: unknown): boolean {
    return this.config.operations.length > 0;
  }
}

// ── Memory operations (@hazeljs/memory) ─────────────────────────

function formatMemoryValue(value: MemoryItem['value']): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return `[vector:${value.length}]`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export class MemoryRecallOperation implements HCELOperation<string, string> {
  id: string;
  type = 'memoryRecall';
  metadata: HCELOperationMetadata;

  constructor(
    _ai: HazelAI,
    public config: MemoryRecallOperationConfig
  ) {
    this.id = `memory-recall-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.metadata = {
      name: 'memoryRecall',
      description: 'Load user memories from MemoryService and prepend to prompt input',
      retriable: true,
    };
  }

  async execute(input: string, context: HCELContext): Promise<string> {
    const text = typeof input === 'string' ? input : String(input ?? '');
    const svc = context.memory;
    if (!svc) {
      throw HCELError.operationFailed(
        this.type,
        this.id,
        '',
        'Set builder.memory(MemoryService) before memoryRecall'
      );
    }
    const userId = context.userId;
    if (!userId) {
      throw HCELError.operationFailed(
        this.type,
        this.id,
        '',
        'context.userId is required for memoryRecall (use builder.context({ userId }))'
      );
    }

    const categories = Array.isArray(this.config.category)
      ? this.config.category
      : [this.config.category];
    const byId = new Map<string, MemoryItem>();
    const limit = this.config.limit ?? 20;

    for (const category of categories) {
      const batch = await svc.getByUserAndCategory(userId, category, {
        limit,
        orderBy: 'updatedAt',
        order: 'desc',
      });
      for (const item of batch) {
        byId.set(item.id, item);
      }
    }

    const items = [...byId.values()].slice(0, limit);
    if (items.length === 0) {
      return text;
    }

    const header = this.config.header ?? 'Relevant memories:';
    const lines = items.map((i) => `- ${i.key}: ${formatMemoryValue(i.value)}`).join('\n');
    return `${header}\n${lines}\n\n${text}`;
  }

  validate(_input: string): boolean {
    return true;
  }
}

export class MemorySaveOperation implements HCELOperation<string, string> {
  id: string;
  type = 'memorySave';
  metadata: HCELOperationMetadata;

  constructor(
    _ai: HazelAI,
    public config: MemorySaveOperationConfig
  ) {
    this.id = `memory-save-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.metadata = {
      name: 'memorySave',
      description: 'Persist string output as a MemoryItem',
      retriable: true,
    };
  }

  async execute(input: string, context: HCELContext): Promise<string> {
    const svc = context.memory;
    if (!svc) {
      throw HCELError.operationFailed(
        this.type,
        this.id,
        '',
        'Set builder.memory(MemoryService) before memorySave'
      );
    }
    const userId = context.userId;
    if (!userId) {
      throw HCELError.operationFailed(
        this.type,
        this.id,
        '',
        'context.userId is required for memorySave (use builder.context({ userId }))'
      );
    }

    const payload = typeof input === 'string' ? input : JSON.stringify(input);
    await svc.save({
      userId,
      category: this.config.category,
      key: this.config.key,
      value: payload,
      source: this.config.source ?? 'explicit',
      confidence: this.config.confidence ?? 1,
      evidence: [],
      sessionId: context.sessionId,
    });
    return typeof input === 'string' ? input : payload;
  }

  validate(input: string): boolean {
    return typeof input === 'string' ? input.length > 0 : input != null;
  }
}

export class MemorySearchOperation implements HCELOperation<string, string> {
  id: string;
  type = 'memorySearch';
  metadata: HCELOperationMetadata;

  constructor(
    _ai: HazelAI,
    public config: MemorySearchOperationConfig = {}
  ) {
    this.id = `memory-search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.metadata = {
      name: 'memorySearch',
      description:
        'Search memories via MemoryService.search (empty when the backing store has no search implementation)',
      retriable: true,
    };
  }

  async execute(input: string, context: HCELContext): Promise<string> {
    const text = typeof input === 'string' ? input : String(input ?? '');
    const svc = context.memory;
    if (!svc) {
      throw HCELError.operationFailed(
        this.type,
        this.id,
        '',
        'Set builder.memory(MemoryService) before memorySearch'
      );
    }
    const userId = context.userId;
    if (!userId) {
      throw HCELError.operationFailed(
        this.type,
        this.id,
        '',
        'context.userId is required for memorySearch (use builder.context({ userId }))'
      );
    }

    const hits = await svc.search(text, {
      userId,
      category: this.config.category,
      topK: this.config.topK ?? 8,
      minScore: this.config.minScore,
    });
    if (!hits.length) {
      return text;
    }
    const header = this.config.header ?? 'Memory search results:';
    const lines = hits.map((i) => `- ${i.key}: ${formatMemoryValue(i.value)}`).join('\n');
    return `${header}\n${lines}\n\n${text}`;
  }

  validate(_input: string): boolean {
    return true;
  }
}

// ── Operation Factory ───────────────────────────────────────────

export class HCELOperationFactory {
  constructor(private ai: HazelAI) {}

  createPrompt(config: PromptOperationConfig): PromptOperation {
    return new PromptOperation(this.ai, config);
  }

  createRAG(config: RAGOperationConfig): RAGOperation {
    return new RAGOperation(this.ai, config);
  }

  createAgent(config: AgentOperationConfig): AgentOperation {
    return new AgentOperation(this.ai, config);
  }

  createML(config: MLOperationConfig): MLOperation {
    return new MLOperation(this.ai, config);
  }

  createParallel(config: ParallelOperationConfig): ParallelOperation {
    return new ParallelOperation(this.ai, config);
  }

  createConditional(config: ConditionalOperationConfig): ConditionalOperation {
    return new ConditionalOperation(this.ai, config);
  }

  createSequence(config: SequenceOperationConfig): SequenceOperation {
    return new SequenceOperation(this.ai, config);
  }

  createAgentPipeline(config: AgentPipelineOperationConfig): AgentPipelineOperation {
    return new AgentPipelineOperation(this.ai, config);
  }

  createAgentSupervisor(config: AgentSupervisorOperationConfig): AgentSupervisorOperation {
    return new AgentSupervisorOperation(this.ai, config);
  }

  createAgentGraphCompiled(
    config: AgentGraphCompiledOperationConfig,
    compiled: Pick<CompiledGraph, 'execute'>
  ): AgentGraphCompiledOperation {
    return new AgentGraphCompiledOperation(this.ai, config, compiled);
  }

  createMemoryRecall(config: MemoryRecallOperationConfig): MemoryRecallOperation {
    return new MemoryRecallOperation(this.ai, config);
  }

  createMemorySave(config: MemorySaveOperationConfig): MemorySaveOperation {
    return new MemorySaveOperation(this.ai, config);
  }

  createMemorySearch(config?: MemorySearchOperationConfig): MemorySearchOperation {
    return new MemorySearchOperation(this.ai, config);
  }
}
