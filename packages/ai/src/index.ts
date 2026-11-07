/**
 * @hazeljs/ai - AI integration module for HazelJS
 */

// AI Module
export { AIModule } from './ai.module';
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

/** Bridge IAIProvider to @hazeljs/agent-compatible LLM runtime */
export {
  createLLMProviderFromIAI,
  type AgentCompatibleLLMProvider,
} from './adapters/create-llm-provider-from-iai';

// Errors
export { AIError, AIErrorCode } from './errors/ai.error';

export type { IUsageStore, AIUsageRecord } from './tracking/usage.store';
export { InMemoryUsageStore } from './tracking/usage.store';

export type {
  AIEnhancedServiceHooks,
  CompleteCallConfig,
  GenerateObjectResult,
} from './ai-enhanced.service';

export {
  composeAIMiddleware,
  AILoggingMiddleware,
  AICachingMiddleware,
  AIRetryMiddleware,
  AIFallbackMiddleware,
  type AIMiddleware,
  type AICompletionHandler,
  type AICacheAdapter,
} from './middleware/ai-middleware';

export { AIProviderError } from './errors/provider.error';
export type {
  NamedAIModelDefinition,
  AIModuleCallDefaults,
  AICallBudget,
  AIModelPricing,
  AIUsageListener,
  ResolvedNamedModel,
  AIRetryDefaults,
} from './models/model-registry.types';
export type { AIModuleOptions } from './models/module-options';

export {
  AgentTool,
  getAgentToolMetadata,
  getAgentToolsFromClass,
  type AgentToolOptions,
  type AgentToolMetadata,
  type AgentToolContext,
  type AgentToolCaller,
  type RegisteredAgentTool,
} from './tools/agent-tool.decorator';
export { AgentToolRegistry } from './tools/tool-registry';

export {
  type ApprovalPort,
  type ApprovalRequest,
  type ApprovalDecision,
  InMemoryApprovalPort,
} from './approval/approval-port';
export {
  GatekeeperApprovalPort,
  type GatekeeperApprovalEvaluator,
} from './approval/gatekeeper-approval-port';
export {
  InMemoryCallCheckpointStore,
  createHumanTaskCallCheckpointStore,
  type CallCheckpoint,
  type CallCheckpointStore,
  type CheckpointCallConfig,
  type HumanTaskCheckpointAdapter,
} from './approval/call-checkpoint-store';

export { FakeModel, type FakeModelReply } from './testing/fake-model';
export {
  matchExpectedCalls,
  parseExpectedCalls,
  type ExpectedCallSlice,
  type CallMatchFailure,
} from './testing/call-matcher';
export {
  runAiGolden,
  runAiGoldenCi,
  type AiGoldenDataset,
  type AiGoldenCase,
  type AiGoldenCaseRunner,
  type AiGoldenCaseContext,
  type RunAiGoldenOptions,
  type AiEvalRunOptions,
  type AiEvalRunResult,
} from './testing/run-ai-golden';

export {
  pipeTextStreamToResponse,
  pipeUIMessageStreamToResponse,
  wireClientAbort,
  type UIStreamOptions,
  type StreamProgressEvent,
} from './stream/ui-stream';

export {
  executeWithCallPolicy,
  estimateCost,
  isRetryableProviderError,
  isAbortError,
  isOutputInvalidError,
} from './policy/call-policy';

export { createGuardrailPreflightMiddleware } from './middleware/guardrails-ai.middleware';

export type { AIContextManagerOptions, ContextTrimStrategy } from './context/context.manager';
export type {
  ContextAssemblerPort,
  ContextAssembleRequest,
  AssembledContextResult,
  CallContextRequest,
  CallContextMeta,
} from './context/context-port';
export { injectAssembledContext, lastUserQuery } from './context/context-port';

// Debug utility
export { debug, setDebugEnabled } from './utils/debug';

export { messageContentToText, isMultipartContent } from './utils/message-content';

// ── Unified AI Platform (NEW) ─────────────────────────────────
export { HazelAI } from './platform/hazel-ai';
export { AIPlatformModule } from './platform/ai-platform.module';
export type {
  AgentGraph,
  CompiledGraph,
  GraphExecutionOptions,
  GraphExecutionResult,
  SupervisorConfig,
  SupervisorResult,
} from './platform/agent-orchestration.types';

// HCEL - HazelJS Composable Expression Language
export {
  HCELBuilder,
  HCELEngine,
  HCELError,
  HCELErrorCode,
  createMemoryHCELResultCache,
  getDefaultHCELResultCache,
  MemoryRecallOperation,
  MemorySaveOperation,
  MemorySearchOperation,
  AgentPipelineOperation,
  AgentSupervisorOperation,
  AgentGraphCompiledOperation,
  PromptOperation,
  RAGOperation,
  ContextAssembleOperation,
  AgentOperation,
  MLOperation,
  ParallelOperation,
  ConditionalOperation,
  SequenceOperation,
  HCELOperationFactory,
  createBuilder,
  compose,
  conditional,
  setHCELGlobalTraceEnabled,
  getHCELTraceSnapshot,
  clearHCELTraceBuffer,
  isHCELGlobalTraceEnabled,
} from './platform/hcel';
export type {
  HCELOperation,
  HCELContext,
  HCELChain,
  HCELBuilder as IHCELBuilder,
  HCELEvent,
  HCELResult,
  HCELResultCache,
  MemoryRecallOperationConfig,
  MemorySaveOperationConfig,
  MemorySearchOperationConfig,
  AgentPipelineOperationConfig,
  AgentSupervisorOperationConfig,
  AgentGraphCompiledOperationConfig,
  ContextAssembleOperationConfig,
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
