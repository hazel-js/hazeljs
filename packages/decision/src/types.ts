/**
 * Public types for `@hazeljs/decision`.
 */

import type { AgentDnaDecision } from '@hazeljs/agent';

export type DecisionRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type DecisionExecutionStrategy =
  | 'fast'
  | 'standard'
  | 'deliberate'
  | 'human-required'
  | 'rules';

export type DecisionStrategyInput =
  | DecisionExecutionStrategy
  | 'auto'
  | { mode: DecisionExecutionStrategy | 'auto' | 'rules' };

export type DecisionPolicyAction =
  | 'allow'
  | 'deny'
  | 'critique'
  | 'review'
  | 'escalate'
  | 'fallback';

export type DecisionConfidenceType =
  | 'provider'
  | 'heuristic'
  | 'ensemble'
  | 'calibrated'
  | 'self-reported';

export interface DecisionRiskObject {
  level: DecisionRiskLevel;
  impact?: string;
  reversible?: boolean;
}

export type DecisionRiskInput = DecisionRiskLevel | DecisionRiskObject;

export interface DecisionContext {
  tenantId?: string;
  agentId?: string;
  runId?: string;
  traceId?: string;
  environment?: string;
  metadata?: Record<string, unknown>;
}

export interface DecisionPolicyRule {
  when?: {
    risk?: DecisionRiskLevel;
    confidence?: { gte?: number; lt?: number; lte?: number; gt?: number };
  };
  action: DecisionPolicyAction;
}

export interface DecisionPolicyConfig {
  rules?: DecisionPolicyRule[];
  confidence?: {
    high?: number;
    medium?: number;
  };
}

export interface DecisionRequest<
  TState = unknown,
  TChoices extends readonly string[] = readonly string[],
> {
  name?: string;
  objective: string;
  state: TState;
  choices: TChoices;
  context?: DecisionContext;
  risk?: DecisionRiskInput;
  strategy?: DecisionStrategyInput;
  provider?: string;
  policy?: DecisionPolicyConfig | DecisionPolicyRule[];
  /** Optional Decision DNA overlay / registry lookup key. */
  definition?: AgentDnaDecision;
  metadata?: Record<string, unknown>;
  /** When true, attempt capability execution after policy allow + Gatekeeper allow. */
  execute?: boolean;
  /**
   * Opt-in result cache (requires DecisionRuntimeOptions.cache).
   * Never caches execution side-effects; state fingerprint invalidates.
   */
  cache?: boolean;
  /**
   * Opt-in: rewrite confidence via DecisionRuntimeOptions.calibration for reporting.
   * Never authorizes execution; never injects history into prompts.
   */
  calibrate?: boolean;
}

export interface DecisionEvidence {
  key: string;
  value: unknown;
  relevance: number;
}

export interface CandidateEvaluation<TDecision = string> {
  candidate: TDecision;
  /** Support score in [0, 1] — not a calibrated probability unless confidence.type === 'calibrated'. */
  score: number;
  supportingEvidence: string[];
  contradictingEvidence?: string[];
}

export interface CriticResult<TDecision = string> {
  status: 'confirmed' | 'challenged' | 'inconclusive';
  suggestedDecision?: TDecision;
  confidenceAdjustment?: number;
  evidenceGaps?: string[];
  notes?: string[];
}

export interface DecisionConfidence {
  value: number;
  type: DecisionConfidenceType;
  calibrated: boolean;
  components?: {
    candidateSeparation?: number;
    criticAgreement?: number;
    evidenceCoverage?: number;
    providerConfidence?: number;
  };
}

export interface DecisionProvenance {
  definitionName?: string;
  definitionVersion?: string;
  agentId?: string;
  tenantId?: string;
  stages: string[];
  /** Structured, non-hidden evidence summary only. */
  summary?: string;
}

export interface DecisionResult<TDecision = string> {
  id: string;
  decision: TDecision;
  confidence: number;
  confidenceDetail: DecisionConfidence;
  alternatives?: Array<{ decision: TDecision; confidence: number }>;
  evidence?: DecisionEvidence[];
  candidates?: CandidateEvaluation<TDecision>[];
  critic?: CriticResult<TDecision>;
  strategy: DecisionExecutionStrategy;
  provider: string;
  risk: DecisionRiskObject;
  policy: {
    outcome: DecisionPolicyAction;
    reason?: string;
  };
  provenance: DecisionProvenance;
  execution?: {
    requested: boolean;
    authorized?: boolean;
    capability?: string;
    invoked?: boolean;
    receiptId?: string;
  };
  hitl?: {
    required: boolean;
    taskId?: string;
    status?: 'pending' | 'approved' | 'rejected' | 'overridden';
  };
  cost?: {
    modelCalls: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCost?: number;
  };
  latency: {
    evidenceMs?: number;
    candidatesMs?: number;
    judgeMs?: number;
    criticMs?: number;
    confidenceMs?: number;
    policyMs?: number;
    skillgateMs?: number;
    totalMs: number;
  };
  trace: {
    runId?: string;
    decisionId: string;
    traceId?: string;
  };
  status: DecisionRunStatus;
}

export type DecisionRunStatus =
  | 'CREATED'
  | 'EVIDENCE_RUNNING'
  | 'EVIDENCE_COMPLETE'
  | 'JUDGING'
  | 'DECISION_PROPOSED'
  | 'CRITIQUE_REQUIRED'
  | 'CRITIQUING'
  | 'DECISION_FINALIZED'
  | 'POLICY_EVALUATED'
  | 'REVIEW_REQUIRED'
  | 'WAITING_FOR_HUMAN'
  | 'AUTHORIZED'
  | 'EXECUTION_STARTED'
  | 'COMPLETED'
  | 'FAILED'
  | 'DENIED';

/** Serializable Decision Lab DTO (UI deferred). */
export interface DecisionLabRun {
  result: DecisionResult;
  stages: Array<{
    name: string;
    durationMs: number;
    output?: unknown;
  }>;
  audit?: Record<string, unknown>;
}

export interface DecisionEvaluationRecord {
  decisionId: string;
  actualOutcome?: unknown;
  expectedDecision?: string;
  recordedAt: string;
  metadata?: Record<string, unknown>;
}

export type CapabilityHandler = (input: {
  decisionId: string;
  decision: string;
  capability: string;
  state: unknown;
  tenantId?: string;
}) => Promise<unknown> | unknown;

export interface DecisionDefinition extends AgentDnaDecision {
  name: string;
}
