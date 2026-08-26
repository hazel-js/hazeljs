/**
 * Quarantine store for failed compensations — operator resolution queue.
 */

import { randomUUID } from 'crypto';
import type { JournalEntry } from '../journal/journal-entry.types';

export interface QuarantinedCompensation {
  id: string;
  entry: JournalEntry;
  error: string;
  attempts: number;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface IQuarantineStore {
  add(entry: JournalEntry, error: string, attempts: number): Promise<string> | string;
  list(): Promise<QuarantinedCompensation[]> | QuarantinedCompensation[];
  resolve(id: string): Promise<void> | void;
}

export class InMemoryQuarantineStore implements IQuarantineStore {
  private items = new Map<string, QuarantinedCompensation>();

  add(entry: JournalEntry, error: string, attempts: number): string {
    const id = randomUUID();
    this.items.set(id, {
      id,
      entry,
      error,
      attempts,
      createdAt: new Date(),
    });
    return id;
  }

  list(): QuarantinedCompensation[] {
    return Array.from(this.items.values()).filter((q) => !q.resolvedAt);
  }

  resolve(id: string): void {
    const item = this.items.get(id);
    if (item) {
      item.resolvedAt = new Date();
    }
  }
}
