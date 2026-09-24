/**
 * Judge — selects strongest candidate from the allowed choice set only.
 */

import type { AgentDnaDecision } from '@hazeljs/agent';
import { DecisionInvalidOutputError } from '../errors';
import type { CandidateEvaluation } from '../types';

export interface JudgeOutput<TDecision extends string> {
  decision: TDecision;
  score: number;
  tied: boolean;
  needsReview: boolean;
}

export function judgeCandidates<TDecision extends string>(
  choices: readonly TDecision[],
  candidates: CandidateEvaluation<TDecision>[],
  definition?: AgentDnaDecision
): JudgeOutput<TDecision> {
  const allowed = new Set(choices);
  const valid = candidates.filter((c) => allowed.has(c.candidate));
  if (valid.length === 0) {
    throw new DecisionInvalidOutputError('No valid candidates within allowed choices', {
      choices: [...choices],
    });
  }

  const sorted = [...valid].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const second = sorted[1];
  const tied = second !== undefined && Math.abs(top.score - second.score) < 1e-9;

  if (tied) {
    const onTie = definition?.onTie as TDecision | undefined;
    if (onTie && allowed.has(onTie)) {
      const tieCand = valid.find((c) => c.candidate === onTie)!;
      return { decision: onTie, score: tieCand.score, tied: true, needsReview: false };
    }
    if (allowed.has('review' as TDecision)) {
      return {
        decision: 'review' as TDecision,
        score: top.score,
        tied: true,
        needsReview: true,
      };
    }
    return { decision: top.candidate, score: top.score, tied: true, needsReview: true };
  }

  return { decision: top.candidate, score: top.score, tied: false, needsReview: false };
}

export function assertChoiceAllowed<TDecision extends string>(
  decision: string,
  choices: readonly TDecision[]
): TDecision {
  if (!(choices as readonly string[]).includes(decision)) {
    throw new DecisionInvalidOutputError(`Decision "${decision}" is not in allowed choices`, {
      decision,
      choices: [...choices],
    });
  }
  return decision as TDecision;
}
