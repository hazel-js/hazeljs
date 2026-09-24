/**
 * Mock decision provider for tests — no paid model APIs.
 */

import type {
  DecisionProvider,
  DecisionProviderRequest,
  DecisionProviderResult,
} from './decision-provider';
import { DecisionProviderError } from '../errors';
import { assertChoiceAllowed } from '../pipeline/judge';
import { calculateConfidence } from '../confidence/confidence-engine';
import type { CandidateEvaluation } from '../types';

interface MockReturn<TDecision extends string = string> {
  decision: TDecision;
  confidence?: number;
  score?: number;
  evidence?: DecisionProviderResult<TDecision>['evidence'];
  candidates?: CandidateEvaluation<TDecision>[];
  critic?: DecisionProviderResult<TDecision>['critic'];
  fail?: boolean;
  errorMessage?: string;
}

export class MockDecisionProvider implements DecisionProvider {
  readonly name = 'mock';
  private readonly byName = new Map<string, MockReturn>();
  private defaultReturn?: MockReturn;

  when(decisionName: string): {
    return: (value: MockReturn) => MockDecisionProvider;
  } {
    return {
      return: (value: MockReturn): MockDecisionProvider => {
        this.byName.set(decisionName, value);
        return this;
      },
    };
  }

  setDefault(value: MockReturn): this {
    this.defaultReturn = value;
    return this;
  }

  async decide<TState, TDecision extends string>(
    request: DecisionProviderRequest<TState, TDecision>
  ): Promise<DecisionProviderResult<TDecision>> {
    const key = request.name ?? request.objective;
    const stub = (this.byName.get(key) ?? this.defaultReturn) as MockReturn<TDecision> | undefined;
    if (!stub) {
      throw new DecisionProviderError(`MockDecisionProvider has no stub for "${key}"`);
    }
    if (stub.fail) {
      throw new DecisionProviderError(stub.errorMessage ?? 'Mock provider failure', {
        provider: 'mock',
      });
    }

    const decision = assertChoiceAllowed(stub.decision, request.choices);
    const score = stub.score ?? stub.confidence ?? 0.9;
    const candidates =
      stub.candidates ??
      request.choices.map((c) => ({
        candidate: c,
        score: c === decision ? score : Math.max(0, score - 0.5),
        supportingEvidence: [] as string[],
      }));

    const confidence = calculateConfidence({
      judgeScore: score,
      candidates,
      evidence: stub.evidence ?? [],
      requiredCount: 0,
      critic: stub.critic,
      providerConfidence: stub.confidence,
    });

    if (stub.confidence !== undefined) {
      confidence.value = stub.confidence;
      confidence.type = 'self-reported';
      confidence.calibrated = false;
    }

    return {
      decision,
      score,
      confidence,
      evidence: stub.evidence ?? [],
      candidates,
      critic: stub.critic,
      stages: ['mock'],
      latency: { judgeMs: 0 },
      modelCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
  }
}
