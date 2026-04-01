/**
 * Platform barrel export
 */

export { HazelAI } from './hazel-ai';
export { AIPlatformModule } from './ai-platform.module';

// HCEL - HazelJS Composable Expression Language
export { HCELBuilder, HCELEngine } from './hcel';
export type {
  HCELOperation,
  HCELContext,
  HCELChain,
  HCELBuilder as IHCELBuilder,
  HCELEvent,
  HCELResult,
} from './hcel';

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
} from './hazel-ai.types';
