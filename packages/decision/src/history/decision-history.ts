/**
 * Decision History — explicit append-only store for evaluation / trends.
 * Never automatically fed back into model prompts (avoids feedback loops).
 */

import type { DecisionResult, DecisionEvaluationRecord } from '../types';

export interface DecisionHistoryRecord {
  decisionId: string;
  name?: string;
  decision: string;
  confidence: number;
  confidenceType?: string;
  risk?: string;
  strategy?: string;
  provider?: string;
  policy?: string;
  tenantId?: string;
  agentId?: string;
  recordedAt: string;
  evaluation?: DecisionEvaluationRecord;
  /** Redacted / summarized evidence keys only — never raw secrets. */
  evidenceKeys?: string[];
}

export interface DecisionHistoryQuery {
  name?: string;
  tenantId?: string;
  decision?: string;
  since?: string;
  limit?: number;
}

export class DecisionHistory {
  private readonly records: DecisionHistoryRecord[] = [];
  private readonly maxRecords: number;

  constructor(options?: { maxRecords?: number }) {
    this.maxRecords = options?.maxRecords ?? 10_000;
  }

  append(result: DecisionResult): DecisionHistoryRecord {
    const rec: DecisionHistoryRecord = {
      decisionId: result.id,
      name: result.provenance.definitionName,
      decision: String(result.decision),
      confidence: result.confidence,
      confidenceType: result.confidenceDetail.type,
      risk: result.risk.level,
      strategy: result.strategy,
      provider: result.provider,
      policy: result.policy.outcome,
      tenantId: result.provenance.tenantId,
      agentId: result.provenance.agentId,
      recordedAt: new Date().toISOString(),
      evidenceKeys: result.evidence?.map((e) => e.key),
    };
    this.records.push(rec);
    while (this.records.length > this.maxRecords) {
      this.records.shift();
    }
    return rec;
  }

  attachEvaluation(decisionId: string, evaluation: DecisionEvaluationRecord): void {
    const rec = [...this.records].reverse().find((r) => r.decisionId === decisionId);
    if (rec) rec.evaluation = evaluation;
  }

  query(q: DecisionHistoryQuery = {}): DecisionHistoryRecord[] {
    let out = this.records;
    if (q.name) out = out.filter((r) => r.name === q.name);
    if (q.tenantId) out = out.filter((r) => r.tenantId === q.tenantId);
    if (q.decision) out = out.filter((r) => r.decision === q.decision);
    if (q.since) {
      const since = Date.parse(q.since);
      out = out.filter((r) => Date.parse(r.recordedAt) >= since);
    }
    const limit = q.limit ?? 100;
    return out.slice(-limit);
  }

  /**
   * Similar incidents by shared evidence keys — for retrieval / analysis only.
   * Does not inject into prompts.
   */
  similarByEvidence(evidenceKeys: string[], limit = 10): DecisionHistoryRecord[] {
    const set = new Set(evidenceKeys);
    return [...this.records]
      .map((r) => ({
        r,
        overlap: (r.evidenceKeys ?? []).filter((k) => set.has(k)).length,
      }))
      .filter((x) => x.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, limit)
      .map((x) => x.r);
  }

  /**
   * Aggregate trends for control-plane / CLI — never used as model feedback.
   */
  trends(q: DecisionHistoryQuery = {}): DecisionHistoryTrends {
    const rows = this.query({ ...q, limit: q.limit ?? this.records.length });
    const byDecision: Record<string, number> = {};
    const byPolicy: Record<string, number> = {};
    const byProvider: Record<string, number> = {};
    let confidenceSum = 0;
    let evaluated = 0;
    let correct = 0;

    for (const r of rows) {
      byDecision[r.decision] = (byDecision[r.decision] ?? 0) + 1;
      if (r.policy) byPolicy[r.policy] = (byPolicy[r.policy] ?? 0) + 1;
      if (r.provider) byProvider[r.provider] = (byProvider[r.provider] ?? 0) + 1;
      confidenceSum += r.confidence;
      if (r.evaluation) {
        evaluated += 1;
        if (
          r.evaluation.expectedDecision !== undefined &&
          String(r.decision) === String(r.evaluation.expectedDecision)
        ) {
          correct += 1;
        } else if (r.evaluation.actualOutcome === true) {
          correct += 1;
        }
      }
    }

    return {
      total: rows.length,
      byDecision,
      byPolicy,
      byProvider,
      avgConfidence: rows.length ? confidenceSum / rows.length : 0,
      evaluatedCount: evaluated,
      correctCount: correct,
      accuracy: evaluated > 0 ? correct / evaluated : undefined,
      promptInjectionForbidden: true,
    };
  }

  clear(): void {
    this.records.length = 0;
  }

  size(): number {
    return this.records.length;
  }
}

export interface DecisionHistoryTrends {
  total: number;
  byDecision: Record<string, number>;
  byPolicy: Record<string, number>;
  byProvider: Record<string, number>;
  avgConfidence: number;
  evaluatedCount: number;
  correctCount: number;
  accuracy?: number;
  /** Safety marker — trends are for humans / Lab, not prompts. */
  promptInjectionForbidden: true;
}
