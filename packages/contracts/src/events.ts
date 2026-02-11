/**
 * @hazeljs/contracts - HazelEvent union for standardized cross-module events
 */

import type { DecisionStatus } from './classification';

/** Metric event for counters and gauges */
export interface MetricEvent {
  type: 'metric';
  name: string;
  value: number;
  tags?: Record<string, string | number | boolean>;
}

/** Span event for tracing and performance */
export interface SpanEvent {
  type: 'span';
  name: string;
  durationMs: number;
  status: 'ok' | 'error';
  tags?: Record<string, string | number | boolean>;
}

/** Audit event for compliance logging */
export interface AuditEvent {
  type: 'audit';
  name: string;
  payload: Record<string, unknown>;
}

/** Data access event for tracking data reads */
export interface DataAccessEvent {
  type: 'dataAccess';
  dataset: string;
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'PII';
  ids?: string[];
  fieldsHash?: string;
}

/** AI/LLM call event for model usage tracking */
export interface AiCallEvent {
  type: 'aiCall';
  model: string;
  promptHash: string;
  sources?: string[];
  outputHash: string;
  tokens?: { prompt?: number; completion?: number };
}

/** Decision event for risk/compliance outcomes */
export interface DecisionEvent {
  type: 'decision';
  name: string;
  status: DecisionStatus;
  score?: number;
  reasons: string[];
  evidenceId?: string;
}

/** Union of all Hazel event types */
export type HazelEvent =
  | MetricEvent
  | SpanEvent
  | AuditEvent
  | DataAccessEvent
  | AiCallEvent
  | DecisionEvent;
