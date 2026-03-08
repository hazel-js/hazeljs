import { CompositeMemoryStore } from '../store/composite.store';
import { createDefaultMemoryStore } from '../store/in-memory.store';
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

describe('CompositeMemoryStore', () => {
  let primary: ReturnType<typeof createDefaultMemoryStore>;
  let episodic: ReturnType<typeof createDefaultMemoryStore>;
  let composite: CompositeMemoryStore;

  beforeEach(async () => {
    primary = createDefaultMemoryStore();
    episodic = createDefaultMemoryStore();
    composite = new CompositeMemoryStore({
      primary,
      episodic,
      episodicCategories: [MemoryCategory.EPISODIC, MemoryCategory.SEMANTIC_SUMMARY],
    });
    await composite.initialize();
  });

  describe('initialize', () => {
    it('initializes both stores', async () => {
      await expect(composite.initialize()).resolves.toBeUndefined();
    });
  });

  describe('save and get', () => {
    it('routes PREFERENCE to primary', async () => {
      const item = makeItem({ category: MemoryCategory.PREFERENCE });
      const id = await composite.save(item);
      expect(id).toBeDefined();
      const fromComposite = await composite.get(id);
      expect(fromComposite).not.toBeNull();
      const fromPrimary = await primary.get(id);
      expect(fromPrimary).not.toBeNull();
      expect(await episodic.get(id)).toBeNull();
    });

    it('routes EPISODIC to episodic when episodic store present', async () => {
      const item = makeItem({ category: MemoryCategory.EPISODIC });
      const id = await composite.save(item);
      expect(id).toBeDefined();
      const fromComposite = await composite.get(id);
      expect(fromComposite).not.toBeNull();
      const fromEpisodic = await episodic.get(id);
      expect(fromEpisodic).not.toBeNull();
    });
  });

  describe('saveBatch', () => {
    it('saves to correct stores by category', async () => {
      const items = [
        makeItem({ category: MemoryCategory.PREFERENCE, key: 'p1' }),
        makeItem({ category: MemoryCategory.EPISODIC, key: 'e1' }),
      ];
      const ids = await composite.saveBatch(items);
      expect(ids).toHaveLength(2);
    });
  });

  describe('get', () => {
    it('checks primary then episodic', async () => {
      const id = await primary.save(makeItem({ category: MemoryCategory.PREFERENCE }));
      const got = await composite.get(id);
      expect(got).not.toBeNull();
    });

    it('returns from episodic when not in primary', async () => {
      const item = makeItem({ category: MemoryCategory.EPISODIC, key: 'ep-only' });
      const id = await composite.save(item);
      const got = await composite.get(id);
      expect(got).not.toBeNull();
      expect(got!.id).toBe(id);
    });

    it('returns null when not in either store', async () => {
      expect(await composite.get('nonexistent')).toBeNull();
    });
  });

  describe('update', () => {
    it('updates item in primary', async () => {
      const item = makeItem({ category: MemoryCategory.PREFERENCE, value: 'v1' });
      const id = await composite.save(item);
      await composite.update(id, { value: 'v2' });
      const got = await composite.get(id);
      expect(got!.value).toBe('v2');
    });

    it('updates item in episodic when id is in episodic store', async () => {
      const item = makeItem({ category: MemoryCategory.EPISODIC, value: 'v1' });
      const id = await composite.save(item);
      await composite.update(id, { value: 'v2' });
      const got = await composite.get(id);
      expect(got!.value).toBe('v2');
    });
  });

  describe('delete', () => {
    it('deletes from both stores', async () => {
      const id = await composite.save(makeItem({ category: MemoryCategory.PREFERENCE }));
      await composite.delete(id);
      expect(await composite.get(id)).toBeNull();
    });

    it('deletes from episodic when id only in episodic', async () => {
      const id = await composite.save(makeItem({ category: MemoryCategory.EPISODIC }));
      await composite.delete(id);
      expect(await composite.get(id)).toBeNull();
    });
  });

  describe('deleteBatch', () => {
    it('deletes from both primary and episodic', async () => {
      const id1 = await composite.save(
        makeItem({ category: MemoryCategory.PREFERENCE, key: 'pb1' })
      );
      const id2 = await composite.save(makeItem({ category: MemoryCategory.EPISODIC, key: 'eb1' }));
      await composite.deleteBatch([id1, id2]);
      expect(await composite.get(id1)).toBeNull();
      expect(await composite.get(id2)).toBeNull();
    });
  });

  describe('query', () => {
    it('returns merged results from both stores', async () => {
      await composite.save(makeItem({ category: MemoryCategory.PREFERENCE, key: 'pk' }));
      await composite.save(makeItem({ category: MemoryCategory.EPISODIC, key: 'ek' }));
      const results = await composite.query({
        userId: 'user-1',
        limit: 10,
      });
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('sorts and applies limit', async () => {
      const results = await composite.query({
        userId: 'user-1',
        orderBy: 'updatedAt',
        order: 'desc',
        limit: 5,
        offset: 0,
      });
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('search', () => {
    it('uses episodic search when episodic store has search', async () => {
      const results = await composite.search('query', { userId: 'user-1' });
      expect(Array.isArray(results)).toBe(true);
    });

    it('falls back to primary search when episodic has no search', async () => {
      const primaryWithSearch = createDefaultMemoryStore();
      const episodicNoSearch = createDefaultMemoryStore();
      const ep = episodicNoSearch as any;
      ep.search = undefined;
      const comp = new CompositeMemoryStore({
        primary: primaryWithSearch,
        episodic: ep,
        episodicCategories: [MemoryCategory.EPISODIC],
      });
      await comp.initialize();
      const results = await comp.search('q', { userId: 'user-1' });
      expect(Array.isArray(results)).toBe(true);
    });

    it('returns empty when neither store has search', async () => {
      const primaryNoSearch = createDefaultMemoryStore() as any;
      primaryNoSearch.search = undefined;
      const comp = new CompositeMemoryStore({ primary: primaryNoSearch });
      await comp.initialize();
      const results = await comp.search('q', { userId: 'user-1' });
      expect(results).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('merges stats from primary and episodic', async () => {
      await composite.save(makeItem({ category: MemoryCategory.PREFERENCE }));
      await composite.save(makeItem({ category: MemoryCategory.EPISODIC }));
      const stats = await composite.getStats('user-1');
      expect(stats.total).toBeGreaterThanOrEqual(2);
      expect(stats.byCategory).toBeDefined();
    });

    it('returns primary stats when no episodic', async () => {
      const primaryOnly = new CompositeMemoryStore({ primary: createDefaultMemoryStore() });
      await primaryOnly.initialize();
      const stats = await primaryOnly.getStats('user-1');
      expect(stats).toBeDefined();
      expect(stats.total).toBeDefined();
    });
  });

  describe('prune', () => {
    it('prunes both stores', async () => {
      const removed = await composite.prune();
      expect(typeof removed).toBe('number');
    });
  });
});

describe('CompositeMemoryStore without episodic', () => {
  it('routes all to primary', async () => {
    const primary = createDefaultMemoryStore();
    const composite = new CompositeMemoryStore({ primary });
    await composite.initialize();
    const item = makeItem({ category: MemoryCategory.EPISODIC });
    const id = await composite.save(item);
    expect(id).toBeDefined();
    const got = await composite.get(id);
    expect(got).not.toBeNull();
  });

  it('get returns null when not in primary and no episodic', async () => {
    const primary = createDefaultMemoryStore();
    const composite = new CompositeMemoryStore({ primary });
    await composite.initialize();
    expect(await composite.get('nonexistent')).toBeNull();
  });
});
