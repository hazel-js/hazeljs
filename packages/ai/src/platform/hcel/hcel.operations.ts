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
} from './hcel.types';
import type { ClassifyOptions, ScoreOptions, RAGResult } from '../hazel-ai.types';
import type { AgentExecutionResult } from '@hazeljs/agent';

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
}
