/**
 * Pluggable journal store interface.
 */

import type { DeferredIntent, JournalEntry } from './journal-entry.types';

export interface IJournalStore {
  append(entry: JournalEntry): Promise<void> | void;
  listByRun(runId: string): Promise<JournalEntry[]> | JournalEntry[];
  listByBranch(branchId: string): Promise<JournalEntry[]> | JournalEntry[];
  updateStatus(
    entryId: string,
    status: JournalEntry['status'],
    error?: string
  ): Promise<void> | void;
  appendDeferred(intent: DeferredIntent): Promise<void> | void;
  listDeferred(branchId: string): Promise<DeferredIntent[]> | DeferredIntent[];
  clearDeferred(branchId: string): Promise<void> | void;
  clearBranch(branchId: string): Promise<void> | void;
}
