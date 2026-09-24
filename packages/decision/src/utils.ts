/**
 * Path helpers and id generation for the decision runtime.
 */

export function createDecisionId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `dec_${Date.now().toString(36)}_${rand}`;
}

export function getPathValue(root: unknown, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split('.');
  let cur: unknown = root;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function clamp01(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function assertFiniteConfidence(value: number, label = 'confidence'): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new Error(`Invalid ${label}: ${String(value)}`);
  }
  if (value < 0 || value > 1) {
    throw new Error(`Invalid ${label} out of range: ${value}`);
  }
  return value;
}

export function resolveRiskLevel(
  risk: import('./types').DecisionRiskInput | undefined,
  fallback: import('./types').DecisionRiskLevel = 'medium'
): import('./types').DecisionRiskObject {
  if (!risk) return { level: fallback };
  if (typeof risk === 'string') return { level: risk };
  return {
    level: risk.level,
    impact: risk.impact,
    reversible: risk.reversible,
  };
}

export function riskRank(level: import('./types').DecisionRiskLevel): number {
  switch (level) {
    case 'low':
      return 1;
    case 'medium':
      return 2;
    case 'high':
      return 3;
    case 'critical':
      return 4;
    default:
      return 2;
  }
}

/** Raise floor only — never lower. */
export function raiseRiskFloor(
  current: import('./types').DecisionRiskLevel,
  floor: import('./types').DecisionRiskLevel
): import('./types').DecisionRiskLevel {
  return riskRank(floor) > riskRank(current) ? floor : current;
}
