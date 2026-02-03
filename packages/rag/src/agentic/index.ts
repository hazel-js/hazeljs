/**
 * Agentic RAG - Advanced Retrieval-Augmented Generation
 * Export all agentic RAG functionality
 */

// Types - explicit exports to avoid conflicts
export type {
  QueryPlan,
  SubQuery,
  ReasoningChain,
  ReasoningHop,
  ReflectionResult,
  QualityAssessment,
  VerifiedResponse,
  VerifiedSource,
  Citation,
  Context,
  FeedbackData,
  GraphSearchResult,
  GraphNode,
  GraphEdge,
  AdaptiveStrategyResult,
  HyDEResult,
  CorrectiveRAGResult,
  Correction,
  AgenticLLMProvider,
  LLMOptions,
  CacheEntry,
  AgenticRAGConfig,
} from './types';

// Re-export Entity and Message with aliases to avoid conflicts
export type { Entity as AgenticEntity, Message as AgenticMessage } from './types';

// Decorators
export * from './decorators';

// Service
export * from './agentic-rag.service';
