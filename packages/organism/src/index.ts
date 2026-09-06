/**
 * @hazeljs/organism
 * Agentic Organism Runtime — mission-defined, self-organizing ephemeral agent societies.
 */

import '@hazeljs/core';

export * from './types/organism.types';
export * from './errors/organism.errors';
export * from './events/organism-events';
export * from './persistence/organism-repository';
export { InMemoryOrganismRepository } from './persistence/organism-repository';

export {
  Mission,
  Organism,
  AgentGene,
  Environment,
  Constitution,
  Resource,
  getMissionMetadata,
  getOrganismMetadata,
  getAgentGeneMetadata,
  getEnvironmentMetadata,
  getConstitutionMetadata,
  getResourceMetadata,
  getRegisteredMissions,
  getRegisteredOrganisms,
  getRegisteredGenes,
  getRegisteredEnvironments,
  getRegisteredConstitutions,
  getRegisteredResources,
  resolveMission,
  resolveGene,
  resolveEnvironment,
  resolveConstitution,
  resolveResource,
} from './decorators';

export { OrganismRuntime, createOrganism } from './core/organism-runtime';
export type { CreateOrganismOptions, SimulateOptions } from './core/organism-runtime';
export { OrganismAgentContext } from './core/organism-context';
export { CapabilityRegistry } from './core/capability-registry';
export { createMissionProgress, applyMissionMetricUpdates } from './core/mission';
export { OrganismClock, parseDurationMs } from './core/clock';

export { PerceptionEngine, NeedDetector } from './perception/perception-engine';
export { DecisionEngine } from './lifecycle/decision-engine';
export { BirthEngine, TerminationEngine, resetAgentSeqForTests } from './lifecycle/birth-engine';
export { SurvivalEngine } from './lifecycle/survival-engine';
export { ReproductionEngine, DEFAULT_REPRODUCTION_CONFIG } from './lifecycle/reproduction-engine';
export type { ReproductionConfig } from './lifecycle/reproduction-engine';
export { GenealogyManager } from './genealogy/genealogy-manager';
export { MutationEngine } from './evolution/mutation-engine';
export type { MutationRequest } from './evolution/mutation-engine';
export { EvolutionEngine, GenerationManager } from './evolution/evolution-engine';

export { ResourceAllocator, createEmptyWallet, throwIfDenied } from './economy/resource-allocator';
export { UtilityEngine, ReputationEngine } from './economy/utility-engine';
export { UtilityForecaster } from './economy/utility-forecaster';
export { MarketEngine, resetBidSeqForTests } from './economy/market-engine';
export { ConstitutionEnforcer } from './governance/constitution';
export { OrganismMetrics } from './observability/metrics';
export type { OrganismMetricsSnapshot } from './observability/metrics';

/** App embedding / product-platform boilerplate */
export { createOrganismHost, wrapOrganismRuntime } from './host/organism-host';
export type { OrganismHost } from './host/organism-host';
export { OrganismHostRegistry } from './host/organism-host-registry';
export {
  toEnvironmentSignal,
  toIncidentEnvironmentSignal,
  incidentNeedMappings,
  toAgentOutcomeReport,
} from './bridge/signal-bridge';
export type { ExternalSignalLike, OutcomeVerdictLike } from './bridge/signal-bridge';
export { createOpsOrganism } from './integration/create-ops-organism';
export type { CreateOpsOrganismOptions } from './integration/create-ops-organism';
