export type {
  MemoryLifecycleStatus,
  GovernedMemoryType,
  MemorySensitivity,
  MemoryProvenance,
  GovernedMemoryRecord,
  CaptureMemoryInput,
  MemoryAuthContext,
  RetrieveMemoryQuery,
  MemoryHookName,
  MemoryHookTurn,
  MemoryHookContext,
  MemoryHookResult,
  MemoryHook,
  GovernedMemoryHooks,
  RetrievalCacheStore,
} from './types';

export { InMemoryGovernedMemoryStore, newGovernedRecord, rankMemories } from './store';
export type { GovernedMemoryStore } from './store';

export {
  GovernedMemoryService,
  MemoryRetrievalCache,
  defaultClassifyMemoryCandidate,
} from './service';
export type { GovernedMemoryServiceOptions, AuditEvent } from './service';

export { createGovernedMemoryContributor } from './context-contributor';
export type { GovernedMemoryContextContributor } from './context-contributor';

export type {
  TurnObservation,
  LearnFromTurnInput,
  LearnFromTurnResult,
  MemoryCandidateAction,
  MemoryCandidateClassifier,
} from './observation';

export {
  RuleBasedObservationExtractor,
  type ObservationExtractor,
  type ExtractTurnInput,
} from './observation-extractor';

export {
  PrismaGovernedMemoryStore,
  createPrismaGovernedMemoryStore,
  type GovernedMemoryPrismaClient,
  type PrismaGovernedMemoryStoreOptions,
} from './prisma-governed.store';
