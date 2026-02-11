/**
 * Risk rules engine - DSL for hard blocks, scoring, thresholds
 */

import type { RiskLevel } from '@hazeljs/contracts';
import type { RiskSignal } from './featureTypes';

export interface ConditionExpr {
  path: string;
  eq?: unknown;
  ne?: unknown;
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
  exists?: boolean;
  contains?: string;
}

export interface HardBlock {
  when: ConditionExpr;
  reason: string;
}

export interface ScoreRule {
  when?: ConditionExpr;
  add: number;
  reason?: string;
}

export interface RiskRuleset {
  hardBlocks: HardBlock[];
  score: {
    start: number;
    rules: ScoreRule[];
  };
  thresholds: {
    approveMax: number;
    reviewMax: number;
  };
}

export interface ScoringOutput {
  score: number;
  level: RiskLevel;
  reasons: string[];
  blocked: boolean;
  blockReason?: string;
}

function getPath(obj: unknown, path: string): unknown {
  let v: unknown = obj;
  for (const p of path.split(/\.|\[|\]/).filter(Boolean)) {
    if (v == null) return undefined;
    v = (v as Record<string, unknown>)[p];
  }
  return v;
}

function evalCondition(obj: unknown, c: ConditionExpr): boolean {
  const val = getPath(obj, c.path);
  if (c.eq !== undefined && val !== c.eq) return false;
  if (c.ne !== undefined && val === c.ne) return false;
  if (c.gt !== undefined && Number(val) <= c.gt) return false;
  if (c.gte !== undefined && Number(val) < c.gte) return false;
  if (c.lt !== undefined && Number(val) >= c.lt) return false;
  if (c.lte !== undefined && Number(val) > c.lte) return false;
  if (c.exists !== undefined) {
    const exists = val !== undefined && val !== null;
    if (exists !== c.exists) return false;
  }
  if (c.contains !== undefined && typeof val === 'string') {
    if (!val.includes(c.contains)) return false;
  }
  return true;
}

/** Evaluate risk ruleset against state */
export function evaluateRiskRuleset(
  ruleset: RiskRuleset,
  state: Record<string, unknown>,
): ScoringOutput {
  const reasons: string[] = [];

  for (const block of ruleset.hardBlocks) {
    if (evalCondition(state, block.when)) {
      return {
        score: 100,
        level: 'HIGH' as RiskLevel,
        reasons: [block.reason],
        blocked: true,
        blockReason: block.reason,
      };
    }
  }

  let score = ruleset.score.start;
  for (const rule of ruleset.score.rules) {
    if (!rule.when || evalCondition(state, rule.when)) {
      score += rule.add;
      if (rule.reason) reasons.push(rule.reason);
    }
  }

  const { approveMax, reviewMax } = ruleset.thresholds;
  let level: RiskLevel = 'LOW' as RiskLevel;
  if (score > reviewMax) level = 'HIGH' as RiskLevel;
  else if (score > approveMax) level = 'MEDIUM' as RiskLevel;

  return {
    score,
    level,
    reasons,
    blocked: false,
  };
}
