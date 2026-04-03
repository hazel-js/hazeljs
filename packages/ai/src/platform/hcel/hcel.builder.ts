/**
 * HCEL Builder - Fluent interface for composable AI operations
 */

import type { HazelAI } from '../hazel-ai';
import type {
  HCELBuilder as IHCELBuilder,
  HCELChain,
  HCELOperation,
  HCELContext,
  HCELEvent,
  HCELChainConfig,
  PromptOperationConfig,
  RAGOperationConfig,
  AgentOperationConfig,
  MLOperationConfig,
  MemoryRecallOperationConfig,
  MemorySaveOperationConfig,
  MemorySearchOperationConfig,
  AgentPipelineOperationConfig,
  AgentSupervisorOperationConfig,
} from './hcel.types';
import type { MemoryService } from '@hazeljs/memory';
import type {
  CompiledGraph,
  GraphExecutionOptions,
  GraphExecutionResult,
  SupervisorResult,
} from '../agent-orchestration.types';
import type { ChatOptions, RAGOptions, ClassifyOptions, ScoreOptions } from '../hazel-ai.types';
import { HCELEngine } from './hcel.engine';
import { HCELOperationFactory } from './hcel.operations';
import { randomUUID } from 'crypto';

/**
 * HCEL Builder - Fluent interface for composing AI operations
 */
export class HCELBuilder<TInput = unknown, TOutput = unknown> implements IHCELBuilder<
  TInput,
  TOutput
> {
  protected operations: HCELOperation[] = [];
  protected chainConfig: HCELChainConfig = {};
  protected chainContext: Partial<HCELContext> = {};
  private observers: ((event: HCELEvent) => void)[] = [];
  private operationFactory: HCELOperationFactory;
  private engine: HCELEngine;

  constructor(protected ai: HazelAI) {
    this.operationFactory = new HCELOperationFactory(ai);
    this.engine = new HCELEngine();

    // Set up event listeners
    this.engine.addEventListener('chain.start', (event) => {
      this.observers.forEach((observer) => observer(event));
    });

    this.engine.addEventListener('chain.complete', (event) => {
      this.observers.forEach((observer) => observer(event));
    });

    this.engine.addEventListener('operation.start', (event) => {
      this.observers.forEach((observer) => observer(event));
    });

    this.engine.addEventListener('operation.complete', (event) => {
      this.observers.forEach((observer) => observer(event));
    });

    this.engine.addEventListener('operation.error', (event) => {
      this.observers.forEach((observer) => observer(event));
    });
  }

  // ── Core Operations ─────────────────────────────────────────────

  prompt(template: string, options: ChatOptions = {}): HCELBuilder<string, TOutput> {
    const config: PromptOperationConfig = {
      template,
      ...options,
    };

    const operation = this.operationFactory.createPrompt(config);
    this.operations.push(operation);

    return this as unknown as HCELBuilder<string, TOutput>;
  }

  rag(source: string, options: RAGOptions = {}): HCELBuilder<string[], TOutput> {
    const config: RAGOperationConfig = {
      source,
      ...options,
    };

    const operation = this.operationFactory.createRAG(config);
    this.operations.push(operation);

    return this as unknown as HCELBuilder<string[], TOutput>;
  }

  agent(name: string, options: Record<string, unknown> = {}): HCELBuilder<string, TOutput> {
    const config: AgentOperationConfig = {
      name,
      ...options,
    };

    const operation = this.operationFactory.createAgent(config);
    this.operations.push(operation);

    return this as unknown as HCELBuilder<string, TOutput>;
  }

  agentPipeline(config: AgentPipelineOperationConfig): HCELBuilder<string, GraphExecutionResult> {
    this.operations.push(this.operationFactory.createAgentPipeline(config));
    return this as unknown as HCELBuilder<string, GraphExecutionResult>;
  }

  agentSupervisor(config: AgentSupervisorOperationConfig): HCELBuilder<string, SupervisorResult> {
    this.operations.push(this.operationFactory.createAgentSupervisor(config));
    return this as unknown as HCELBuilder<string, SupervisorResult>;
  }

  agentGraphCompiled(
    graphId: string,
    compiled: Pick<CompiledGraph, 'execute'>,
    graphOptions?: GraphExecutionOptions
  ): HCELBuilder<string, GraphExecutionResult> {
    this.operations.push(
      this.operationFactory.createAgentGraphCompiled({ graphId, graphOptions }, compiled)
    );
    return this as unknown as HCELBuilder<string, GraphExecutionResult>;
  }

  ml(
    operation: 'sentiment' | 'classify' | 'score',
    options: ClassifyOptions | ScoreOptions = {} as unknown as ClassifyOptions
  ): HCELBuilder<unknown, TOutput> {
    const config: MLOperationConfig = {
      operation,
      options,
    };

    const mlOperation = this.operationFactory.createML(config);
    this.operations.push(mlOperation);

    return this as unknown as HCELBuilder<unknown, TOutput>;
  }

  // ── Control Flow ───────────────────────────────────────────────

  parallel(
    ...args: (HCELBuilder | { strategy?: 'all' | 'any' | 'race' })[]
  ): HCELBuilder<TInput, TOutput> {
    let strategy: 'all' | 'any' | 'race' = 'all';
    let builders: HCELBuilder[];
    const last = args[args.length - 1];
    if (
      args.length > 0 &&
      last !== undefined &&
      last !== null &&
      typeof last === 'object' &&
      !(last instanceof HCELBuilder) &&
      'strategy' in last &&
      typeof (last as { strategy?: string }).strategy === 'string'
    ) {
      strategy = (last as { strategy: 'all' | 'any' | 'race' }).strategy;
      builders = args.slice(0, -1) as HCELBuilder[];
    } else {
      builders = args as HCELBuilder[];
    }

    const operations = builders.flatMap((builder) => builder.operations);

    const parallelOperation = this.operationFactory.createParallel({
      operations,
      strategy,
    });

    this.operations.push(parallelOperation);

    return this;
  }

  /**
   * Wrap the previous operation: run it only when `condition` is true; otherwise pass input through.
   * Optionally provide `elseBuilder` to run a different branch when false (each branch may be multiple ops via a nested builder).
   */
  conditional(
    condition: (input: TInput) => boolean,
    elseBuilder?: HCELBuilder<TInput, TOutput>
  ): HCELBuilder<TInput, TOutput> {
    if (this.operations.length === 0) {
      throw new Error('Conditional operation requires at least one preceding operation');
    }

    const lastOperation = this.operations[this.operations.length - 1];
    let falseBranch: HCELOperation | undefined;
    if (elseBuilder) {
      const elseInternal = elseBuilder as unknown as { operations: HCELOperation[] };
      if (elseInternal.operations.length > 0) {
        falseBranch = this.operationFactory.createSequence({
          operations: [...elseInternal.operations],
        });
      }
    }

    const conditionalOperation = this.operationFactory.createConditional({
      condition: condition as (input: unknown) => boolean,
      trueBranch: lastOperation,
      falseBranch,
    });

    this.operations[this.operations.length - 1] = conditionalOperation;

    return this;
  }

  /**
   * Single conditional with explicit then/else branches (multi-op each). Replaces the current chain with one conditional root.
   */
  ifElse(
    condition: (input: TInput) => boolean,
    thenBranch: HCELBuilder<TInput, TOutput>,
    elseBranch: HCELBuilder<TInput, TOutput>
  ): HCELBuilder<TInput, TOutput> {
    const thenInternal = thenBranch as unknown as { operations: HCELOperation[]; ai: HazelAI };
    const elseInternal = elseBranch as unknown as { operations: HCELOperation[]; ai: HazelAI };
    if (thenInternal.operations.length === 0 || elseInternal.operations.length === 0) {
      throw new Error('ifElse: each branch must contain at least one operation');
    }
    if (thenInternal.ai !== this.ai || elseInternal.ai !== this.ai) {
      throw new Error('ifElse: all branches must use the same HazelAI instance as this builder');
    }

    const trueSeq = this.operationFactory.createSequence({
      operations: [...thenInternal.operations],
    });
    const falseSeq = this.operationFactory.createSequence({
      operations: [...elseInternal.operations],
    });

    const conditionalOperation = this.operationFactory.createConditional({
      condition: condition as (input: unknown) => boolean,
      trueBranch: trueSeq,
      falseBranch: falseSeq,
    });

    this.operations = [conditionalOperation];
    return this;
  }

  adaptive(): HCELBuilder<TInput, TOutput> {
    this.chainConfig.adaptive = true;
    return this;
  }

  // ── @hazeljs/memory integration ───────────────────────────────────

  memory(service: MemoryService): this {
    this.chainContext.memory = service;
    return this;
  }

  memoryRecall(config: MemoryRecallOperationConfig): HCELBuilder<string, TOutput> {
    this.operations.push(this.operationFactory.createMemoryRecall(config));
    return this as unknown as HCELBuilder<string, TOutput>;
  }

  memorySave(config: MemorySaveOperationConfig): HCELBuilder<string, TOutput> {
    this.operations.push(this.operationFactory.createMemorySave(config));
    return this as unknown as HCELBuilder<string, TOutput>;
  }

  memorySearch(config?: MemorySearchOperationConfig): HCELBuilder<string, TOutput> {
    this.operations.push(this.operationFactory.createMemorySearch(config));
    return this as unknown as HCELBuilder<string, TOutput>;
  }

  // ── Persistence Operations ───────────────────────────────────────

  persist(key?: string): HCELBuilder<TInput, TOutput> {
    const persistKey = key || `chain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.chainConfig.persistence = {
      ...this.chainConfig.persistence,
      key: persistKey,
      enabled: true,
    };

    return this;
  }

  /**
   * On the next `execute()`, return a previously persisted result for this key (see `persist`) without re-running the chain.
   * Uses the same result cache as `cache()`. For durable workflows across restarts, use `asFlowNode()` with `@hazeljs/flow`.
   */
  restore(key: string): HCELBuilder<TInput, TOutput> {
    this.chainConfig.persistence = {
      ...this.chainConfig.persistence,
      restoreKey: key,
    };
    return this;
  }

  cache(ttl?: number): HCELBuilder<TInput, TOutput> {
    // Configure caching
    this.chainConfig.caching = {
      enabled: true,
      ttl: ttl || 3600, // Default 1 hour
    };

    return this;
  }

  // ── Configuration ─────────────────────────────────────────────

  config(config: Partial<HCELChainConfig>): this {
    this.chainConfig = { ...this.chainConfig, ...config };
    return this;
  }

  context(context: Partial<HCELContext>): this {
    this.chainContext = { ...this.chainContext, ...context };
    return this;
  }

  // ── Observation ───────────────────────────────────────────────

  observe(callback: (event: HCELEvent) => void): this {
    this.observers.push(callback);
    return this;
  }

  // ── Execution ─────────────────────────────────────────────────

  async execute(input?: TInput): Promise<TOutput> {
    if (this.operations.length === 0) {
      throw new Error('No operations to execute');
    }

    const chain: HCELChain = {
      id: randomUUID(),
      operations: this.operations,
      config: this.chainConfig,
    };

    const context: HCELContext = {
      sessionId: this.chainContext.sessionId || randomUUID(),
      userId: this.chainContext.userId,
      traceId: this.chainContext.traceId || randomUUID(),
      metadata: this.chainContext.metadata || {},
      memory: this.chainContext.memory,
      propagate: function () {
        return this;
      },
    };

    // Use provided input or undefined for chains that don't require input
    const result = await this.engine.execute(chain, input as unknown, context);
    return result.output as TOutput;
  }

  async *stream(input?: TInput): AsyncGenerator<TOutput> {
    if (this.operations.length === 0) {
      throw new Error('No operations to stream');
    }

    const chain: HCELChain = {
      id: randomUUID(),
      operations: this.operations,
      config: this.chainConfig,
    };

    const context: HCELContext = {
      sessionId: this.chainContext.sessionId || randomUUID(),
      userId: this.chainContext.userId,
      traceId: this.chainContext.traceId || randomUUID(),
      metadata: this.chainContext.metadata || {},
      memory: this.chainContext.memory,
      propagate: function () {
        return this;
      },
    };

    yield* this.engine.stream(chain, input as unknown, context) as AsyncGenerator<TOutput>;
  }

  // ── Utility Methods ───────────────────────────────────────────

  /**
   * Create a copy of this builder with the same operations and configuration
   */
  clone(): HCELBuilder<TInput, TOutput> {
    const newBuilder = new HCELBuilder<TInput, TOutput>(this.ai);
    const newBuilderInternal = newBuilder as unknown as {
      operations: HCELOperation[];
      chainConfig: HCELChainConfig;
      chainContext: Partial<HCELContext>;
      observers: ((event: HCELEvent) => void)[];
    };
    newBuilderInternal.operations = [...this.operations];
    newBuilderInternal.chainConfig = { ...this.chainConfig };
    newBuilderInternal.chainContext = { ...this.chainContext };
    newBuilderInternal.observers = [...this.observers];
    return newBuilder;
  }

  /**
   * Get the current operations in the chain (for debugging)
   */
  getOperations(): HCELOperation[] {
    return [...this.operations];
  }

  /**
   * Get a summary of the chain (for debugging and logging)
   */
  getSummary(): {
    operationCount: number;
    operations: string[];
    config: HCELChainConfig;
  } {
    return {
      operationCount: this.operations.length,
      operations: this.operations.map((op) => `${op.type}(${op.id})`),
      config: this.chainConfig,
    };
  }

  /**
   * Reset the builder to start a new chain
   */
  reset(): this {
    this.operations = [];
    this.chainConfig = {};
    this.chainContext = {};
    this.observers = [];
    return this;
  }

  // ── Flow Integration Methods ─────────────────────────────────────

  /**
   * Convert this HCEL chain to a Flow Engine node
   */
  asFlowNode(): {
    handler: (ctx: {
      input: unknown;
    }) => Promise<{ status: string; output?: TOutput; reason?: string }>;
  } {
    return {
      handler: async (ctx: {
        input: unknown;
      }): Promise<{ status: string; output?: TOutput; reason?: string }> => {
        try {
          const result = await this.execute(ctx.input as TInput);
          return {
            status: 'ok',
            output: result,
          };
        } catch (error) {
          return {
            status: 'error',
            reason: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    };
  }

  /**
   * Create a flow definition with this chain as a node
   */
  flow(
    flowId: string,
    version: string = '1.0.0'
  ): {
    flowId: string;
    version: string;
    entry: string;
    nodes: Record<string, unknown>;
    edges: unknown[];
  } {
    return {
      flowId,
      version,
      entry: this.operations[0]?.id || 'main',
      nodes: {
        [this.operations[0]?.id || 'main']: this.asFlowNode(),
      },
      edges: [],
    };
  }
}

// ── Utility Functions ───────────────────────────────────────────

/**
 * Create a new HCEL builder instance
 */
export function createBuilder<TInput = unknown, TOutput = unknown>(
  ai: HazelAI
): HCELBuilder<TInput, TOutput> {
  return new HCELBuilder<TInput, TOutput>(ai);
}

/**
 * Compose multiple builders into a single builder
 */
export function compose<TInput, TIntermediate, TOutput>(
  first: HCELBuilder<TInput, TIntermediate>,
  second: HCELBuilder<TIntermediate, TOutput>
): HCELBuilder<TInput, TOutput> {
  const firstInternal = first as unknown as {
    ai: HazelAI;
    operations: HCELOperation[];
    chainConfig: HCELChainConfig;
  };
  const secondInternal = second as unknown as {
    operations: HCELOperation[];
    chainConfig: HCELChainConfig;
  };

  const composed = new HCELBuilder<TInput, TOutput>(firstInternal.ai);
  (composed as unknown as { operations: HCELOperation[] }).operations = [
    ...firstInternal.operations,
    ...secondInternal.operations,
  ];
  (composed as unknown as { chainConfig: HCELChainConfig }).chainConfig = {
    ...firstInternal.chainConfig,
    ...secondInternal.chainConfig,
  };
  return composed;
}

/**
 * Create a builder whose only operation is a conditional over two multi-op branches.
 */
export function conditional<TInput, TOutput>(
  condition: (input: TInput) => boolean,
  truePath: HCELBuilder<TInput, TOutput>,
  falsePath?: HCELBuilder<TInput, TOutput>
): HCELBuilder<TInput, TOutput> {
  const truePathInternal = truePath as unknown as { ai: HazelAI; operations: HCELOperation[] };
  const falsePathInternal = falsePath as unknown as { ai: HazelAI; operations: HCELOperation[] };

  if (truePathInternal.operations.length === 0) {
    throw new Error('conditional: truePath must contain at least one operation');
  }

  if (falsePathInternal && truePathInternal.ai !== falsePathInternal.ai) {
    throw new Error('All conditional paths must use the same HazelAI instance');
  }

  const conditionalBuilder = new HCELBuilder<TInput, TOutput>(truePathInternal.ai);
  const factory = new HCELOperationFactory(truePathInternal.ai);

  const trueSeq = factory.createSequence({ operations: [...truePathInternal.operations] });
  const falseSeq =
    falsePathInternal && falsePathInternal.operations.length > 0
      ? factory.createSequence({ operations: [...falsePathInternal.operations] })
      : undefined;

  const op = factory.createConditional({
    condition: condition as (input: unknown) => boolean,
    trueBranch: trueSeq,
    falseBranch: falseSeq,
  });

  (conditionalBuilder as unknown as { operations: HCELOperation[] }).operations = [op];

  return conditionalBuilder;
}
