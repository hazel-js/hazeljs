/**
 * Provider-neutral Decision Plane (opt-in).
 * Does not replace DecisionRuntime.
 */

export { defineDecision } from './definition';
export type {
  DecisionDefinition,
  PlaneBudget,
  PlaneCacheConfig,
  PlaneFailureBehavior,
  PlaneProviderStrategy,
  InferAnswers,
} from './definition';

export type {
  PlaneExecutionContext,
  PlaneUsage,
  PlaneResult,
  PlaneResultBase,
  PlaneDecideRequest,
  PlaneCapabilityStatus,
  PlaneProviderCapabilities,
} from './result';

export {
  MemoryDecisionCacheStore,
  RedisDecisionCacheStore,
  FakeRedisDecisionClient,
  canonicalJson,
  planeInputDigest,
  planeCacheKey,
  serializePlaneResult,
  deserializePlaneResult,
} from './cache';
export type { DecisionCacheStore, RedisLikeCacheClient } from './cache';

export {
  createRulesPlaneProvider,
  createStructuredPlaneProvider,
  createJevPlaneProvider,
  createOpenAiDecisionsProvider,
  listDefaultPlaneCapabilities,
} from './providers';
export type {
  PlaneProvider,
  PlaneProviderInput,
  PlaneProviderOutcome,
  RuleClause,
  RulePredicate,
} from './providers';

export { createDecisionPlane } from './service';
export type { DecisionPlane, DecisionPlaneOptions, PlaneResilienceHooks } from './service';

export * from './integrations';
