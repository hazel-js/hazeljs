import { ConfigSnapshotStore } from '../config/config-snapshot-store';

describe('ConfigSnapshotStore', () => {
  it('snapshots and rolls back config', () => {
    const store = new ConfigSnapshotStore();
    const first = store.snapshot('initial', { timeout: 1000 });
    const second = store.snapshot('updated', { timeout: 5000 });

    const rolledBack = store.rollback();

    expect(rolledBack?.id).toBe(second.id);
    expect(rolledBack?.data).toEqual({ timeout: 5000 });
    expect(store.getLatest()?.id).toBe(first.id);
  });

  it('rolls back to specific snapshot id', () => {
    const store = new ConfigSnapshotStore();
    const first = store.snapshot('first', { mode: 'safe' });
    store.snapshot('second', { mode: 'fast' });

    const rolledBack = store.rollback(first.id);

    expect(rolledBack?.data).toEqual({ mode: 'safe' });
    expect(store.list()).toHaveLength(1);
  });
});
