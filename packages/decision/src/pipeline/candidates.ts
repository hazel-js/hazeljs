/**
 * Candidate evaluation — weighted support scores (heuristic, not calibrated probabilities).
 */

import type { AgentDnaDecision } from '@hazeljs/agent';
import type { CandidateEvaluation, DecisionEvidence } from '../types';
import { clamp01 } from '../utils';

function evidenceMatches(
  ev: DecisionEvidence,
  when: 'present' | 'truthy' | 'gt0' = 'present'
): boolean {
  if (when === 'present') return true;
  if (when === 'truthy') return Boolean(ev.value);
  if (when === 'gt0') {
    return typeof ev.value === 'number' && ev.value > 0;
  }
  return true;
}

export function evaluateCandidates<TDecision extends string>(
  choices: readonly TDecision[],
  evidence: DecisionEvidence[],
  definition?: AgentDnaDecision
): CandidateEvaluation<TDecision>[] {
  const byKey = new Map(evidence.map((e) => [e.key, e]));
  const scoring = definition?.scoring ?? {};

  return choices.map((candidate) => {
    const weights = scoring[candidate] ?? [];
    if (weights.length === 0) {
      // No declared scoring → uniform weak prior so judge can still pick among equals via onTie.
      return {
        candidate,
        score: clamp01(0.1),
        supportingEvidence: [] as string[],
        contradictingEvidence: [] as string[],
      };
    }

    let raw = 0;
    let max = 0;
    const supporting: string[] = [];
    const contradicting: string[] = [];

    for (const w of weights) {
      max += Math.abs(w.weight);
      const ev = byKey.get(w.evidenceKey);
      if (!ev) {
        contradicting.push(w.evidenceKey);
        continue;
      }
      if (evidenceMatches(ev, w.when ?? 'present')) {
        raw += w.weight * (ev.relevance ?? 1);
        supporting.push(w.evidenceKey);
      } else {
        contradicting.push(w.evidenceKey);
      }
    }

    const score = max > 0 ? clamp01(raw / max) : 0;
    return {
      candidate,
      score,
      supportingEvidence: supporting,
      contradictingEvidence: contradicting.length ? contradicting : undefined,
    };
  });
}
