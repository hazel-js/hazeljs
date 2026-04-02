/**
 * @hazeljs/ai - AI integration module for HazelJS
 */

// AI Module
export { AIModule } from './ai.module';
export { AIService } from './ai.service';
export { AIEnhancedService } from './ai-enhanced.service';
export type { AITaskConfig, AITaskContext, AITaskResult } from './ai.types';
export { AITask } from './ai.decorator';

// Fluent Chat Builder
export { ChatBuilder } from './chat-builder';
export type { ChatBuilderHost } from './chat-builder';

// Enhanced AI
export { OpenAIProvider } from './providers/openai.provider';
export { AnthropicProvider } from './providers/anthropic.provider';
export { GeminiProvider } from './providers/gemini.provider';
export { CohereProvider } from './providers/cohere.provider';
export { OllamaProvider } from './providers/ollama.provider';
export {
  AIFunction,
  AIPrompt,
  getAIFunctionMetadata,
  hasAIFunctionMetadata,
  getAIPromptMetadata,
} from './decorators/ai-function.decorator';
export {
  AIValidate,
  AIValidateProperty,
  getAIValidationMetadata,
  hasAIValidationMetadata,
  getAIPropertyValidationMetadata,
} from './decorators/ai-validate.decorator';
export { VectorService } from './vector/vector.service';
export {
  type AIProvider,
  type AIModelConfig,
  type AIMessageRole,
  type AIMessage,
  type AICompletionRequest,
  type AICompletionResponse,
  type AIStreamChunk,
  type AIFunction as AIFunctionType,
  type AIEmbeddingRequest,
  type AIEmbeddingResponse,
  type IAIProvider,
  type AIResponseFormat,
  type AIJsonSchema,
  type VectorDatabase,
  type VectorStoreConfig,
  type VectorDocument,
  type VectorSearchRequest,
  type VectorSearchResult,
  type AIContext,
  type TokenUsage,
  type TokenLimitConfig,
  type AIFunctionOptions,
  type AIValidationOptions,
} from './ai-enhanced.types';

// Errors
export { AIError, AIErrorCode } from './errors/ai.error';

// Debug utility
export { debug, setDebugEnabled } from './utils/debug';

// ── Unified AI Platform (NEW) ─────────────────────────────────
export { HazelAI } from './platform/hazel-ai';
export { AIPlatformModule } from './platform/ai-platform.module';

// HCEL - HazelJS Composable Expression Language
export {
  HCELBuilder,
  HCELEngine,
  HCELError,
  HCELErrorCode,
  createMemoryHCELResultCache,
  getDefaultHCELResultCache,
} from './platform/hcel';
export type {
  HCELOperation,
  HCELContext,
  HCELChain,
  HCELBuilder as IHCELBuilder,
  HCELEvent,
  HCELResult,
  HCELResultCache,
} from './platform/hcel';

export type {
  HazelAIConfig,
  ProviderConfig,
  ChatOptions,
  ChatResponse,
  TokenUsageSummary,
  RAGOptions,
  RAGResult,
  RAGSource,
  KnowledgeSource,
  ClassifyOptions,
  ClassifyResult,
  SentimentResult,
  ScoreOptions,
  ScoreResult,
  WorkflowStep,
  WorkflowResult,
  WorkflowBuilder,
  AssistantConfig,
  AssistantResponse,
  AssistantInstance,
  AIMetrics,
  AIPlatformPlugin,
  RAGFacadeInterface,
} from './platform/hazel-ai.types';

// Re-export key types from sub-packages for convenience
// (users don't need to install sub-packages for types)
export { Agent, Tool, Delegate } from '@hazeljs/agent';
export type { AgentConfig, AgentExecutionResult } from '@hazeljs/agent';
