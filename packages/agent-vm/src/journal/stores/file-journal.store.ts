/**
 * File-backed effect journal store (JSON lines per run).
 */

import { mkdir, readFile, writeFile, appendFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { DeferredIntent, JournalEntry } from '../journal-entry.types';
import type { IJournalStore } from '../journal-store.interface';

interface FileJournalSnapshot {
  entries: JournalEntry[];
  deferred: DeferredIntent[];
}

function reviveEntry(raw: JournalEntry): JournalEntry {
  return {
    ...raw,
    createdAt: raw.createdAt instanceof Date ? raw.createdAt : new Date(raw.createdAt),
    compensatedAt: raw.compensatedAt
      ? raw.compensatedAt instanceof Date
        ? raw.compensatedAt
        : new Date(raw.compensatedAt)
      : undefined,
  };
}

function reviveDeferred(raw: DeferredIntent): DeferredIntent {
  return {
    ...raw,
    createdAt: raw.createdAt instanceof Date ? raw.createdAt : new Date(raw.createdAt),
  };
}

export class FileJournalStore implements IJournalStore {
  private cache = new Map<string, FileJournalSnapshot>();

  constructor(private readonly dir: string) {}

  private filePath(runId: string): string {
    return join(this.dir, `${runId}.json`);
  }

  private async load(runId: string): Promise<FileJournalSnapshot> {
    const cached = this.cache.get(runId);
    if (cached) return cached;

    await mkdir(this.dir, { recursive: true });
    const path = this.filePath(runId);
    try {
      const raw = await readFile(path, 'utf8');
      const parsed = JSON.parse(raw) as FileJournalSnapshot;
      const snapshot: FileJournalSnapshot = {
        entries: (parsed.entries ?? []).map(reviveEntry),
        deferred: (parsed.deferred ?? []).map(reviveDeferred),
      };
      this.cache.set(runId, snapshot);
      return snapshot;
    } catch {
      const empty: FileJournalSnapshot = { entries: [], deferred: [] };
      this.cache.set(runId, empty);
      return empty;
    }
  }

  private async persist(runId: string): Promise<void> {
    const snapshot = await this.load(runId);
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.filePath(runId), JSON.stringify(snapshot, null, 2), 'utf8');
  }

  async append(entry: JournalEntry): Promise<void> {
    const snapshot = await this.load(entry.runId);
    snapshot.entries.push(entry);
    await this.persist(entry.runId);
    await appendFile(
      join(this.dir, '_audit.jsonl'),
      `${JSON.stringify({ type: 'append', entryId: entry.id, runId: entry.runId })}\n`
    );
  }

  async listByRun(runId: string): Promise<JournalEntry[]> {
    const snapshot = await this.load(runId);
    return [...snapshot.entries];
  }

  async listByBranch(branchId: string): Promise<JournalEntry[]> {
    const all: JournalEntry[] = [];
    for (const [, snapshot] of this.cache) {
      all.push(...snapshot.entries.filter((e) => e.branchId === branchId));
    }
    return all;
  }

  async updateStatus(
    entryId: string,
    status: JournalEntry['status'],
    error?: string
  ): Promise<void> {
    for (const [runId, snapshot] of this.cache) {
      const entry = snapshot.entries.find((e) => e.id === entryId);
      if (entry) {
        entry.status = status;
        if (status === 'compensated') entry.compensatedAt = new Date();
        if (error) entry.error = error;
        await this.persist(runId);
        return;
      }
    }
  }

  async appendDeferred(intent: DeferredIntent): Promise<void> {
    const snapshot = await this.load(intent.runId);
    snapshot.deferred.push(intent);
    await this.persist(intent.runId);
  }

  async listDeferred(branchId: string): Promise<DeferredIntent[]> {
    const all: DeferredIntent[] = [];
    for (const [, snapshot] of this.cache) {
      all.push(...snapshot.deferred.filter((d) => d.branchId === branchId));
    }
    return all;
  }

  async clearDeferred(branchId: string): Promise<void> {
    for (const [runId, snapshot] of this.cache) {
      snapshot.deferred = snapshot.deferred.filter((d) => d.branchId !== branchId);
      await this.persist(runId);
    }
  }

  async clearBranch(branchId: string): Promise<void> {
    for (const [runId, snapshot] of this.cache) {
      snapshot.entries = snapshot.entries.filter((e) => e.branchId !== branchId);
      snapshot.deferred = snapshot.deferred.filter((d) => d.branchId !== branchId);
      await this.persist(runId);
    }
  }

  /** Create a new run id for file isolation. */
  static newRunId(): string {
    return randomUUID();
  }
}
