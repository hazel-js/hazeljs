/**
 * Durable HITL resume checkpoint payload (AOS-006).
 */

import type { AgentContext } from '../types/agent.types';

export interface DurablePendingTool {
  toolName: string;
  toolInput: Record<string, unknown>;
  requestId: string;
}

export interface DurableHitlCheckpoint {
  kind: 'durable_hitl';
  context: AgentContext;
  pendingTool: DurablePendingTool;
  maxSteps: number;
  agentName: string;
  flowRunId?: string;
}

export function isDurableHitlCheckpoint(payload: unknown): payload is DurableHitlCheckpoint {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as DurableHitlCheckpoint;
  return (
    p.kind === 'durable_hitl' &&
    !!p.context &&
    !!p.pendingTool?.toolName &&
    !!p.pendingTool?.requestId
  );
}
