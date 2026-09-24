/**
 * Decision provider abstraction.
 */

import type {
  CandidateEvaluation,
  CriticResult,
  DecisionConfidence,
  DecisionEvidence,
  DecisionExecutionStrategy,
  DecisionRiskObject,
} from '../types';
import type { AgentDnaDecision } from '@hazeljs/agent';

export interface DecisionProviderRequest<TState = unknown, TDecision extends string = string> {
  decisionId: string;
  name?: string;
  objective: string;
  state: TState;
  choices: readonly TDecision[];
  risk: DecisionRiskObject;
  strategy: DecisionExecutionStrategy;
  definition?: AgentDnaDecision;
  tenantId?: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
}

export interface DecisionProviderResult<TDecision extends string = string> {
  decision: TDecision;
  score: number;
  confidence: DecisionConfidence;
  evidence: DecisionEvidence[];
  candidates: CandidateEvaluation<TDecision>[];
  critic?: CriticResult<TDecision>;
  evidenceGaps?: string[];
  modelCalls?: number;
  inputTokens?: number;
  outputTokens?: number;
  stages: string[];
  latency: {
    evidenceMs?: number;
    candidatesMs?: number;
    judgeMs?: number;
    criticMs?: number;
    confidenceMs?: number;
  };
}

export interface DecisionProvider {
  readonly name: string;
  decide<TState, TDecision extends string>(
    request: DecisionProviderRequest<TState, TDecision>
  ): Promise<DecisionProviderResult<TDecision>>;
}
