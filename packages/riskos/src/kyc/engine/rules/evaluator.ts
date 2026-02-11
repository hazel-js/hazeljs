/**
 * Decision ruleset evaluator
 */

import type { DecisionRuleset } from './ruleset';

export interface EvaluatorResult {
  status: string;
  reasons: string[];
}

/** Evaluate ruleset against session state */
export function evaluateRuleset(
  ruleset: DecisionRuleset,
  state: Record<string, unknown>,
): EvaluatorResult {
  const reasons: string[] = [];
  for (const rule of ruleset.rules) {
    const cond = rule.when;
    let match = true;
    if (cond) {
      const val = getPath(state, cond.path);
      if (cond.eq !== undefined && val !== cond.eq) match = false;
      if (cond.ne !== undefined && val === cond.ne) match = false;
      if (cond.gt !== undefined && Number(val) <= cond.gt) match = false;
      if (cond.gte !== undefined && Number(val) < cond.gte) match = false;
      if (cond.lt !== undefined && Number(val) >= cond.lt) match = false;
      if (cond.lte !== undefined && Number(val) > cond.lte) match = false;
      if (cond.exists !== undefined) {
        const exists = val !== undefined && val !== null;
        if (cond.exists !== exists) match = false;
      }
      if (cond.contains !== undefined && typeof val === 'string') {
        if (!val.includes(cond.contains)) match = false;
      }
    }
    if (match) {
      reasons.push(rule.reason ?? 'matched');
      if (rule.status) return { status: rule.status, reasons };
    }
  }
  return {
    status: ruleset.defaultStatus ?? 'PENDING',
    reasons: reasons.length ? reasons : ['no rules matched'],
  };
}

function getPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let v: unknown = obj;
  for (const p of parts) {
    if (v == null) return undefined;
    v = (v as Record<string, unknown>)[p];
  }
  return v;
}
