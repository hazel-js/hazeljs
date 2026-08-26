/**
 * Tool effect gate interface — implemented by @hazeljs/agent-vm EffectGate.
 * Hooks into ToolExecutor for effect lattice enforcement and journaling.
 */

import type { ToolMetadata } from '../types/tool.types';

export interface ToolEffectContext {
  executionId: string;
  runId?: string;
  branchId?: string;
  agentId: string;
  sessionId?: string;
  userId?: string;
  tool: ToolMetadata;
  input: Record<string, unknown>;
}

export interface ToolEffectDecision {
  allow: boolean;
  effectKind?: string;
  reason?: string;
  /** Store-buffer mode — tool execution deferred until branch commit. */
  deferred?: boolean;
  predictedOutput?: unknown;
  /** Irreversible barrier — branch must converge. */
  barrier?: boolean;
  /** Abort speculation and fall back to linear execution. */
  abortSpeculation?: boolean;
}

export interface IToolEffectGate {
  beforeToolExecute(ctx: ToolEffectContext): Promise<ToolEffectDecision>;
  afterToolExecute(ctx: ToolEffectContext & { output: unknown; deferred?: boolean }): Promise<void>;
}
