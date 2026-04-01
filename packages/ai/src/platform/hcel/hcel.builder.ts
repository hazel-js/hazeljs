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
} from './hcel.types';
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

  parallel(...builders: HCELBuilder[]): HCELBuilder<TInput, TOutput> {
    const operations = builders.flatMap((builder) => builder.operations);

    const parallelOperation = this.operationFactory.createParallel({
      operations,
      strategy: 'all',
    });

    this.operations.push(parallelOperation);

    return this;
  }

  conditional(condition: (input: TInput) => boolean): HCELBuilder<TInput, TOutput> {
    if (this.operations.length === 0) {
      throw new Error('Conditional operation requires at least one preceding operation');
    }

    // For now, we'll implement a simple conditional that checks the last operation
    // TODO: Implement more sophisticated conditional logic
    const lastOperation = this.operations[this.operations.length - 1];

    const conditionalOperation = this.operationFactory.createConditional({
      condition: condition as (input: unknown) => boolean,
      trueBranch: lastOperation,
    });

    // Replace the last operation with the conditional
    this.operations[this.operations.length - 1] = conditionalOperation;

    return this;
  }

  adaptive(): HCELBuilder<TInput, TOutput> {
    this.chainConfig.adaptive = true;
    return this;
  }

  // ── Persistence Operations ───────────────────────────────────────

  persist(key?: string): HCELBuilder<TInput, TOutput> {
    const persistKey = key || `chain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Store the persistence key in chain config
    this.chainConfig.persistence = {
      key: persistKey,
      enabled: true,
    };

    return this;
  }

  restore(key: string): HCELBuilder<TInput, TOutput> {
    // TODO: Implement chain restoration from persistence
    // eslint-disable-next-line no-console
    console.log(`Restoring chain with key: ${key}`);
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
      propagate: function () {
        return this;
      },
    };

    // For now, execute normally and stream the result
    // TODO: Implement true streaming execution in Phase 2
    const result = await this.engine.execute(chain, input as unknown, context);
    yield result.output as TOutput;
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
 * Create a conditional builder that executes different paths based on a condition
 */
export function conditional<TInput, TOutput>(
  condition: (input: TInput) => boolean,
  truePath: HCELBuilder<TInput, TOutput>,
  falsePath?: HCELBuilder<TInput, TOutput>
): HCELBuilder<TInput, TOutput> {
  const truePathInternal = truePath as unknown as { ai: HazelAI; operations: HCELOperation[] };
  const falsePathInternal = falsePath as unknown as { ai: HazelAI } | undefined;

  if (falsePathInternal && truePathInternal.ai !== falsePathInternal.ai) {
    throw new Error('All conditional paths must use the same HazelAI instance');
  }

  const conditionalBuilder = new HCELBuilder<TInput, TOutput>(truePathInternal.ai);

  // This is a simplified implementation
  // TODO: Implement proper conditional logic in the engine
  (conditionalBuilder as unknown as { operations: HCELOperation[] }).operations =
    truePathInternal.operations;

  return conditionalBuilder;
}
