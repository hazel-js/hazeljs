/**
 * Evidence extraction — only from supplied state / trusted projections.
 * Never invents facts.
 */

import type { AgentDnaDecision } from '@hazeljs/agent';
import type { DecisionEvidence } from '../types';
import { getPathValue } from '../utils';

export interface EvidenceStageResult {
  evidence: DecisionEvidence[];
  gaps: string[];
}

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export function extractEvidence(
  state: unknown,
  definition?: AgentDnaDecision
): EvidenceStageResult {
  const evidence: DecisionEvidence[] = [];
  const gaps: string[] = [];
  const projections = definition?.evidence?.projections ?? [];
  const required = definition?.evidence?.required ?? [];

  for (const proj of projections) {
    const raw = getPathValue(state, proj.from);
    if (raw === undefined) {
      gaps.push(proj.key);
      continue;
    }

    let value: unknown = raw;
    const t = proj.transform;
    if (t?.type === 'delta') {
      const against = asNumber(getPathValue(state, t.against));
      const num = asNumber(raw);
      if (num === undefined || against === undefined) {
        gaps.push(proj.key);
        continue;
      }
      value = num - against;
    } else if (t?.type === 'ratio') {
      const against = asNumber(getPathValue(state, t.against));
      const num = asNumber(raw);
      if (num === undefined || against === undefined || against === 0) {
        gaps.push(proj.key);
        continue;
      }
      value = num / against;
    } else if (t?.type === 'boolean') {
      const num = asNumber(raw);
      if (num === undefined) {
        value = Boolean(raw);
      } else {
        let ok = true;
        if (t.gte !== undefined) ok = ok && num >= t.gte;
        if (t.gt !== undefined) ok = ok && num > t.gt;
        if (t.lte !== undefined) ok = ok && num <= t.lte;
        if (t.lt !== undefined) ok = ok && num < t.lt;
        value = ok;
      }
    }

    evidence.push({
      key: proj.key,
      value,
      relevance: proj.relevance ?? 1,
    });
  }

  // If no projections declared, surface top-level primitive fields as low-relevance evidence.
  if (projections.length === 0 && state && typeof state === 'object' && !Array.isArray(state)) {
    for (const [key, value] of Object.entries(state as Record<string, unknown>)) {
      if (value === null || value === undefined) continue;
      if (typeof value === 'object') continue;
      evidence.push({ key, value, relevance: 0.5 });
    }
  }

  for (const req of required) {
    const found = evidence.some((e) => e.key === req) || getPathValue(state, req) !== undefined;
    if (!found) gaps.push(req);
  }

  return { evidence, gaps: [...new Set(gaps)] };
}
