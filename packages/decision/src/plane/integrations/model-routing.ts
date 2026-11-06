/**
 * Model routing integration — advisory tier selection.
 * Cannot grant permissions; abstain triggers configured safe behavior.
 */

import { defineDecision, type DecisionDefinition } from '../definition';
import type { DecisionPlane } from '../service';
import type { PlaneExecutionContext, PlaneResult } from '../result';
import { createRulesPlaneProvider } from '../providers';

export const MODEL_ROUTE_ANSWERS = ['fast', 'balanced', 'advanced', 'abstain'] as const;
export type ModelRouteAnswer = (typeof MODEL_ROUTE_ANSWERS)[number];

export interface ModelRouteContext {
  requestText: string;
  taskPhase?: string;
  toolCount?: number;
  spendUsdSoFar?: number;
  spendLimitUsd?: number;
  permittedCapabilities?: readonly string[];
  /** Explicit signals from the caller (trusted server-side). */
  complexity?: 'routine' | 'ambiguous' | 'complex' | 'consequential';
  agentDisabled?: boolean;
}

export interface ModelRouteTierSet {
  fast: readonly string[];
  balanced: readonly string[];
  advanced: readonly string[];
}

export const DEFAULT_MODEL_TIERS: ModelRouteTierSet = {
  fast: ['gpt-4.1-mini', 'claude-haiku'],
  balanced: ['gpt-4.1', 'claude-sonnet'],
  advanced: ['gpt-4.1', 'claude-opus', 'o3'],
};

export function createModelRouteDefinition(options?: {
  version?: string;
  spendLimitUsd?: number;
  securityCritical?: boolean;
}): DecisionDefinition<typeof MODEL_ROUTE_ANSWERS> {
  return defineDecision({
    id: 'support.model-route',
    version: options?.version ?? '1',
    domain: 'support',
    description: 'Pick a model tier for a support request',
    answers: MODEL_ROUTE_ANSWERS,
    criteria: {
      fast: 'Routine factual question with trusted context',
      balanced: 'Several tools or ambiguous customer intent',
      advanced: 'Complex investigation or consequential recommendation',
      abstain: 'Insufficient evidence, agent disabled, or over spend limit',
    },
    timeoutMs: 1500,
    budget: { maxUsd: options?.spendLimitUsd ?? 0.02 },
    strategy: { providers: ['model-route-rules'], onFailure: 'abstain', maxRetries: 0 },
    cache: { enabled: true, ttlMs: 30_000 },
    securityCritical: options?.securityCritical ?? false,
  });
}

export function createModelRouteRulesProvider() {
  return createRulesPlaneProvider<ModelRouteAnswer>({
    name: 'model-route-rules',
    rules: [
      {
        answer: 'abstain',
        when: (ctx) => {
          const c = ctx as ModelRouteContext;
          return !!c.agentDisabled;
        },
        summary: 'Workspace agent is disabled; hand off to human.',
      },
      {
        answer: 'abstain',
        when: (ctx) => {
          const c = ctx as ModelRouteContext;
          if (c.spendLimitUsd === undefined || c.spendUsdSoFar === undefined) return false;
          return c.spendUsdSoFar >= c.spendLimitUsd;
        },
        summary: 'Spend limit reached; escalate or review.',
      },
      {
        answer: 'advanced',
        when: (ctx) => {
          const c = ctx as ModelRouteContext;
          return c.complexity === 'complex' || c.complexity === 'consequential';
        },
        summary: 'Complex or consequential request.',
      },
      {
        answer: 'abstain',
        when: (ctx) => {
          const c = ctx as ModelRouteContext;
          return c.complexity === 'ambiguous';
        },
        summary: 'Ambiguous intent; hand off to human (not a second model call).',
      },
      {
        answer: 'balanced',
        when: (ctx) => {
          const c = ctx as ModelRouteContext;
          return (c.toolCount ?? 0) >= 2;
        },
        summary: 'Multi-tool task.',
      },
      {
        answer: 'fast',
        when: (ctx) => {
          const c = ctx as ModelRouteContext;
          return c.complexity === 'routine' || (!c.complexity && (c.toolCount ?? 0) < 2);
        },
        summary: 'Routine factual question.',
      },
    ],
    onNoMatch: 'abstain',
  });
}

export interface ModelRouteDecision {
  result: PlaneResult<ModelRouteAnswer>;
  allowedModels: readonly string[];
  escalate: boolean;
}

export async function routeModelTier(
  plane: DecisionPlane,
  input: {
    context: ModelRouteContext;
    execution: PlaneExecutionContext;
    definition?: DecisionDefinition<typeof MODEL_ROUTE_ANSWERS>;
    tiers?: ModelRouteTierSet;
  }
): Promise<ModelRouteDecision> {
  const definition = input.definition ?? createModelRouteDefinition();
  const tiers = input.tiers ?? DEFAULT_MODEL_TIERS;
  const result = await plane.decide({
    definition,
    context: input.context,
    execution: input.execution,
  });

  if (result.status === 'succeeded') {
    const answer = result.answer;
    if (answer === 'abstain') {
      return { result, allowedModels: [], escalate: true };
    }
    return {
      result,
      allowedModels: tiers[answer],
      escalate: false,
    };
  }

  return {
    result: result as PlaneResult<ModelRouteAnswer>,
    allowedModels: [],
    escalate: true,
  };
}
