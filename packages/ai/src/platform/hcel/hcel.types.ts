/**
 * HCEL - HazelJS Composable Expression Language Types
 */

import type { ChatOptions, RAGOptions, ClassifyOptions, ScoreOptions } from '../hazel-ai.types';
import type { HCELResultCache } from './hcel.cache';

// ── Core HCEL Types ────────────────────────────────────────────

export interface HCELOperation<TInput = unknown, TOutput = unknown> {
  id: string;
  type: string;
  config: Record<string, unknown>;
  execute(input: TInput, context: HCELContext): Promise<TOutput>;
  validate?(input: TInput): boolean;
  metadata?: HCELOperationMetadata;
}

export interface HCELOperationMetadata {
  name: string;
  description?: string;
  cost?: number;
  latency?: number;
  retriable?: boolean;
  streaming?: boolean;
}

export interface HCELContext {
  sessionId?: string;
  userId?: string;
  traceId?: string;
  metadata: Record<string, unknown>;
  propagate(): HCELContext;
}

export interface HCELChain<_TInput = unknown, _TOutput = unknown> {
  id: string;
  operations: HCELOperation[];
  config: HCELChainConfig;
}

export interface HCELChainConfig {
  adaptive?: boolean;
  parallel?: boolean;
  streaming?: boolean;
  retryPolicy?: HCELRetryPolicy;
  observability?: HCELObservabilityConfig;

  /** Idempotent output storage: after success, result is stored under `key`. */
  persistence?: {
    key?: string;
    enabled?: boolean;
    /** When set, execute() returns a previously persisted result without re-running the chain. */
    restoreKey?: string;
    /** TTL for persisted entries (ms). 0 means no expiry. */
    ttlMs?: number;
  };

  /** Short-lived deduplication cache for identical chain + input fingerprints. */
  caching?: {
    enabled: boolean;
    /** Time-to-live in seconds (converted to ms for the cache store). */
    ttl: number;
    store?: HCELResultCache;
  };

  /** Optional shared cache instance when neither caching.store nor default is injected on the engine. */
  resultCache?: HCELResultCache;
}

export interface HCELRetryPolicy {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface HCELObservabilityConfig {
  trace: boolean;
  metrics: boolean;
  events: boolean;
}

// ── Builder Types ───────────────────────────────────────────────

export interface HCELBuilder<TInput = unknown, TOutput = unknown> {
  // Core operations
  prompt(template: string, options?: ChatOptions): HCELBuilder<string, TOutput>;
  rag(source: string, options?: RAGOptions): HCELBuilder<string[], TOutput>;
  agent(name: string, options?: Record<string, unknown>): HCELBuilder<string, TOutput>;
  ml(
    operation: 'sentiment' | 'classify' | 'score',
    options?: ClassifyOptions | ScoreOptions
  ): HCELBuilder<unknown, TOutput>;

  // Control flow
  parallel(
    ...args: (HCELBuilder | { strategy?: 'all' | 'any' | 'race' })[]
  ): HCELBuilder<TInput, TOutput>;
  conditional(
    condition: (input: TInput) => boolean,
    elseBuilder?: HCELBuilder<TInput, TOutput>
  ): HCELBuilder<TInput, TOutput>;
  ifElse(
    condition: (input: TInput) => boolean,
    thenBranch: HCELBuilder<TInput, TOutput>,
    elseBranch: HCELBuilder<TInput, TOutput>
  ): HCELBuilder<TInput, TOutput>;
  adaptive(): HCELBuilder<TInput, TOutput>;

  // NEW: Persistence operations
  persist(key?: string): HCELBuilder<TInput, TOutput>;
  restore(key: string): HCELBuilder<TInput, TOutput>;
  cache(ttl?: number): HCELBuilder<TInput, TOutput>;

  // Execution
  execute(input?: TInput): Promise<TOutput>;
  stream(input?: TInput): AsyncGenerator<TOutput>;
  observe(callback: (event: HCELEvent) => void): this;

  // Configuration
  config(config: Partial<HCELChainConfig>): this;
  context(context: Partial<HCELContext>): this;
}

// ── Persistence Types ───────────────────────────────────────────

export interface HCELPersistenceConfig {
  store: 'postgres' | 'redis' | 'in-memory';
  connectionString?: string;
  ttl?: number;
  options?: Record<string, unknown>;
}

export interface HCELChainState {
  id: string;
  operations: HCELOperation[];
  config: HCELChainConfig;
  context: HCELContext;
  createdAt: Date;
  lastExecuted?: Date;
  executionHistory: HCELExecutionRecord[];
}

export interface HCELExecutionRecord {
  id: string;
  input: unknown;
  output: unknown;
  duration: number;
  success: boolean;
  error?: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export interface HCELPersistenceService {
  saveChain(key: string, state: HCELChainState): Promise<void>;
  loadChain(key: string): Promise<HCELChainState | null>;
  deleteChain(key: string): Promise<void>;
  saveExecution(chainId: string, record: HCELExecutionRecord): Promise<void>;
  getExecutions(chainId: string, limit?: number): Promise<HCELExecutionRecord[]>;
  clearHistory(chainId: string): Promise<void>;
}

// ── Event Types ───────────────────────────────────────────────

export interface HCELEvent {
  type:
    | 'operation.start'
    | 'operation.complete'
    | 'operation.error'
    | 'chain.start'
    | 'chain.complete';
  chainId: string;
  operationId?: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

// ── Operation Config Types ─────────────────────────────────────

export interface PromptOperationConfig extends ChatOptions {
  template: string;
  variables?: Record<string, unknown>;
  [key: string]: unknown; // Add index signature
}

export interface RAGOperationConfig extends RAGOptions {
  source: string;
  query?: string;
  [key: string]: unknown; // Add index signature
}

export interface AgentOperationConfig {
  name: string;
  input?: string;
  options?: Record<string, unknown>;
  [key: string]: unknown; // Add index signature
}

export interface MLOperationConfig {
  operation: 'sentiment' | 'classify' | 'score';
  options?: ClassifyOptions | ScoreOptions;
  [key: string]: unknown; // Add index signature
}

export interface ParallelOperationConfig {
  operations: HCELOperation[];
  strategy?: 'all' | 'any' | 'race';
  [key: string]: unknown; // Add index signature
}

export interface ConditionalOperationConfig {
  condition: (input: unknown) => boolean;
  trueBranch: HCELOperation;
  falseBranch?: HCELOperation;
  [key: string]: unknown; // Add index signature
}

export interface SequenceOperationConfig {
  operations: HCELOperation[];
  [key: string]: unknown; // Add index signature
}

// ── Result Types ───────────────────────────────────────────────

export interface HCELResult<T = unknown> {
  output: T;
  chainId: string;
  duration: number;
  operations: HCELOperationResult[];
  metadata: HCELResultMetadata;
}

export interface HCELOperationResult {
  operationId: string;
  type: string;
  duration: number;
  success: boolean;
  output?: unknown;
  error?: string;
}

export interface HCELResultMetadata {
  totalTokens?: number;
  totalCost?: number;
  adaptiveChoices?: Array<{
    operation: string;
    choice: string;
    reasoning: string;
  }>;
  /** True when `.adaptive()` was set on the builder; scheduling is reserved — operation order is never reordered. */
  adaptiveRequested?: boolean;
}

// ── Engine Types ───────────────────────────────────────────────

export interface HCELEngine {
  execute<TInput, TOutput>(
    chain: HCELChain<TInput, TOutput>,
    input: TInput,
    context?: HCELContext
  ): Promise<HCELResult<TOutput>>;

  stream<TInput, TOutput>(
    chain: HCELChain<TInput, TOutput>,
    input: TInput,
    context?: HCELContext
  ): AsyncGenerator<TOutput, HCELResult<TOutput>>;
}

// ── Registry Types ─────────────────────────────────────────────

export interface HCELOperationRegistry {
  register<_TInput, _TOutput>(
    type: string,
    factory: (config: Record<string, unknown>, ai: unknown) => HCELOperation<_TInput, _TOutput>
  ): void;

  get(type: string): ((config: Record<string, unknown>, ai: unknown) => HCELOperation) | undefined;

  list(): string[];
}

// ── Utility Types ───────────────────────────────────────────────

export type HCELInputOf<T> = T extends HCELBuilder<infer TInput, unknown> ? TInput : never;
export type HCELOutputOf<T> = T extends HCELBuilder<unknown, infer TOutput> ? TOutput : never;

export type HCELInfer<T> =
  T extends HCELBuilder<infer I, infer O> ? { input: I; output: O } : never;
