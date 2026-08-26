/**
 * In-memory effect journal store.
 */

import type { DeferredIntent, JournalEntry } from '../journal-entry.types';
import type { IJournalStore } from '../journal-store.interface';

export class InMemoryJournalStore implements IJournalStore {
  private entries: JournalEntry[] = [];
  private deferred: DeferredIntent[] = [];

  append(entry: JournalEntry): void {
    this.entries.push(entry);
  }

  listByRun(runId: string): JournalEntry[] {
    return this.entries.filter((e) => e.runId === runId);
  }

  listByBranch(branchId: string): JournalEntry[] {
    return this.entries.filter((e) => e.branchId === branchId);
  }

  updateStatus(entryId: string, status: JournalEntry['status'], error?: string): void {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry) return;
    entry.status = status;
    if (status === 'compensated') {
      entry.compensatedAt = new Date();
    }
    if (error) {
      entry.error = error;
    }
  }

  appendDeferred(intent: DeferredIntent): void {
    this.deferred.push(intent);
  }

  listDeferred(branchId: string): DeferredIntent[] {
    return this.deferred.filter((d) => d.branchId === branchId);
  }

  clearDeferred(branchId: string): void {
    this.deferred = this.deferred.filter((d) => d.branchId !== branchId);
  }

  clearBranch(branchId: string): void {
    this.entries = this.entries.filter((e) => e.branchId !== branchId);
    this.clearDeferred(branchId);
  }
}
