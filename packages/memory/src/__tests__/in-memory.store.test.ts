import { InMemoryStore, createDefaultMemoryStore } from '../store/in-memory.store';
import { MemoryCategory } from '../types/category.types';
import type { MemoryItem } from '../types/memory-item.types';

function makeItem(overrides: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: 'id-' + Math.random().toString(36).slice(2),
    userId: 'user-1',
    category: MemoryCategory.PREFERENCE,
    key: 'key-' + Math.random().toString(36).slice(2),
    value: 'value',
    confidence: 0.9,
    source: 'explicit',
    evidence: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    accessCount: 0,
    ...overrides,
  };
}

describe('InMemoryStore', () => {
  let store: InMemoryStore;

  beforeEach(async () => {
    store = new InMemoryStore({ maxTotalItems: 1000, maxItemsPerUserPerCategory: 100 });
    await store.initialize();
  });

  describe('initialize', () => {
    it('resolves without error', async () => {
      await expect(store.initialize()).resolves.toBeUndefined();
    });
  });

  describe('save', () => {
    it('saves item and returns id', async () => {
      const item = makeItem();
      const id = await store.save(item);
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      const got = await store.get(id);
      expect(got).not.toBeNull();
      expect(got!.userId).toBe(item.userId);
      expect(got!.category).toBe(item.category);
      expect(got!.key).toBe(item.key);
    });

    it('uses existing id when provided', async () => {
      const item = makeItem({ id: 'my-custom-id' });
      const id = await store.save(item);
      expect(id).toBe('my-custom-id');
      expect(await store.get('my-custom-id')).not.toBeNull();
    });

    it('sets emotional TTL when category is EMOTIONAL and expiresAt not set', async () => {
      const item = makeItem({
        category: MemoryCategory.EMOTIONAL,
        expiresAt: undefined,
      });
      const id = await store.save(item);
      const got = await store.get(id);
      expect(got!.expiresAt).toBeDefined();
      expect(got!.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it('overwrites existing item when id exists', async () => {
      const item = makeItem({ id: 'same-id', value: 'v1' });
      await store.save(item);
      await store.save({ ...item, value: 'v2' });
      const got = await store.get('same-id');
      expect(got!.value).toBe('v2');
    });
  });

  describe('saveBatch', () => {
    it('saves multiple items and returns ids', async () => {
      const items = [makeItem(), makeItem(), makeItem()];
      const ids = await store.saveBatch(items);
      expect(ids).toHaveLength(3);
      for (let i = 0; i < ids.length; i++) {
        const got = await store.get(ids[i]!);
        expect(got).not.toBeNull();
        expect(got!.key).toBe(items[i]!.key);
      }
    });
  });

  describe('get', () => {
    it('returns null for missing id', async () => {
      expect(await store.get('nonexistent')).toBeNull();
    });

    it('returns null and deletes item when expired', async () => {
      const item = makeItem({
        expiresAt: new Date(Date.now() - 1000),
      });
      const id = await store.save(item);
      const got = await store.get(id);
      expect(got).toBeNull();
      expect(await store.get(id)).toBeNull();
    });
  });

  describe('update', () => {
    it('updates existing item', async () => {
      const item = makeItem({ value: 'original' });
      const id = await store.save(item);
      await store.update(id, { value: 'updated' });
      const got = await store.get(id);
      expect(got!.value).toBe('updated');
    });

    it('does nothing for missing id', async () => {
      await expect(store.update('nonexistent', { value: 'x' })).resolves.toBeUndefined();
    });
  });

  describe('delete', () => {
    it('removes item', async () => {
      const id = await store.save(makeItem());
      await store.delete(id);
      expect(await store.get(id)).toBeNull();
    });

    it('is no-op for missing id', async () => {
      await expect(store.delete('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('deleteBatch', () => {
    it('removes all given ids', async () => {
      const ids = await store.saveBatch([makeItem(), makeItem(), makeItem()]);
      await store.deleteBatch(ids);
      for (const id of ids) {
        expect(await store.get(id)).toBeNull();
      }
    });
  });

  describe('query', () => {
    it('accepts array category', async () => {
      await store.save(makeItem({ userId: 'u1', category: MemoryCategory.PREFERENCE, key: 'k1' }));
      await store.save(makeItem({ userId: 'u1', category: MemoryCategory.PROFILE, key: 'k2' }));
      const results = await store.query({
        userId: 'u1',
        category: [MemoryCategory.PREFERENCE, MemoryCategory.PROFILE],
      });
      expect(results.length).toBe(2);
    });

    it('returns items for userId and category', async () => {
      await store.save(makeItem({ userId: 'u1', category: MemoryCategory.PREFERENCE, key: 'k1' }));
      await store.save(makeItem({ userId: 'u1', category: MemoryCategory.PREFERENCE, key: 'k2' }));
      await store.save(makeItem({ userId: 'u2', category: MemoryCategory.PREFERENCE, key: 'k3' }));
      const results = await store.query({
        userId: 'u1',
        category: MemoryCategory.PREFERENCE,
      });
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.userId === 'u1')).toBe(true);
    });

    it('respects limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        await store.save(makeItem({ key: `k-${i}` }));
      }
      const page1 = await store.query({ userId: 'user-1', limit: 2, offset: 0 });
      const page2 = await store.query({ userId: 'user-1', limit: 2, offset: 2 });
      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0]!.id).not.toBe(page2[0]!.id);
    });

    it('filters by source', async () => {
      await store.save(makeItem({ userId: 'u1', source: 'explicit', key: 'k1' }));
      await store.save(makeItem({ userId: 'u1', source: 'inferred', key: 'k2' }));
      const results = await store.query({
        userId: 'u1',
        source: 'explicit',
      });
      expect(results).toHaveLength(1);
      expect(results[0]!.source).toBe('explicit');
    });

    it('filters by array source', async () => {
      await store.save(makeItem({ userId: 'u1', source: 'explicit', key: 'k1' }));
      await store.save(makeItem({ userId: 'u1', source: 'inferred', key: 'k2' }));
      const results = await store.query({
        userId: 'u1',
        source: ['explicit', 'system'],
      });
      expect(results).toHaveLength(1);
    });

    it('filters by minConfidence', async () => {
      await store.save(makeItem({ userId: 'u1', confidence: 0.3, key: 'k1' }));
      await store.save(makeItem({ userId: 'u1', confidence: 0.9, key: 'k2' }));
      const results = await store.query({
        userId: 'u1',
        minConfidence: 0.5,
      });
      expect(results).toHaveLength(1);
      expect(results[0]!.confidence).toBe(0.9);
    });

    it('sorts by orderBy and order', async () => {
      const base = new Date('2024-01-01');
      await store.save(makeItem({ key: 'a', updatedAt: new Date(base.getTime() + 1000) }));
      await store.save(makeItem({ key: 'b', updatedAt: new Date(base.getTime() + 2000) }));
      const desc = await store.query({ userId: 'user-1', orderBy: 'updatedAt', order: 'desc' });
      const asc = await store.query({ userId: 'user-1', orderBy: 'updatedAt', order: 'asc' });
      expect(desc[0]!.key).toBe('b');
      expect(asc[0]!.key).toBe('a');
    });

    it('sorts by createdAt when orderBy is createdAt', async () => {
      await store.save(makeItem({ key: 'first', createdAt: new Date('2024-01-01') }));
      await store.save(makeItem({ key: 'second', createdAt: new Date('2024-01-02') }));
      const asc = await store.query({ userId: 'user-1', orderBy: 'createdAt', order: 'asc' });
      expect(asc.length).toBeGreaterThanOrEqual(1);
      if (asc.length >= 2)
        expect(asc[0]!.createdAt.getTime()).toBeLessThanOrEqual(asc[1]!.createdAt.getTime());
    });

    it('returns empty for unknown userId', async () => {
      const results = await store.query({ userId: 'unknown-user' });
      expect(results).toEqual([]);
    });
  });

  describe('search', () => {
    it('returns items matching string query', async () => {
      await store.save(makeItem({ userId: 'u1', key: 'foo', value: 'hello world' }));
      await store.save(makeItem({ userId: 'u1', key: 'bar', value: 'goodbye' }));
      const results = await store.search('world', { userId: 'u1' });
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((r) => (r.value as string).includes('world'))).toBe(true);
    });

    it('returns empty for vector query (number[])', async () => {
      const results = await store.search([0.1, 0.2], { userId: 'u1' });
      expect(results).toEqual([]);
    });

    it('respects topK', async () => {
      for (let i = 0; i < 5; i++) {
        await store.save(makeItem({ userId: 'u1', key: `k-${i}`, value: 'same' }));
      }
      const results = await store.search('same', { userId: 'u1', topK: 2 });
      expect(results).toHaveLength(2);
    });

    it('filters by category', async () => {
      await store.save(
        makeItem({
          userId: 'u1',
          category: MemoryCategory.PREFERENCE,
          key: 'pref',
          value: 'theme dark',
        })
      );
      await store.save(
        makeItem({
          userId: 'u1',
          category: MemoryCategory.PROFILE,
          key: 'prof',
          value: 'theme dark',
        })
      );
      const results = await store.search('theme', {
        userId: 'u1',
        category: MemoryCategory.PREFERENCE,
      });
      expect(results).toHaveLength(1);
      expect(results[0]!.category).toBe(MemoryCategory.PREFERENCE);
    });
  });

  describe('getStats', () => {
    it('returns counts by category', async () => {
      await store.save(makeItem({ userId: 'u1', category: MemoryCategory.PREFERENCE }));
      await store.save(makeItem({ userId: 'u1', category: MemoryCategory.PREFERENCE }));
      await store.save(makeItem({ userId: 'u1', category: MemoryCategory.PROFILE }));
      const stats = await store.getStats('u1');
      expect(stats.total).toBe(3);
      expect(stats.byCategory[MemoryCategory.PREFERENCE]).toBe(2);
      expect(stats.byCategory[MemoryCategory.PROFILE]).toBe(1);
    });

    it('returns global stats when userId not provided', async () => {
      await store.save(makeItem({ userId: 'u1' }));
      await store.save(makeItem({ userId: 'u2' }));
      const stats = await store.getStats();
      expect(stats.total).toBe(2);
    });

    it('excludes expired items from stats', async () => {
      const id = await store.save(
        makeItem({ userId: 'u1', expiresAt: new Date(Date.now() - 1000) })
      );
      await store.get(id); // trigger lazy expiry
      const stats = await store.getStats('u1');
      expect(stats.total).toBe(0);
    });
  });

  describe('prune', () => {
    it('removes expired items', async () => {
      await store.save(
        makeItem({ userId: 'u1', expiresAt: new Date(Date.now() - 1000), key: 'exp' })
      );
      const removed = await store.prune();
      expect(removed).toBeGreaterThanOrEqual(1);
    });

    it('removes items older than olderThan', async () => {
      const old = makeItem({ userId: 'u1', key: 'old', updatedAt: new Date('2020-01-01') });
      await store.save(old);
      const removed = await store.prune({ olderThan: new Date('2023-01-01') });
      expect(removed).toBeGreaterThanOrEqual(1);
    });

    it('removes low-confidence items when minConfidence set', async () => {
      await store.save(makeItem({ userId: 'u1', confidence: 0.2, key: 'low' }));
      const removed = await store.prune({ userId: 'u1', minConfidence: 0.5 });
      expect(removed).toBeGreaterThanOrEqual(1);
    });

    it('trims to maxItemsPerUser when specified', async () => {
      await store.save(makeItem({ userId: 'u1', category: MemoryCategory.PREFERENCE, key: 'k1' }));
      await store.save(makeItem({ userId: 'u1', category: MemoryCategory.PREFERENCE, key: 'k2' }));
      await store.save(makeItem({ userId: 'u1', category: MemoryCategory.PREFERENCE, key: 'k3' }));
      const removed = await store.prune({
        userId: 'u1',
        category: MemoryCategory.PREFERENCE,
        maxItemsPerUser: 1,
      });
      expect(removed).toBeGreaterThanOrEqual(1);
      const remaining = await store.query({ userId: 'u1', category: MemoryCategory.PREFERENCE });
      expect(remaining.length).toBeLessThanOrEqual(1);
    });
  });

  describe('eviction', () => {
    it('evicts per-user per-category when over maxItemsPerUserPerCategory', async () => {
      const small = new InMemoryStore({ maxTotalItems: 1000, maxItemsPerUserPerCategory: 2 });
      await small.initialize();
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        ids.push(
          await small.save(
            makeItem({ userId: 'u1', category: MemoryCategory.PREFERENCE, key: `k-${i}` })
          )
        );
      }
      const stats = await small.getStats('u1');
      expect(stats.byCategory[MemoryCategory.PREFERENCE]).toBeLessThanOrEqual(2);
    });

    it('evicts globally when over maxTotalItems', async () => {
      const small = new InMemoryStore({ maxTotalItems: 3, maxItemsPerUserPerCategory: 10 });
      await small.initialize();
      for (let i = 0; i < 6; i++) {
        await small.save(makeItem({ userId: `u-${i}`, key: `k-${i}` }));
      }
      const stats = await small.getStats();
      expect(stats.total).toBeLessThanOrEqual(3);
    });
  });
});

describe('createDefaultMemoryStore', () => {
  it('returns an InMemoryStore instance', () => {
    const store = createDefaultMemoryStore();
    expect(store).toBeDefined();
    expect(store.initialize).toBeDefined();
    expect(store.save).toBeDefined();
    expect(store.get).toBeDefined();
  });

  it('accepts options', () => {
    const store = createDefaultMemoryStore({ maxTotalItems: 50 });
    expect(store).toBeDefined();
  });
});
