/**
 * Native Hazel Agent decision provider — offline heuristic pipeline by default.
 * Optional generateObject enables LLM judge/critic; stages run via HazelDecisionAgent.
 */

import type { AgentDnaDecision } from '@hazeljs/agent';
import { HazelDecisionAgent } from '../agents/hazel-decision-agent';
import { assertChoiceAllowed } from '../pipeline/judge';
import { llmCritic, llmJudge } from '../pipeline/llm-stages';
import {
  strategyIncludesCandidates,
  strategyIncludesCritic,
  strategyIncludesEvidence,
} from '../runtime/complexity-router';
import type {
  DecisionProvider,
  DecisionProviderRequest,
  DecisionProviderResult,
} from './decision-provider';
import type { StructuredObjectGenerator } from './structured-generator';
import { DecisionProviderError, DecisionValidationError } from '../errors';
import { getPathValue } from '../utils';

export interface HazelAgentDecisionProviderOptions {
  /** Optional @hazeljs/ai-compatible structured generator for judge/critic. */
  generateObject?: StructuredObjectGenerator;
  /** Prefer LLM judge/critic when generator is set (default true). */
  useLlmStages?: boolean;
  /** Agent instance whose @Tool stage methods are invoked. */
  agent?: HazelDecisionAgent;
}

function now(): number {
  return Date.now();
}

function applyRulesMode<TDecision extends string>(
  request: DecisionProviderRequest<unknown, TDecision>
): DecisionProviderResult<TDecision> | undefined {
  const def = request.definition;
  if (!def?.metadata || typeof def.metadata !== 'object') return undefined;
  const rules = (
    def.metadata as { rules?: Array<{ whenPath: string; gte?: number; then: string }> }
  ).rules;
  if (!rules?.length) return undefined;

  for (const rule of rules) {
    const v = getPathValue(request.state, rule.whenPath);
    if (typeof v === 'number' && rule.gte !== undefined && v >= rule.gte) {
      const decision = assertChoiceAllowed(rule.then, request.choices);
      const candidates = request.choices.map((c) => ({
        candidate: c,
        score: c === decision ? 1 : 0,
        supportingEvidence: [rule.whenPath],
      }));
      return {
        decision,
        score: 1,
        confidence: {
          value: 1,
          type: 'heuristic',
          calibrated: false,
          components: { evidenceCoverage: 1 },
        },
        evidence: [{ key: rule.whenPath, value: v, relevance: 1 }],
        candidates,
        stages: ['rules'],
        latency: { judgeMs: 0 },
        modelCalls: 0,
        inputTokens: 0,
        outputTokens: 0,
      };
    }
  }
  return undefined;
}

export class HazelAgentDecisionProvider implements DecisionProvider {
  readonly name = 'hazel-agent';
  private readonly generator?: StructuredObjectGenerator;
  private readonly useLlmStages: boolean;
  private readonly agent: HazelDecisionAgent;

  constructor(options: HazelAgentDecisionProviderOptions = {}) {
    this.generator = options.generateObject;
    this.useLlmStages = options.useLlmStages ?? true;
    this.agent = options.agent ?? new HazelDecisionAgent();
  }

  getDecisionAgent(): HazelDecisionAgent {
    return this.agent;
  }

  async decide<TState, TDecision extends string>(
    request: DecisionProviderRequest<TState, TDecision>
  ): Promise<DecisionProviderResult<TDecision>> {
    if (!request.choices?.length) {
      throw new DecisionValidationError('choices must be a non-empty array');
    }

    if (request.strategy === 'rules') {
      const ruled = applyRulesMode(request as DecisionProviderRequest<unknown, TDecision>);
      if (ruled) return ruled;
    }

    const definition = request.definition as AgentDnaDecision | undefined;
    const stages: string[] = [];
    const latency: DecisionProviderResult<TDecision>['latency'] = {};
    let modelCalls = 0;

    let evidence: DecisionProviderResult<TDecision>['evidence'] = [];
    let gaps: string[] = [];

    if (strategyIncludesEvidence(request.strategy) || request.strategy === 'rules') {
      const t0 = now();
      const extracted = this.agent.extractEvidenceTool({
        state: request.state,
        definition,
      });
      evidence = extracted.evidence;
      gaps = extracted.gaps;
      latency.evidenceMs = now() - t0;
      stages.push('evidence');
    }

    let candidates: DecisionProviderResult<TDecision>['candidates'] = request.choices.map((c) => ({
      candidate: c,
      score: 0.1,
      supportingEvidence: [] as string[],
    }));

    if (
      strategyIncludesCandidates(request.strategy) ||
      strategyIncludesEvidence(request.strategy)
    ) {
      const t0 = now();
      candidates = this.agent.evaluateCandidatesTool({
        choices: [...request.choices],
        evidence,
        definition,
      }).candidates as DecisionProviderResult<TDecision>['candidates'];
      latency.candidatesMs = now() - t0;
      stages.push('candidates');
    } else if (request.strategy === 'fast') {
      const extracted = this.agent.extractEvidenceTool({
        state: request.state,
        definition,
      });
      evidence = extracted.evidence;
      candidates = this.agent.evaluateCandidatesTool({
        choices: [...request.choices],
        evidence,
        definition,
      }).candidates as DecisionProviderResult<TDecision>['candidates'];
      stages.push('candidates');
    }

    const tJudge = now();
    let decision: TDecision;
    let score: number;
    let judgedNeedsReview = false;

    const wantLlmJudge =
      this.useLlmStages &&
      !!this.generator &&
      (request.strategy === 'deliberate' ||
        request.strategy === 'human-required' ||
        request.strategy === 'standard');

    if (wantLlmJudge && this.generator) {
      try {
        const llm = await llmJudge(this.generator, {
          objective: request.objective,
          choices: request.choices,
          evidence,
          candidates,
        });
        decision = llm.decision;
        score = llm.score;
        modelCalls += llm.modelCalls;
        stages.push('judge-llm');
      } catch (e) {
        if (e instanceof DecisionProviderError) {
          const judged = this.agent.judgeTool({
            choices: [...request.choices],
            candidates,
            definition,
          });
          decision = judged.decision as TDecision;
          score = judged.score;
          judgedNeedsReview = judged.needsReview;
          stages.push('judge', 'judge-llm-fallback');
        } else {
          throw e;
        }
      }
    } else {
      const judged = this.agent.judgeTool({
        choices: [...request.choices],
        candidates,
        definition,
      });
      decision = judged.decision as TDecision;
      score = judged.score;
      judgedNeedsReview = judged.needsReview;
      stages.push('judge');
    }
    latency.judgeMs = now() - tJudge;

    let critic: DecisionProviderResult<TDecision>['critic'];

    if (strategyIncludesCritic(request.strategy)) {
      const t0 = now();
      if (this.useLlmStages && this.generator) {
        try {
          const llm = await llmCritic(this.generator, {
            objective: request.objective,
            decision,
            score,
            choices: request.choices,
            evidence,
            candidates,
            gaps,
            definition,
          });
          critic = llm.critic;
          modelCalls += llm.modelCalls;
          stages.push('critic-llm');
        } catch (e) {
          if (e instanceof DecisionProviderError) {
            critic = this.agent.criticTool({
              decision,
              score,
              candidates,
              evidence,
              gaps,
              definition,
            }) as DecisionProviderResult<TDecision>['critic'];
            stages.push('critic', 'critic-llm-fallback');
          } else {
            throw e;
          }
        }
      } else {
        critic = this.agent.criticTool({
          decision,
          score,
          candidates,
          evidence,
          gaps,
          definition,
        }) as DecisionProviderResult<TDecision>['critic'];
        stages.push('critic');
      }
      latency.criticMs = now() - t0;

      if (
        critic?.status === 'challenged' &&
        critic.suggestedDecision &&
        (request.choices as readonly string[]).includes(critic.suggestedDecision)
      ) {
        const suggested = candidates.find((c) => c.candidate === critic!.suggestedDecision);
        if (suggested && suggested.score > score + 0.05) {
          decision = suggested.candidate;
          score = suggested.score;
          stages.push('re-evaluate');
        }
      }
    }

    const tConf = now();
    const confidence = this.agent.confidenceTool({
      judgeScore: score,
      candidates,
      evidence,
      requiredCount: definition?.evidence?.required?.length ?? 0,
      critic,
    });
    if (wantLlmJudge && modelCalls > 0) {
      confidence.type = 'ensemble';
      confidence.components = {
        ...confidence.components,
        providerConfidence: score,
      };
    }
    latency.confidenceMs = now() - tConf;
    stages.push('confidence');

    if (judgedNeedsReview && critic?.status !== 'confirmed') {
      confidence.value = Math.min(confidence.value, 0.69);
    }

    return {
      decision,
      score,
      confidence,
      evidence,
      candidates,
      critic,
      evidenceGaps: gaps,
      stages,
      latency,
      modelCalls,
      inputTokens: 0,
      outputTokens: 0,
    };
  }
}
