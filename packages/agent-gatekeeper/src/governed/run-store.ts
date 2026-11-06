/**
 * Shared run control records. Any replica can request cancel / attach approval.
 * Outcome stays unknown until the leased owner acknowledges.
 */

import type { CancelState, GovernedRunRecord, GovernedRunStatus } from './types';

export interface GovernedRunStore {
  create(record: Omit<GovernedRunRecord, 'createdAt' | 'updatedAt'>): Promise<GovernedRunRecord>;
  get(runId: string): Promise<GovernedRunRecord | undefined>;
  update(
    runId: string,
    patch: Partial<
      Pick<GovernedRunRecord, 'status' | 'cancelState' | 'providerSessionId' | 'lastError'>
    >
  ): Promise<GovernedRunRecord | undefined>;
}

export class MemoryGovernedRunStore implements GovernedRunStore {
  private readonly map = new Map<string, GovernedRunRecord>();

  async create(
    record: Omit<GovernedRunRecord, 'createdAt' | 'updatedAt'>
  ): Promise<GovernedRunRecord> {
    const now = new Date();
    const full: GovernedRunRecord = { ...record, createdAt: now, updatedAt: now };
    this.map.set(record.runId, full);
    return { ...full };
  }

  async get(runId: string): Promise<GovernedRunRecord | undefined> {
    const r = this.map.get(runId);
    return r ? { ...r } : undefined;
  }

  async update(
    runId: string,
    patch: Partial<
      Pick<GovernedRunRecord, 'status' | 'cancelState' | 'providerSessionId' | 'lastError'>
    >
  ): Promise<GovernedRunRecord | undefined> {
    const existing = this.map.get(runId);
    if (!existing) return undefined;
    const next: GovernedRunRecord = { ...existing, ...patch, updatedAt: new Date() };
    this.map.set(runId, next);
    return { ...next };
  }
}

export function requestCancel(record: GovernedRunRecord): {
  status: GovernedRunStatus;
  cancelState: CancelState;
} {
  if (record.cancelState === 'acknowledged' || record.status === 'cancelled') {
    return { status: 'cancelled', cancelState: 'acknowledged' };
  }
  return { status: 'cancel_requested', cancelState: 'requested' };
}

export function acknowledgeCancel(): {
  status: GovernedRunStatus;
  cancelState: CancelState;
} {
  return { status: 'cancelled', cancelState: 'acknowledged' };
}

/** Dropped stream / owner death — never invent cancelled. */
export function markUnknown(reason: string): {
  status: GovernedRunStatus;
  lastError: string;
} {
  return { status: 'unknown', lastError: reason };
}
