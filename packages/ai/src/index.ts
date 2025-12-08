/**
 * @hazeljs/ai - AI integration module for HazelJS
 */

// AI Module
export { AIModule } from './ai.module';
export { AIService } from './ai.service';
export type { AITaskConfig, AITaskContext, AITaskResult } from './ai.types';
export { AITask } from './ai.decorator';

// Enhanced AI
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
