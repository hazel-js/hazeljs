/**
 * Structured audit events for Gatekeeper.
 */

import type { GatekeeperDecision, ToolClassification, ToolInvocationContext } from '../types';
import { redactObject } from '../security';

export type GatekeeperAuditEventType =
  | 'gatekeeper.evaluation.started'
  | 'gatekeeper.decision.allowed'
  | 'gatekeeper.decision.denied'
  | 'gatekeeper.decision.approval_required'
  | 'gatekeeper.decision.rewritten'
  | 'gatekeeper.approval.resolved'
  | 'gatekeeper.tool.started'
  | 'gatekeeper.tool.completed'
  | 'gatekeeper.tool.failed';

export interface GatekeeperAuditEvent {
  type: GatekeeperAuditEventType;
  timestamp: string;
  invocationId: string;
  runId: string;
  agentId: string;
  tenantId?: string;
  toolName: string;
  environment: string;
  decision?: GatekeeperDecision['outcome'];
  policyIds?: string[];
  policyVersions?: string[];
  classification?: ToolClassification;
  durationMs?: number;
  denialCode?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditSink {
  emit(event: GatekeeperAuditEvent): Promise<void> | void;
}

export class ConsoleAuditSink implements AuditSink {
  emit(event: GatekeeperAuditEvent): void {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(event));
  }
}

export class InMemoryAuditSink implements AuditSink {
  readonly events: GatekeeperAuditEvent[] = [];

  emit(event: GatekeeperAuditEvent): void {
    this.events.push({ ...event });
  }
}

export class CompositeAuditSink implements AuditSink {
  constructor(private readonly sinks: AuditSink[]) {}

  async emit(event: GatekeeperAuditEvent): Promise<void> {
    for (const sink of this.sinks) {
      await sink.emit(event);
    }
  }
}

export class FailingAuditSink implements AuditSink {
  constructor(private readonly message = 'Audit sink failure') {}

  emit(): never {
    throw new Error(this.message);
  }
}

/**
 * @hazeljs/audit AuditEvent-compatible payload.
 * Duck-typed so Gatekeeper does not hard-depend on the audit package.
 */
export interface HazelAuditEvent {
  action: string;
  actor?: { id: string | number; username?: string; role?: string; [key: string]: unknown };
  resource?: string;
  resourceId?: string | number;
  result?: 'success' | 'failure' | 'denied';
  timestamp: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface HazelAuditTransport {
  log(event: HazelAuditEvent): void | Promise<void>;
}

export function toHazelAuditEvent(event: GatekeeperAuditEvent): HazelAuditEvent {
  const result: HazelAuditEvent['result'] =
    event.type === 'gatekeeper.decision.denied' || event.type === 'gatekeeper.tool.failed'
      ? 'denied'
      : event.type === 'gatekeeper.decision.approval_required'
        ? 'failure'
        : 'success';
  return {
    action: event.type,
    actor: {
      id: event.agentId,
      role: 'agent',
      tenantId: event.tenantId,
    },
    resource: event.toolName,
    resourceId: event.invocationId,
    result,
    timestamp: event.timestamp,
    requestId: event.runId,
    metadata: {
      invocationId: event.invocationId,
      environment: event.environment,
      decision: event.decision,
      policyIds: event.policyIds,
      policyVersions: event.policyVersions,
      classification: event.classification,
      durationMs: event.durationMs,
      denialCode: event.denialCode,
      reason: event.reason,
      ...(event.metadata ?? {}),
    },
  };
}

/**
 * Production audit sink: await a shared @hazeljs/audit transport (Kafka, file, custom).
 * Failures propagate so enforce mode can fail closed.
 *
 * @example
 * createAuditTransportSink(new KafkaAuditTransport({
 *   sender: kafkaProducer,
 *   topic: 'hazel.gatekeeper.audit',
 *   key: (e) => String(e.resourceId ?? e.actor?.id ?? ''),
 * }))
 */
export function createAuditTransportSink(transport: HazelAuditTransport): AuditSink {
  return {
    async emit(event: GatekeeperAuditEvent): Promise<void> {
      await transport.log(toHazelAuditEvent(event));
    },
  };
}

export interface OtelSpanLike {
  setAttribute(key: string, value: string | number | boolean): void;
  addEvent?(name: string, attributes?: Record<string, unknown>): void;
  end(): void;
}

export interface OtelTracerLike {
  startSpan(name: string, options?: unknown): OtelSpanLike;
}

export interface OtelApiLike {
  trace: { getTracer(name: string, version?: string): OtelTracerLike };
}

/**
 * Production audit sink: emit an OpenTelemetry span per Gatekeeper event.
 * Pass `trace` from `@opentelemetry/api`. Spans are exported by the collector —
 * shared across replicas, not stored in process memory.
 */
export function createOtelAuditSink(
  otel: OtelApiLike,
  tracerName = 'hazeljs.agent-gatekeeper'
): AuditSink {
  const tracer = otel.trace.getTracer(tracerName);
  return {
    emit(event: GatekeeperAuditEvent): void {
      const span = tracer.startSpan(event.type);
      span.setAttribute('gatekeeper.invocation_id', event.invocationId);
      span.setAttribute('gatekeeper.run_id', event.runId);
      span.setAttribute('gatekeeper.agent_id', event.agentId);
      span.setAttribute('gatekeeper.tool', event.toolName);
      span.setAttribute('gatekeeper.environment', event.environment);
      if (event.tenantId) span.setAttribute('gatekeeper.tenant_id', event.tenantId);
      if (event.decision) span.setAttribute('gatekeeper.decision', event.decision);
      if (event.denialCode) span.setAttribute('gatekeeper.denial_code', event.denialCode);
      if (event.durationMs !== undefined)
        span.setAttribute('gatekeeper.duration_ms', event.durationMs);
      span.addEvent?.(event.type, {
        policyIds: event.policyIds?.join(','),
        reason: event.reason,
      });
      span.end();
    },
  };
}

export function sanitizeContextForAudit<TInput>(
  context: ToolInvocationContext<TInput>,
  redactFields: string[] = []
): Record<string, unknown> {
  return {
    invocationId: context.invocationId,
    runId: context.runId,
    agentId: context.agentId,
    agentVersion: context.agentVersion,
    tenantId: context.tenantId,
    delegatedUserId: context.delegatedUserId,
    sessionId: context.sessionId,
    toolName: context.toolName,
    environment: context.environment,
    purpose: context.purpose,
    input: redactObject(context.input as Record<string, unknown>, redactFields),
  };
}

export function decisionEventType(decision: GatekeeperDecision): GatekeeperAuditEventType {
  switch (decision.outcome) {
    case 'allow':
      return 'gatekeeper.decision.allowed';
    case 'deny':
      return 'gatekeeper.decision.denied';
    case 'require_approval':
      return 'gatekeeper.decision.approval_required';
    case 'rewrite':
      return 'gatekeeper.decision.rewritten';
    default:
      return 'gatekeeper.decision.denied';
  }
}

export class GatekeeperMetrics {
  private readonly decisionCounts = new Map<string, number>();
  private evaluationLatencyMs: number[] = [];
  private toolLatencyMs: number[] = [];

  recordDecision(outcome: string, code?: string): void {
    const key = code ? `${outcome}:${code}` : outcome;
    this.decisionCounts.set(key, (this.decisionCounts.get(key) ?? 0) + 1);
  }

  recordEvaluationLatency(ms: number): void {
    this.evaluationLatencyMs.push(ms);
  }

  recordToolLatency(ms: number): void {
    this.toolLatencyMs.push(ms);
  }

  snapshot(): {
    decisionCounts: Record<string, number>;
    avgEvaluationLatencyMs: number;
    avgToolLatencyMs: number;
  } {
    const avg = (arr: number[]): number =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    return {
      decisionCounts: Object.fromEntries(this.decisionCounts),
      avgEvaluationLatencyMs: avg(this.evaluationLatencyMs),
      avgToolLatencyMs: avg(this.toolLatencyMs),
    };
  }

  reset(): void {
    this.decisionCounts.clear();
    this.evaluationLatencyMs = [];
    this.toolLatencyMs = [];
  }
}
