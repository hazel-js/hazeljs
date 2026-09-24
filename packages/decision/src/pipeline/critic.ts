/**
 * Critic — challenges uncertain / high-risk decisions (no hidden chain-of-thought).
 */

import type { AgentDnaDecision } from '@hazeljs/agent';
import type { CandidateEvaluation, CriticResult, DecisionEvidence } from '../types';

export interface CriticInput<TDecision extends string> {
  decision: TDecision;
  score: number;
  candidates: CandidateEvaluation<TDecision>[];
  evidence: DecisionEvidence[];
  gaps: string[];
  definition?: AgentDnaDecision;
  /** Minimum top-two separation to confirm without challenge. */
  minSeparation?: number;
}

export function runCritic<TDecision extends string>(
  input: CriticInput<TDecision>
): CriticResult<TDecision> {
  const minSep = input.minSeparation ?? 0.15;
  const sorted = [...input.candidates].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const second = sorted[1];
  const separation = top && second ? Math.abs(top.score - second.score) : top ? top.score : 0;

  const required = input.definition?.evidence?.required ?? [];
  const missingRequired = required.filter(
    (k) => !input.evidence.some((e) => e.key === k) || input.gaps.includes(k)
  );
  const gaps = [...new Set([...input.gaps, ...missingRequired])];

  if (gaps.length > 0) {
    return {
      status: 'inconclusive',
      confidenceAdjustment: -0.1,
      evidenceGaps: gaps,
      notes: ['Required evidence missing'],
    };
  }

  if (separation < minSep) {
    const alt = second?.candidate;
    return {
      status: 'challenged',
      suggestedDecision: alt,
      confidenceAdjustment: -0.05,
      evidenceGaps: [],
      notes: [
        `Top candidates close (separation=${separation.toFixed(3)}); reconsider ${String(alt ?? 'n/a')}`,
      ],
    };
  }

  if (input.score < 0.5) {
    return {
      status: 'challenged',
      confidenceAdjustment: -0.08,
      notes: ['Judge score below 0.5'],
    };
  }

  return {
    status: 'confirmed',
    confidenceAdjustment: 0.02,
    notes: ['Critic confirmed preferred candidate'],
  };
}
