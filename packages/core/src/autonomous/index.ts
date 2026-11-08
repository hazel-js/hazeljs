export type {
  AutonomousMode,
  CapabilityEffect,
  CapabilityApproval,
  AutonomousBackoff,
  AutonomousLimits,
  AutonomousRetryConfig,
  AutonomousRecoveryConfig,
  AutonomousLoopProtection,
  AutonomousOptions,
  ObserveOptions,
  CapabilityOptions,
  AutonomousObservation,
  AutonomousDecision,
  AutonomousDecisionContext,
  AutonomousDecisionEngine,
  AutonomousOutcome,
  AutonomousOutcomeEvaluator,
  AutonomousRuntimePort,
  AutonomousMetadata,
  ObserveMetadata,
  CapabilityMetadata,
} from './types';

export {
  AutonomousDiagnosticCodes,
  AutonomousConfigurationError,
  type AutonomousDiagnosticCode,
} from './diagnostics';

export {
  assertValidAutonomousOptions,
  assertValidCapabilityOptions,
  assertCapabilityRetrySafety,
} from './validate';

export {
  Autonomous,
  Observe,
  Capability,
  getRegisteredAutonomousServices,
  getAutonomousMetadata,
  isAutonomous,
  getObserveMetadata,
  getObserveMethods,
  getCapabilityMetadata,
  getCapabilityMethods,
  clearAutonomousRegistry,
  AUTONOMOUS_METADATA_KEY,
  OBSERVE_METADATA_KEY,
  OBSERVE_LIST_KEY,
  CAPABILITY_METADATA_KEY,
  CAPABILITY_LIST_KEY,
} from './decorators';
