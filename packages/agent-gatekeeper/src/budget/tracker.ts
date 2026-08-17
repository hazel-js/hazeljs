/**
 * Concurrent-safe budget / rate limit tracker for Gatekeeper policies.
 */

export interface BudgetKey {
  scope: string;
  policyId: string;
  runId?: string;
  tenantId?: string;
}

interface WindowEntry {
  count: number;
  costUnits: number;
  windowStartMs: number;
}

export class BudgetTracker {
  private readonly windows = new Map<string, WindowEntry>();
  private readonly runInvocations = new Map<string, number>();
  private readonly locks = new Map<string, Promise<void>>();

  private keyString(key: BudgetKey): string {
    return `${key.scope}:${key.policyId}:${key.runId ?? ''}:${key.tenantId ?? ''}`;
  }

  private async withLock<T>(lockKey: string, fn: () => T | Promise<T>): Promise<T> {
    const prev = this.locks.get(lockKey) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(
      lockKey,
      prev.then(() => next)
    );
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.locks.get(lockKey) === next) {
        this.locks.delete(lockKey);
      }
    }
  }

  async checkRateLimit(
    key: BudgetKey,
    max: number,
    windowMs: number,
    nowMs: number
  ): Promise<{ allowed: boolean; current: number }> {
    const lockKey = this.keyString(key);
    return this.withLock(lockKey, () => {
      const entry = this.windows.get(lockKey);
      if (!entry || nowMs - entry.windowStartMs >= windowMs) {
        this.windows.set(lockKey, { count: 1, costUnits: 0, windowStartMs: nowMs });
        return { allowed: true, current: 1 };
      }
      entry.count += 1;
      return { allowed: entry.count <= max, current: entry.count };
    });
  }

  async checkCostBudget(
    key: BudgetKey,
    units: number,
    maxUnits: number,
    windowMs: number,
    nowMs: number
  ): Promise<{ allowed: boolean; current: number }> {
    const lockKey = `${this.keyString(key)}:cost`;
    return this.withLock(lockKey, () => {
      const entry = this.windows.get(lockKey);
      if (!entry || nowMs - entry.windowStartMs >= windowMs) {
        this.windows.set(lockKey, { count: 0, costUnits: units, windowStartMs: nowMs });
        return { allowed: units <= maxUnits, current: units };
      }
      entry.costUnits += units;
      return { allowed: entry.costUnits <= maxUnits, current: entry.costUnits };
    });
  }

  async checkInvocationBudget(
    runId: string,
    policyId: string,
    max: number
  ): Promise<{ allowed: boolean; current: number }> {
    const lockKey = `run:${runId}:${policyId}`;
    return this.withLock(lockKey, () => {
      const current = (this.runInvocations.get(lockKey) ?? 0) + 1;
      this.runInvocations.set(lockKey, current);
      return { allowed: current <= max, current };
    });
  }

  reset(): void {
    this.windows.clear();
    this.runInvocations.clear();
    this.locks.clear();
  }
}
