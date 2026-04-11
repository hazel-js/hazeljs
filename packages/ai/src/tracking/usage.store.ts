/**
 * Pluggable persistence for AI usage / cost records (optional install).
 */

export interface AIUsageRecord {
  userId?: string;
  provider: string;
  model?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd?: number;
  createdAt: string;
}

export interface IUsageStore {
  save(record: AIUsageRecord): Promise<void>;
  /** Optional query hook for dashboards / billing. */
  query?(filter: { userId?: string; since?: string }): Promise<AIUsageRecord[]>;
}

/** Default no-op / in-process only (see {@link TokenTracker}). */
export class InMemoryUsageStore implements IUsageStore {
  private readonly records: AIUsageRecord[] = [];

  async save(record: AIUsageRecord): Promise<void> {
    this.records.push(record);
  }

  async query(filter: { userId?: string; since?: string }): Promise<AIUsageRecord[]> {
    return this.records.filter((r) => {
      if (filter.userId && r.userId !== filter.userId) {
        return false;
      }
      if (filter.since && r.createdAt < filter.since) {
        return false;
      }
      return true;
    });
  }
}
