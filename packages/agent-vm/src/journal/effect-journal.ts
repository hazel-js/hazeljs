/**
 * Append-only effect journal — records reversible tool executions for rollback.
 */

import { randomUUID } from 'crypto';
import type { ToolMetadata } from '@hazeljs/agent';
import type { EffectKind } from '../effects/effect-kind';
import { getCompensateMethodName, inferEffectKind } from '../effects/infer';
import type { DeferredIntent, JournalEntry } from './journal-entry.types';
import type { IJournalStore } from './journal-store.interface';
import { InMemoryJournalStore } from './stores/memory-journal.store';

export interface RecordToolEffectOptions {
  runId: string;
  branchId?: string;
  agentId: string;
  sessionId?: string;
  tool: ToolMetadata;
  input: Record<string, unknown>;
  output: unknown;
  effectKind?: EffectKind;
}

export class EffectJournal {
  constructor(private readonly store: IJournalStore = new InMemoryJournalStore()) {}

  getStore(): IJournalStore {
    return this.store;
  }

  async record(options: RecordToolEffectOptions): Promise<JournalEntry | undefined> {
    const effectKind = options.effectKind ?? inferEffectKind(options.tool);
    if (effectKind !== 'reversible') {
      return undefined;
    }

    const entry: JournalEntry = {
      id: randomUUID(),
      runId: options.runId,
      branchId: options.branchId,
      toolName: options.tool.name,
      toolPropertyKey: options.tool.propertyKey,
      agentId: options.agentId,
      sessionId: options.sessionId,
      effectKind,
      input: options.input,
      output: options.output,
      compensateMethod: getCompensateMethodName(options.tool),
      status: 'committed',
      createdAt: new Date(),
    };

    await this.store.append(entry);
    return entry;
  }

  async listRun(runId: string): Promise<JournalEntry[]> {
    const entries = await this.store.listByRun(runId);
    return entries.filter((e) => e.status === 'committed');
  }

  async listBranch(branchId: string): Promise<JournalEntry[]> {
    const entries = await this.store.listByBranch(branchId);
    return entries.filter((e) => e.status === 'committed');
  }

  async markCompensated(entryId: string): Promise<void> {
    await this.store.updateStatus(entryId, 'compensated');
  }

  async markFailed(entryId: string, error: string): Promise<void> {
    await this.store.updateStatus(entryId, 'failed', error);
  }

  async deferIntent(intent: Omit<DeferredIntent, 'id' | 'createdAt'>): Promise<DeferredIntent> {
    const full: DeferredIntent = {
      ...intent,
      id: randomUUID(),
      createdAt: new Date(),
    };
    await this.store.appendDeferred(full);
    return full;
  }

  async drainDeferred(branchId: string): Promise<DeferredIntent[]> {
    const intents = await this.store.listDeferred(branchId);
    await this.store.clearDeferred(branchId);
    return intents;
  }

  async clearBranch(branchId: string): Promise<void> {
    await this.store.clearBranch(branchId);
  }
}
