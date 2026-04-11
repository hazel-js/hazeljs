/**
 * HCEL - HazelJS Composable Expression Language
 *
 * A TypeScript-native composable expression language for AI operations
 * that goes beyond LCEL's pipe operator with full type safety and
 * built-in observability.
 */

// Core exports
export { HCELBuilder } from './hcel.builder';
export { HCELEngine } from './hcel.engine';
export type {
  HCELOperation,
  HCELOperationMetadata,
  HCELContext,
  HCELChain,
  HCELChainConfig,
  HCELBuilder as IHCELBuilder,
  HCELEvent,
  HCELResult,
  HCELOperationResult,
  HCELResultMetadata,
  HCELEngine as IHCELEngine,
  HCELOperationRegistry,
  HCELInputOf,
  HCELOutputOf,
  HCELInfer,
} from './hcel.types';

// Operation exports
export {
  PromptOperation,
  RAGOperation,
  AgentOperation,
  MLOperation,
  ParallelOperation,
  ConditionalOperation,
  SequenceOperation,
  MemoryRecallOperation,
  MemorySaveOperation,
  MemorySearchOperation,
  AgentPipelineOperation,
  AgentSupervisorOperation,
  AgentGraphCompiledOperation,
  HCELOperationFactory,
} from './hcel.operations';

export { HCELError, HCELErrorCode } from './hcel.error';
export {
  createMemoryHCELResultCache,
  getDefaultHCELResultCache,
  type HCELResultCache,
} from './hcel.cache';

export {
  setHCELGlobalTraceEnabled,
  getHCELTraceSnapshot,
  clearHCELTraceBuffer,
  isHCELGlobalTraceEnabled,
} from './hcel-trace.global';

// Utility exports
export { createBuilder, compose, conditional } from './hcel.builder';

// Re-export types for convenience
export type {
  PromptOperationConfig,
  RAGOperationConfig,
  AgentOperationConfig,
  MLOperationConfig,
  ParallelOperationConfig,
  ConditionalOperationConfig,
  SequenceOperationConfig,
  MemoryRecallOperationConfig,
  MemorySaveOperationConfig,
  MemorySearchOperationConfig,
  AgentPipelineOperationConfig,
  AgentSupervisorOperationConfig,
  AgentGraphCompiledOperationConfig,
  HCELRetryPolicy,
  HCELObservabilityConfig,
} from './hcel.types';
