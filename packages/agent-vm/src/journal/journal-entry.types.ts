/**
 * Effect journal entry types.
 */

import type { EffectKind } from '../effects/effect-kind';

export type JournalEntryStatus = 'committed' | 'compensated' | 'failed' | 'deferred';

export interface JournalEntry {
  id: string;
  runId: string;
  branchId?: string;
  toolName: string;
  toolPropertyKey: string;
  agentId: string;
  sessionId?: string;
  effectKind: EffectKind;
  input: Record<string, unknown>;
  output: unknown;
  compensateMethod?: string;
  status: JournalEntryStatus;
  createdAt: Date;
  compensatedAt?: Date;
  error?: string;
}

export interface DeferredIntent {
  id: string;
  branchId: string;
  runId: string;
  toolName: string;
  toolPropertyKey: string;
  agentId: string;
  input: Record<string, unknown>;
  predictedOutput?: unknown;
  createdAt: Date;
}
