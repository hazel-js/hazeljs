import { randomUUID } from 'crypto';
import type { AutonomousObservation } from '@hazeljs/core';

export interface BuildObservationInput<T = unknown> {
  eventType: string;
  payload: T;
  source?: string;
  subject?: string;
  correlationId?: string;
  causationId?: string;
  /** Trusted tenant from framework context — never from model output. */
  tenantId?: string;
  schemaVersion?: number;
  depth?: number;
  eventId?: string;
  timestamp?: string;
}

/**
 * Build a canonical observation envelope.
 * Sensitive fields should be redacted before audit persistence.
 */
export function buildObservation<T = unknown>(
  input: BuildObservationInput<T>
): AutonomousObservation<T> {
  return {
    eventId: input.eventId ?? randomUUID(),
    eventType: input.eventType,
    source: input.source ?? 'application',
    subject: input.subject,
    timestamp: input.timestamp ?? new Date().toISOString(),
    correlationId: input.correlationId,
    causationId: input.causationId,
    tenantId: input.tenantId,
    schemaVersion: input.schemaVersion ?? 1,
    payload: input.payload,
    depth: input.depth ?? 0,
  };
}

const SENSITIVE_KEYS = /password|secret|token|authorization|api[_-]?key|ssn|card/i;

export function redactPayload(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.length > 512 ? `${value.slice(0, 512)}…` : value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redactPayload(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEYS.test(k) ? '[REDACTED]' : redactPayload(v, depth + 1);
  }
  return out;
}
