/**
 * Deterministic decision policy evaluator.
 * Models never decide whether security policy applies.
 */

import type {
  DecisionPolicyAction,
  DecisionPolicyConfig,
  DecisionPolicyRule,
  DecisionRiskLevel,
} from '../types';

export interface PolicyEvalInput {
  risk: DecisionRiskLevel;
  confidence: number;
  policy?: DecisionPolicyConfig | DecisionPolicyRule[];
  /** Hybrid rule overrides (e.g. amount > 5000 → review). */
  forceAction?: DecisionPolicyAction;
  forceReason?: string;
}

export interface PolicyEvalResult {
  outcome: DecisionPolicyAction;
  reason?: string;
}

function normalizeConfig(
  policy?: DecisionPolicyConfig | DecisionPolicyRule[]
): DecisionPolicyConfig {
  if (!policy) return {};
  if (Array.isArray(policy)) return { rules: policy };
  return policy;
}

function matchesConfidence(
  value: number,
  when?: { gte?: number; lt?: number; lte?: number; gt?: number }
): boolean {
  if (!when) return true;
  if (when.gte !== undefined && !(value >= when.gte)) return false;
  if (when.gt !== undefined && !(value > when.gt)) return false;
  if (when.lt !== undefined && !(value < when.lt)) return false;
  if (when.lte !== undefined && !(value <= when.lte)) return false;
  return true;
}

function defaultBands(confidence: number, high = 0.95, medium = 0.7): PolicyEvalResult {
  if (confidence >= high) {
    return { outcome: 'allow', reason: `confidence >= ${high}` };
  }
  if (confidence >= medium) {
    return { outcome: 'critique', reason: `${medium} <= confidence < ${high}` };
  }
  return { outcome: 'review', reason: `confidence < ${medium}` };
}

export function evaluateDecisionPolicy(input: PolicyEvalInput): PolicyEvalResult {
  if (input.forceAction) {
    return { outcome: input.forceAction, reason: input.forceReason ?? 'hybrid rule override' };
  }

  const config = normalizeConfig(input.policy);
  const high = config.confidence?.high ?? 0.95;
  const medium = config.confidence?.medium ?? 0.7;
  const rules = config.rules ?? [];

  for (const rule of rules) {
    const riskOk = !rule.when?.risk || rule.when.risk === input.risk;
    const confOk = matchesConfidence(input.confidence, rule.when?.confidence);
    if (riskOk && confOk) {
      return {
        outcome: rule.action,
        reason: `matched policy rule → ${rule.action}`,
      };
    }
  }

  return defaultBands(input.confidence, high, medium);
}
