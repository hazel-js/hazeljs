/**
 * Core flow definition types
 */

export type NodeId = string;

export interface FlowContext {
  runId: string;
  flowId: string;
  flowVersion: string;
  tenantId?: string;
  input: unknown;
  state: Record<string, unknown>;
  outputs: Record<string, unknown>;
  meta: {
    attempts: Record<string, number>;
    startedAt: string;
  };
  services?: Record<string, unknown>;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoff: 'fixed' | 'exponential';
  baseDelayMs: number;
  maxDelayMs?: number;
}

export interface NodeDefinition {
  id: NodeId;
  name?: string;
  handler: (ctx: FlowContext) => Promise<NodeResult>;
  retry?: RetryPolicy;
  timeoutMs?: number;
  idempotencyKey?: (ctx: FlowContext) => string;
}

export interface EdgeDefinition {
  from: NodeId;
  to: NodeId;
  when?: (ctx: FlowContext) => boolean;
  priority?: number;
}

export interface FlowDefinition {
  flowId: string;
  version: string;
  entry: NodeId;
  nodes: Record<NodeId, NodeDefinition>;
  edges: EdgeDefinition[];
}

export type NodeResult =
  | { status: 'ok'; patch?: Record<string, unknown>; output?: unknown }
  | {
      status: 'error';
      error: { code: string; message: string; retryable?: boolean };
    }
  | {
      status: 'wait';
      reason?: string;
      until?: string;
      patch?: Record<string, unknown>;
      output?: unknown;
    };
