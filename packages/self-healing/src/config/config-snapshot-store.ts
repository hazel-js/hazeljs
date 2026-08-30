import { ConfigSnapshot, ConfigSnapshotStoreLike } from '../types';

/**
 * In-memory config snapshot store for auto-rollback.
 */
export class ConfigSnapshotStore implements ConfigSnapshotStoreLike {
  private snapshots: ConfigSnapshot[] = [];
  private counter = 0;

  snapshot(label: string, data: Record<string, unknown>): ConfigSnapshot {
    const entry: ConfigSnapshot = {
      id: `cfg-${++this.counter}`,
      label,
      data: structuredClone(data),
      createdAt: Date.now(),
    };
    this.snapshots.push(entry);
    return entry;
  }

  rollback(snapshotId?: string): ConfigSnapshot | null {
    if (this.snapshots.length === 0) {
      return null;
    }

    if (snapshotId) {
      const index = this.snapshots.findIndex((snapshot) => snapshot.id === snapshotId);
      if (index === -1) {
        return null;
      }
      const rolledBack = this.snapshots[index];
      this.snapshots = this.snapshots.slice(0, index + 1);
      return rolledBack;
    }

    return this.snapshots.pop() ?? null;
  }

  getLatest(): ConfigSnapshot | null {
    return this.snapshots[this.snapshots.length - 1] ?? null;
  }

  list(): ConfigSnapshot[] {
    return [...this.snapshots];
  }

  clear(): void {
    this.snapshots = [];
  }
}
