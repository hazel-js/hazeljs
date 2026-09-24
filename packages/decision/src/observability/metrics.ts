/**
 * In-process decision metrics + optional OTel spans + audit helpers.
 */

import type { DecisionResult } from '../types';

type CounterMap = Map<string, number>;
type HistogramMap = Map<string, number[]>;

const counters: CounterMap = new Map();
const histograms: HistogramMap = new Map();

export function resetDecisionMetrics(): void {
  counters.clear();
  histograms.clear();
}

export function incMetric(name: string, by = 1): void {
  counters.set(name, (counters.get(name) ?? 0) + by);
}

export function observeMetric(name: string, value: number): void {
  const arr = histograms.get(name) ?? [];
  arr.push(value);
  histograms.set(name, arr);
}

export function getMetricCounter(name: string): number {
  return counters.get(name) ?? 0;
}

export function getMetricSnapshot(): Record<string, number | number[]> {
  const out: Record<string, number | number[]> = {};
  for (const [k, v] of counters) out[k] = v;
  for (const [k, v] of histograms) out[k] = [...v];
  return out;
}

const REDACT_KEYS = /password|token|secret|authorization/i;

export function redactForAudit(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redactForAudit);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.test(k) ? '[REDACTED]' : redactForAudit(v);
  }
  return out;
}

export function buildAuditEvent(result: DecisionResult): Record<string, unknown> {
  return {
    decisionId: result.id,
    name: result.provenance.definitionName,
    agentId: result.provenance.agentId,
    tenantId: result.provenance.tenantId,
    strategy: result.strategy,
    risk: result.risk.level,
    decision: result.decision,
    confidence: result.confidence,
    confidenceType: result.confidenceDetail.type,
    critic: result.critic?.status,
    policy: result.policy.outcome,
    skillgate:
      result.execution?.authorized === true
        ? 'authorized'
        : result.execution?.authorized === false
          ? 'denied'
          : undefined,
    execution: result.execution?.invoked
      ? 'completed'
      : result.execution?.authorized === false
        ? 'not_authorized'
        : result.hitl?.required
          ? 'waiting_for_human'
          : 'none',
    status: result.status,
  };
}

export async function withOptionalSpan<T>(
  name: string,
  attrs: Record<string, string | number | boolean | undefined>,
  fn: () => Promise<T>
): Promise<T> {
  try {
    // Optional peer — do not hard-require OTel.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const otel = require('@opentelemetry/api') as {
      trace?: {
        getTracer: (name: string) => {
          startActiveSpan: (
            n: string,
            cb: (span: {
              setAttribute: (k: string, v: string | number | boolean) => void;
              end: () => void;
              recordException: (e: unknown) => void;
              setStatus: (s: { code: number }) => void;
            }) => Promise<T>
          ) => Promise<T>;
        };
      };
    };
    const tracer = otel.trace?.getTracer('hazeljs');
    if (!tracer?.startActiveSpan) {
      return fn();
    }
    return tracer.startActiveSpan(name, async (span) => {
      for (const [k, v] of Object.entries(attrs)) {
        if (v !== undefined) span.setAttribute(k, v);
      }
      try {
        const result = await fn();
        span.end();
        return result;
      } catch (e) {
        span.recordException(e);
        span.setStatus({ code: 2 });
        span.end();
        throw e;
      }
    });
  } catch {
    return fn();
  }
}

export function recordDecisionMetrics(result: DecisionResult): void {
  incMetric('hazeljs_decisions_total');
  observeMetric('hazeljs_decision_duration', result.latency.totalMs);
  observeMetric('hazeljs_decision_confidence', result.confidence);
  if (result.critic) incMetric('hazeljs_decision_critic_total');
  if (result.hitl?.required) incMetric('hazeljs_decision_review_total');
  if (result.hitl?.status === 'overridden') incMetric('hazeljs_decision_override_total');
  if (result.policy.outcome === 'deny' || result.execution?.authorized === false) {
    incMetric('hazeljs_decision_denied_total');
  }
  if (result.execution?.invoked) incMetric('hazeljs_decision_execution_total');
  if (result.status === 'FAILED') incMetric('hazeljs_decision_failures_total');
}
