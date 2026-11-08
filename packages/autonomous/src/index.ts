/**
 * @hazeljs/autonomous — Autonomous Application Runtime
 */

export {
  AutonomousModule,
  AutonomousBootstrapService,
  AUTONOMOUS_OPTIONS,
} from './autonomous.module';
export { AutonomousRuntime, buildObservation } from './runtime/autonomous.runtime';
export { RulesDecisionEngine } from './decision/rules-engine';
export { CapabilityRegistry, effectToGateClassification } from './capability/registry';
export { policiesFromCapabilities } from './capability/policies';
export {
  MemoryAutonomousRunStore,
  createAgentBackedRunStore,
  newRunId,
} from './store/memory-run.store';
export { LoopProtector, mergeLoopProtection } from './observation/loop-protection';
export { redactPayload } from './observation/envelope';
export { AutonomousMetrics } from './observability/metrics';
export { simulate, evaluateOutcome } from './simulation/simulate';
export type { SimulateOptions, OutcomeRecommendation } from './simulation/simulate';
export { FailureInjector } from './simulation/failure-injection';
export type { FailureScenario, FailureInjectionConfig } from './simulation/failure-injection';

export type {
  AarPhase,
  AarRunMetadata,
  AarTimelineEvent,
  RegisteredCapability,
  RegisteredAutonomousService,
  AutonomousModuleOptions,
  AutonomousRunStore,
  AutonomousRunRecord,
} from './types';
export { DEFAULT_LOOP_PROTECTION } from './types';

// Re-export core decorators for convenient single-package imports
export {
  Autonomous,
  Observe,
  Capability,
  getRegisteredAutonomousServices,
  getAutonomousMetadata,
  isAutonomous,
  clearAutonomousRegistry,
  AutonomousConfigurationError,
  AutonomousDiagnosticCodes,
} from '@hazeljs/core';
export type {
  AutonomousMode,
  AutonomousOptions,
  AutonomousObservation,
  AutonomousDecision,
  AutonomousDecisionEngine,
  CapabilityOptions,
  CapabilityEffect,
} from '@hazeljs/core';
