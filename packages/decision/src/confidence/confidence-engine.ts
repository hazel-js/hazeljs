/**
 * Confidence engine — tracks source; does not pretend heuristic scores are calibrated probabilities.
 */

import type {
  CandidateEvaluation,
  CriticResult,
  DecisionConfidence,
  DecisionEvidence,
} from '../types';
import { assertFiniteConfidence, clamp01 } from '../utils';
import { DecisionInvalidOutputError } from '../errors';

export interface ConfidenceInput {
  judgeScore: number;
  candidates: CandidateEvaluation[];
  evidence: DecisionEvidence[];
  requiredCount: number;
  critic?: CriticResult;
  providerConfidence?: number;
}

export function calculateConfidence(input: ConfidenceInput): DecisionConfidence {
  let judgeScore: number;
  try {
    judgeScore = assertFiniteConfidence(input.judgeScore, 'judgeScore');
  } catch (e) {
    throw new DecisionInvalidOutputError(e instanceof Error ? e.message : String(e), {
      judgeScore: input.judgeScore,
    });
  }

  const sorted = [...input.candidates].sort((a, b) => b.score - a.score);
  const top = sorted[0]?.score ?? 0;
  const second = sorted[1]?.score ?? 0;
  const candidateSeparation = clamp01(top - second);

  const covered =
    input.requiredCount === 0
      ? 1
      : clamp01(input.evidence.length / Math.max(1, input.requiredCount));

  // Prefer explicit required coverage when we know the count.
  const evidenceCoverage =
    input.requiredCount === 0
      ? clamp01(input.evidence.length > 0 ? 0.8 : 0.3)
      : clamp01(input.evidence.length / input.requiredCount);

  let criticAgreement = 0.5;
  let adj = 0;
  if (input.critic) {
    if (input.critic.status === 'confirmed') {
      criticAgreement = 1;
      adj = input.critic.confidenceAdjustment ?? 0.02;
    } else if (input.critic.status === 'challenged') {
      criticAgreement = 0.35;
      adj = input.critic.confidenceAdjustment ?? -0.05;
    } else {
      criticAgreement = 0.2;
      adj = input.critic.confidenceAdjustment ?? -0.1;
    }
  }

  const provider =
    input.providerConfidence !== undefined
      ? assertFiniteConfidence(input.providerConfidence, 'providerConfidence')
      : undefined;

  const value = clamp01(
    0.45 * judgeScore +
      0.25 * candidateSeparation +
      0.2 * evidenceCoverage +
      0.1 * criticAgreement +
      adj
  );

  return {
    value,
    type: provider !== undefined ? 'ensemble' : 'heuristic',
    calibrated: false,
    components: {
      candidateSeparation,
      criticAgreement,
      evidenceCoverage: evidenceCoverage || covered,
      providerConfidence: provider,
    },
  };
}
