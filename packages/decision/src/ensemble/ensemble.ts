/**
 * Ensemble consensus over multiple judge votes.
 * Extensible strategies — v1 ships majority / weighted / unanimous / risk-sensitive.
 * Ensemble results still pass DecisionRuntime policy + Gatekeeper.
 */

import type { DecisionRiskLevel } from '../types';
import type {
  DecisionProvider,
  DecisionProviderRequest,
  DecisionProviderResult,
} from '../providers/decision-provider';
import { DecisionInvalidOutputError } from '../errors';
import { assertChoiceAllowed } from '../pipeline/judge';
import { calculateConfidence } from '../confidence/confidence-engine';
import { clamp01 } from '../utils';

export type EnsembleStrategy = 'majority' | 'weighted' | 'unanimous' | 'risk-sensitive';

export interface EnsembleVote<TDecision extends string = string> {
  source: string;
  decision: TDecision;
  score: number;
  weight?: number;
}

export interface EnsembleResult<TDecision extends string = string> {
  decision: TDecision;
  score: number;
  strategy: EnsembleStrategy;
  agreement: boolean;
  votes: EnsembleVote<TDecision>[];
  needsReview: boolean;
}

export interface EnsembleInput<TDecision extends string = string> {
  choices: readonly TDecision[];
  votes: EnsembleVote<TDecision>[];
  strategy?: EnsembleStrategy;
  risk?: DecisionRiskLevel;
}

function countVotes<TDecision extends string>(
  votes: EnsembleVote<TDecision>[],
  weighted: boolean
): Map<TDecision, { weight: number; scoreSum: number }> {
  const counts = new Map<TDecision, { weight: number; scoreSum: number }>();
  for (const v of votes) {
    const w = weighted ? (v.weight ?? 1) : 1;
    const cur = counts.get(v.decision) ?? { weight: 0, scoreSum: 0 };
    cur.weight += w;
    cur.scoreSum += v.score * w;
    counts.set(v.decision, cur);
  }
  return counts;
}

function pickTop<TDecision extends string>(
  counts: Map<TDecision, { weight: number; scoreSum: number }>
): { decision: TDecision; weight: number; avgScore: number } | undefined {
  let best: { decision: TDecision; weight: number; avgScore: number } | undefined;
  for (const [decision, { weight, scoreSum }] of counts) {
    const avgScore = weight > 0 ? scoreSum / weight : 0;
    if (!best || weight > best.weight || (weight === best.weight && avgScore > best.avgScore)) {
      best = { decision, weight, avgScore };
    }
  }
  return best;
}

/**
 * Resolve ensemble consensus. Invalid votes (outside choices) are rejected.
 */
export function resolveEnsemble<TDecision extends string>(
  input: EnsembleInput<TDecision>
): EnsembleResult<TDecision> {
  if (!input.votes.length) {
    throw new DecisionInvalidOutputError('Ensemble requires at least one vote');
  }

  const validated: EnsembleVote<TDecision>[] = input.votes.map((v) => ({
    ...v,
    decision: assertChoiceAllowed(v.decision, input.choices),
    score: clamp01(v.score),
  }));

  const strategy = input.strategy ?? 'majority';

  if (strategy === 'unanimous' || strategy === 'risk-sensitive') {
    if (strategy === 'risk-sensitive' && input.risk !== 'high' && input.risk !== 'critical') {
      return resolveEnsemble({ ...input, strategy: 'majority', votes: validated });
    }
    const first = validated[0].decision;
    const agreement = validated.every((v) => v.decision === first);
    const avg = validated.reduce((s, v) => s + v.score, 0) / validated.length;
    return {
      decision: first,
      score: avg,
      strategy,
      agreement,
      votes: validated,
      needsReview: !agreement,
    };
  }

  const weighted = strategy === 'weighted';
  const counts = countVotes(validated, weighted);
  const top = pickTop(counts);
  if (!top) {
    throw new DecisionInvalidOutputError('Ensemble could not pick a winner');
  }

  const agreement = validated.every((v) => v.decision === top.decision);
  return {
    decision: top.decision,
    score: clamp01(top.avgScore),
    strategy,
    agreement,
    votes: validated,
    needsReview: false,
  };
}

/**
 * DecisionProvider that fans out to multiple providers and consenses.
 * Does not execute capabilities — DecisionRuntime still governs.
 */
export function createEnsembleDecisionProvider(options: {
  name?: string;
  providers: DecisionProvider[];
  strategy?: EnsembleStrategy;
}): DecisionProvider {
  const name = options.name ?? 'ensemble';
  return {
    name,
    async decide<TState, TDecision extends string>(
      request: DecisionProviderRequest<TState, TDecision>
    ): Promise<DecisionProviderResult<TDecision>> {
      const votes: EnsembleVote<TDecision>[] = [];
      let modelCalls = 0;
      const t0 = Date.now();

      for (const p of options.providers) {
        const result = await p.decide(request);
        votes.push({
          source: p.name,
          decision: result.decision,
          score: result.score,
          weight: 1,
        });
        modelCalls += result.modelCalls ?? 0;
      }

      const consensus = resolveEnsemble({
        choices: request.choices,
        votes,
        strategy: options.strategy ?? 'majority',
        risk: request.risk.level,
      });

      const candidates = request.choices.map((c) => ({
        candidate: c,
        score: c === consensus.decision ? consensus.score : 0,
        supportingEvidence: [] as string[],
      }));
      const confidence = calculateConfidence({
        judgeScore: consensus.score,
        candidates,
        evidence: [],
        requiredCount: 0,
      });
      confidence.type = 'ensemble';
      if (consensus.needsReview) {
        confidence.value = Math.min(confidence.value, 0.69);
      }

      return {
        decision: consensus.decision,
        score: consensus.score,
        confidence,
        evidence: [],
        candidates,
        stages: ['ensemble', consensus.strategy],
        latency: { judgeMs: Date.now() - t0 },
        modelCalls,
        inputTokens: 0,
        outputTokens: 0,
      };
    },
  };
}
