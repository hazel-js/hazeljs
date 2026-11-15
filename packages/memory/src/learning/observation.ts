/**
 * Turn-level learning inputs/outputs for GovernedMemoryService.learnFromTurn.
 */

import type {
  GovernedMemoryRecord,
  GovernedMemoryType,
  MemoryAuthContext,
  MemoryProvenance,
} from './types';

export interface TurnObservation {
  type: GovernedMemoryType;
  content: string;
  provenance: MemoryProvenance;
  sourceTrust: number;
  extractionConfidence: number;
  factConfidence?: number;
  /** Stable id for dedupe across turns (e.g. hash of normalized content). */
  sourceId?: string;
}

export interface LearnFromTurnInput {
  auth: MemoryAuthContext;
  tenantId: string;
  subjectId: string;
  /** Default memory scope (e.g. "customer"). */
  scope?: string;
  userText: string;
  assistantText?: string;
  sessionId?: string;
  runId?: string;
}

export type MemoryCandidateAction = 'persist' | 'quarantine' | 'discard' | 'review';

export interface LearnFromTurnResult {
  observations: TurnObservation[];
  captured: GovernedMemoryRecord[];
  accepted: GovernedMemoryRecord[];
  quarantined: GovernedMemoryRecord[];
  discarded: TurnObservation[];
  reviewed: GovernedMemoryRecord[];
}

/** Duck-typed DecisionPlane + classifyMemoryCandidate (optional peer @hazeljs/decision). */
export interface MemoryCandidateClassifier {
  classify(input: {
    text: string;
    sourceKind: 'user' | 'tool' | 'model' | 'system';
    sourceTrust?: number;
    containsSecret?: boolean;
    grantsRoleOrPolicy?: boolean;
    isPreference?: boolean;
    isProcedure?: boolean;
    sameSourceRepeatCount?: number;
    tenantId: string;
    actorId: string;
  }): Promise<MemoryCandidateAction>;
}
