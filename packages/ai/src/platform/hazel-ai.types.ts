/**
 * Core types for the HazelJS Unified AI Platform
 */

import type { AIProvider, IAIProvider, AIMessage } from '../ai-enhanced.types';

// ── Configuration ────────────────────────────────────────────

export interface HazelAIConfig {
  /** Default LLM provider. Auto-detected from env if omitted. */
  provider?: AIProvider;
  /** Default model name. */
  model?: string;
  /** Provider-specific configs keyed by provider name. */
  providers?: Partial<Record<AIProvider, ProviderConfig>>;
  /** Default provider to use. */
  defaultProvider?: AIProvider;
  /** Default temperature. */
  temperature?: number;
  /** Default max tokens. */
  maxTokens?: number;
  /** Enable debug logging. */
  debug?: boolean;
  /**
   * Optional external agent service/runtime to reuse.
   * When provided, HCEL agent operations run on the same registrations/tools as your app runtime.
   */
  agentService?: {
    execute: (
      name: string,
      input: string,
      options?: Record<string, unknown>
    ) => Promise<AgentExecutionResult>;
    pipeline: (
      id: string,
      agents: string[]
    ) => {
      execute: (input: string, options?: GraphExecutionOptions) => Promise<GraphExecutionResult>;
    };
    createSupervisor: (config: SupervisorConfig) => {
      run: (
        task: string,
        options?: { sessionId?: string; userId?: string }
      ) => Promise<SupervisorResult>;
    };
    createGraph: (id: string) => AgentGraph;
  };

  // NEW: Production persistence configuration
  persistence?: {
    /** Memory store configuration for conversation history */
    memory?: {
      store: 'postgres' | 'redis' | 'in-memory';
      connectionString?: string;
      ttl?: number; // Time to live in seconds
      options?: Record<string, unknown>;
    };

    /** RAG vector store configuration */
    rag?: {
      vectorStore: 'pinecone' | 'qdrant' | 'weaviate' | 'chroma' | 'in-memory';
      connectionString?: string;
      apiKey?: string;
      indexName?: string;
      environment?: string;
      options?: Record<string, unknown>;
    };

    /** Chain state persistence */
    chains?: {
      store: 'postgres' | 'redis' | 'in-memory';
      connectionString?: string;
      ttl?: number;
      options?: Record<string, unknown>;
    };
  };
}

export interface ProviderConfig {
  apiKey?: string;
  baseURL?: string;
  defaultModel?: string;
}

// ── Chat ─────────────────────────────────────────────────────

export interface ChatOptions {
  provider?: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  responseFormat?: 'text' | 'json';
}

export interface ChatResponse {
  content: string;
  model: string;
  provider: AIProvider;
  usage?: TokenUsageSummary;
}

export interface TokenUsageSummary {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost?: number;
}

// ── RAG ──────────────────────────────────────────────────────

export interface RAGOptions {
  topK?: number;
  strategy?: 'similarity' | 'mmr' | 'hybrid';
  minScore?: number;
}

export interface RAGResult {
  answer: string;
  sources: RAGSource[];
}

export interface RAGSource {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export type KnowledgeSource =
  | { type: 'file'; path: string }
  | { type: 'url'; url: string }
  | { type: 'directory'; path: string }
  | { type: 'text'; content: string; metadata?: Record<string, unknown> };

// ── Classification ───────────────────────────────────────────

export interface ClassifyOptions {
  labels: string[];
  provider?: AIProvider;
  model?: string;
  multi?: boolean; // allow multiple labels
}

export interface ClassifyResult {
  label: string;
  confidence: number;
  allScores?: Record<string, number>;
}

export interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
}

// ── Scoring ──────────────────────────────────────────────────

export interface ScoreOptions {
  items: Array<{ id: string; text: string }>;
  criteria: string;
  provider?: AIProvider;
  model?: string;
}

export interface ScoreResult {
  id: string;
  score: number;
  reasoning?: string;
}

// ── Workflow ─────────────────────────────────────────────────

export interface WorkflowStep<TIn = string, TOut = string> {
  name: string;
  execute: (input: TIn) => Promise<TOut>;
}

export interface WorkflowResult<T = string> {
  output: T;
  steps: Array<{
    name: string;
    duration: number;
    output: unknown;
  }>;
  totalDuration: number;
}

export interface WorkflowBuilder {
  step<TIn, TOut>(name: string, fn: (input: TIn) => Promise<TOut>): WorkflowBuilder;
  run<T>(input: string): Promise<WorkflowResult<T>>;
}

// ── Assistant ────────────────────────────────────────────────

export interface AssistantConfig {
  name?: string;
  systemPrompt?: string;
  memory?: boolean;
  memoryStore?: 'in-memory' | 'postgres' | 'redis';
  provider?: AIProvider;
  model?: string;
  tools?: Array<{
    name: string;
    description: string;
    execute: (...args: unknown[]) => Promise<unknown>;
  }>;
  options?: {
    userId?: string;
    sessionId?: string;
    [key: string]: unknown;
  };
}

export interface AssistantResponse {
  content: string;
  sessionId: string;
  usage?: TokenUsageSummary;
}

export interface AssistantInstance {
  chat(message: string): Promise<AssistantResponse>;
  getHistory(): AIMessage[];
  clearHistory(): void;
  readonly sessionId: string;
}

// ── RAG Facade Interface ─────────────────────────────────────

export interface RAGFacadeInterface {
  ingest(source: string | KnowledgeSource): Promise<string[]>;
  ask(query: string, options?: RAGOptions): Promise<RAGResult>;
  search(query: string, options?: RAGOptions): Promise<RAGSource[]>;
}

// ── Observability ────────────────────────────────────────────

export interface AIMetrics {
  totalRequests: number;
  totalTokens: number;
  averageLatencyMs: number;
  errorRate: number;
  costEstimate: number;
  byProvider: Record<
    string,
    {
      requests: number;
      tokens: number;
      averageLatencyMs: number;
    }
  >;
}

// ── Plugin ───────────────────────────────────────────────────

export interface AIPlatformPlugin {
  name: string;
  register(ai: HazelAI): void | Promise<void>;
}

// Re-export agent types for convenience
import type { AgentExecutionResult } from '@hazeljs/agent';
import type {
  AgentGraph,
  GraphExecutionOptions,
  GraphExecutionResult,
  SupervisorConfig,
  SupervisorResult,
} from './agent-orchestration.types';
export { AgentExecutionResult };

// Forward reference for HazelAI class
export interface HazelAI {
  chat(message: string, options?: ChatOptions): Promise<string>;
  stream(message: string, options?: ChatOptions): AsyncGenerator<string>;
  rag: RAGFacadeInterface;
  agent(
    name: string,
    input: string,
    options?: Record<string, unknown>
  ): Promise<AgentExecutionResult>;
  pipeline(id: string, agents: string[]): { execute(input: string): Promise<AgentExecutionResult> };
  classify(text: string, options: ClassifyOptions): Promise<ClassifyResult>;
  sentiment(text: string): Promise<SentimentResult>;
  score(prompt: string, options: ScoreOptions): Promise<ScoreResult[]>;
  workflow(id: string): WorkflowBuilder;
  assistant(config: AssistantConfig): Promise<AssistantInstance>;
  registerProvider(provider: IAIProvider): void;
  getMetrics(): AIMetrics;
}
