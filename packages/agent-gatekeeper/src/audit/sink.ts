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
