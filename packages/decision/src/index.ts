/**
 * @hazeljs/decision
 *
 * Native HazelJS Agent OS decision intelligence runtime.
 *
 * Models propose. Agents evaluate. Critics challenge. Confidence informs.
 * Policies govern. Skillgate classifies. Gatekeeper authorizes.
 * Durable Kernel executes. Agent VM isolates effects. Agent OS observes.
 */

export * from './types';
export * from './errors';
export * from './utils';

export { DecisionRuntime, createDecisionRuntime } from './runtime/decision-runtime';
export type { DecisionRuntimeOptions } from './runtime/decision-runtime';
export {
  selectExecutionStrategy,
  resolveStrategyMode,
  strategyIncludesEvidence,
  strategyIncludesCandidates,
  strategyIncludesCritic,
} from './runtime/complexity-router';
export type { ComplexityRouterInput } from './runtime/complexity-router';

export type {
  DecisionProvider,
  DecisionProviderRequest,
  DecisionProviderResult,
} from './providers/decision-provider';
export { DecisionProviderRegistry } from './providers/provider-registry';
export type { ProviderRouterHook } from './providers/provider-registry';
export { HazelAgentDecisionProvider } from './providers/hazel-agent-provider';
export type { HazelAgentDecisionProviderOptions } from './providers/hazel-agent-provider';
export { MockDecisionProvider } from './providers/mock-provider';
export type { StructuredObjectGenerator } from './providers/structured-generator';

export { HazelDecisionAgent } from './agents/hazel-decision-agent';
export { llmJudge, llmCritic } from './pipeline/llm-stages';

export { extractEvidence } from './pipeline/evidence';
export { evaluateCandidates } from './pipeline/candidates';
export { judgeCandidates, assertChoiceAllowed } from './pipeline/judge';
export { runCritic } from './pipeline/critic';
export { calculateConfidence } from './confidence/confidence-engine';
export { evaluateDecisionPolicy } from './policy/policy-evaluator';

export {
  authorizeCapability,
  applySkillgateRiskFloor,
  skillClassToRiskFloor,
  lookupSkill,
} from './governance/authorize';
export type {
  AuthorizeCapabilityInput,
  AuthorizeCapabilityResult,
  GovernedSkillLike,
  SkillgateLookup,
  SkillClass,
} from './governance/authorize';

export { DecisionDurableStore } from './durable/decision-store';
export type { DecisionCheckpointPayload } from './durable/decision-store';

export {
  resetDecisionMetrics,
  incMetric,
  observeMetric,
  getMetricCounter,
  getMetricSnapshot,
  redactForAudit,
  buildAuditEvent,
  recordDecisionMetrics,
  withOptionalSpan,
} from './observability/metrics';

export { DecisionRegistry } from './dna/decision-registry';
export { incidentRemediationDefinition, incidentState, refundDefinition } from './dna/definitions';
export {
  Decision,
  DECISION_METADATA_KEY,
  getRegisteredDecisionMethods,
  getDecisionMetadata,
} from './decorators/decision.decorator';
export type {
  DecisionDecoratorConfig,
  DecisionMethodMetadata,
} from './decorators/decision.decorator';

export {
  DecisionModule,
  DecisionService,
  createGovernedDecisionRuntime,
  DECISION_RUNTIME_TOKEN,
  DECISION_AUDIT_TOKEN,
} from './decision.module';
export type { DecisionModuleOptions, DecisionAuditLike } from './decision.module';

export { DecisionLab, createDecisionLab, enrichLabRun, toLabGraph } from './lab/decision-lab';
export type {
  DecisionLabCompareRow,
  DecisionLabComparison,
  DecisionLabGraphNode,
} from './lab/decision-lab';

export {
  createOpenAiDecisionProvider,
  createGeminiDecisionProvider,
  createJevDecisionProvider,
  createLocalDecisionProvider,
} from './providers/external-adapters';

export { resolveEnsemble, createEnsembleDecisionProvider } from './ensemble/ensemble';
export type {
  EnsembleStrategy,
  EnsembleVote,
  EnsembleResult,
  EnsembleInput,
} from './ensemble/ensemble';

export { DecisionCache, decisionCacheKey } from './cache/decision-cache';
export type {
  DecisionCacheOptions,
  DecisionCacheEntry,
  CachedDecisionResult,
} from './cache/decision-cache';

export { DecisionHistory } from './history/decision-history';
export type {
  DecisionHistoryRecord,
  DecisionHistoryQuery,
  DecisionHistoryTrends,
} from './history/decision-history';

export {
  createCostAwareRouter,
  registerShadowProvider,
  runWithShadow,
  riskObject,
} from './providers/routing';
export type { ProviderCostProfile } from './providers/routing';

export { projectDecisionFlow, buildDecisionFlowDefinition } from './flow/decision-flow';
export type {
  DecisionFlowStageId,
  DecisionFlowNode,
  DecisionFlowEdge,
  DecisionFlowProjection,
  ProjectDecisionFlowInput,
  DecisionFlowDefinitionStub,
  DecisionFlowStageHandler,
} from './flow/decision-flow';

export {
  samplesFromHistory,
  fitCalibration,
  fitCalibrationFromHistory,
  applyCalibration,
  calibrateConfidence,
  calibrationReport,
} from './calibration/calibration';
export type {
  CalibrationSample,
  CalibrationBin,
  CalibrationModel,
  FitCalibrationOptions,
} from './calibration/calibration';
