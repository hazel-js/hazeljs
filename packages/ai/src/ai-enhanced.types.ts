/**
 * AI Provider types
 */
export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'cohere' | 'ollama' | 'huggingface';

/**
 * AI model configuration
 */
export interface AIModelConfig {
  /**
   * Provider name
   */
  provider: AIProvider;

  /**
   * Model name
   */
  model: string;

  /**
   * API key
   */
  apiKey?: string;

  /**
   * Temperature (0-1)
   */
  temperature?: number;

  /**
   * Max tokens
   */
  maxTokens?: number;

  /**
   * Top P
   */
  topP?: number;

  /**
   * Enable streaming
   */
  streaming?: boolean;

  /**
   * Custom endpoint
   */
  endpoint?: string;
}

/**
 * AI message role
 */
export type AIMessageRole = 'system' | 'user' | 'assistant' | 'function';

/**
 * AI message
 */
export interface AIMessage {
  role: AIMessageRole;
  content: string;
  name?: string;
  functionCall?: {
    name: string;
    arguments: string;
  };
}

/**
 * AI completion request
 */
export interface AICompletionRequest {
  messages: AIMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  functions?: AIFunction[];
  functionCall?: 'auto' | 'none' | { name: string };
}

/**
 * AI completion response
 */
export interface AICompletionResponse {
  id: string;
  content: string;
  role: AIMessageRole;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  functionCall?: {
    name: string;
    arguments: string;
  };
  finishReason?: string;
}

/**
 * AI streaming chunk
 */
export interface AIStreamChunk {
  id: string;
  content: string;
  delta: string;
  done: boolean;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * AI function definition
 */
export interface AIFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description?: string;
        enum?: string[];
      }
    >;
    required?: string[];
  };
}

/**
 * AI embedding request
 */
export interface AIEmbeddingRequest {
  input: string | string[];
  model?: string;
}

/**
 * AI embedding response
 */
export interface AIEmbeddingResponse {
  embeddings: number[][];
  model: string;
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
}

/**
 * AI provider interface
 */
export interface IAIProvider {
  /**
   * Provider name
   */
  readonly name: AIProvider;

  /**
   * Generate completion
   */
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;

  /**
   * Generate streaming completion
   */
  streamComplete(request: AICompletionRequest): AsyncGenerator<AIStreamChunk>;

  /**
   * Generate embeddings
   */
  embed(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse>;

  /**
   * Check if provider is available
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Vector database types
 */
export type VectorDatabase = 'pinecone' | 'weaviate' | 'qdrant' | 'chroma';

/**
 * Vector store configuration
 */
export interface VectorStoreConfig {
  database: VectorDatabase;
  apiKey?: string;
  endpoint?: string;
  index?: string;
  namespace?: string;
}

/**
 * Vector document
 */
export interface VectorDocument {
  id: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

/**
 * Vector search request
 */
export interface VectorSearchRequest {
  query: string;
  topK?: number;
  filter?: Record<string, unknown>;
  namespace?: string;
}

/**
 * Vector search result
 */
export interface VectorSearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * AI context manager
 */
export interface AIContext {
  messages: AIMessage[];
  maxTokens: number;
  currentTokens: number;

  addMessage(message: AIMessage): void;
  getMessages(): AIMessage[];
  clear(): void;
  trimToLimit(): void;
}

/**
 * Token usage tracker
 */
export interface TokenUsage {
  userId?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
  timestamp: number;
}

/**
 * Token limit configuration
 */
export interface TokenLimitConfig {
  maxTokensPerRequest?: number;
  maxTokensPerDay?: number;
  maxTokensPerMonth?: number;
  costPerToken?: number;
}

/**
 * AI function decorator options
 */
export interface AIFunctionOptions {
  provider: AIProvider;
  model: string;
  streaming?: boolean;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

/**
 * AI validation options
 */
export interface AIValidationOptions {
  provider: AIProvider;
  model?: string;
  instruction: string;
  failOnInvalid?: boolean;
}
