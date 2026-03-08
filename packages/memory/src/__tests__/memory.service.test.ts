import { MemoryService } from '../service/memory.service';
import { createDefaultMemoryStore } from '../store/in-memory.store';
import { MemoryCategory } from '../types/category.types';

describe('MemoryService', () => {
  let service: MemoryService;

  beforeEach(async () => {
    const store = createDefaultMemoryStore();
    service = new MemoryService(store);
    await service.initialize();
  });

  describe('initialize', () => {
    it('resolves', async () => {
      await expect(service.initialize()).resolves.toBeUndefined();
    });
  });

  describe('save', () => {
    it('saves and returns item with id', async () => {
      const item = await service.save({
        userId: 'user-1',
        category: MemoryCategory.PREFERENCE,
        key: 'theme',
        value: 'dark',
        confidence: 0.9,
        source: 'explicit',
        evidence: [],
      });
      expect(item.id).toBeDefined();
      expect(item.userId).toBe('user-1');
      expect(item.key).toBe('theme');
      expect(item.value).toBe('dark');
    });

    it('sets emotional TTL when category is EMOTIONAL', async () => {
      const item = await service.save({
        userId: 'u1',
        category: MemoryCategory.EMOTIONAL,
        key: 'mood',
        value: 'happy',
        confidence: 0.8,
        source: 'explicit',
        evidence: [],
      });
      expect(item.expiresAt).toBeDefined();
      expect(item.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('get', () => {
    it('returns saved item', async () => {
      const saved = await service.save({
        userId: 'u1',
        category: MemoryCategory.PREFERENCE,
        key: 'k1',
        value: 'v1',
        confidence: 1,
        source: 'explicit',
        evidence: [],
      });
      const got = await service.get(saved.id);
      expect(got).not.toBeNull();
      expect(got!.value).toBe('v1');
    });

    it('returns null for missing id', async () => {
      expect(await service.get('nonexistent')).toBeNull();
    });
  });

  describe('query', () => {
    it('returns items matching query', async () => {
      await service.save({
        userId: 'u1',
        category: MemoryCategory.PREFERENCE,
        key: 'a',
        value: 'x',
        confidence: 1,
        source: 'explicit',
        evidence: [],
      });
      const results = await service.query({ userId: 'u1', category: MemoryCategory.PREFERENCE });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getByUserAndCategory', () => {
    it('returns items for user and category', async () => {
      await service.save({
        userId: 'u1',
        category: MemoryCategory.PROFILE,
        key: 'name',
        value: 'Alice',
        confidence: 1,
        source: 'explicit',
        evidence: [],
      });
      const results = await service.getByUserAndCategory('u1', MemoryCategory.PROFILE);
      expect(results.some((r) => r.key === 'name')).toBe(true);
    });

    it('respects limit and order', async () => {
      const results = await service.getByUserAndCategory('u1', MemoryCategory.PREFERENCE, {
        limit: 5,
        offset: 0,
        orderBy: 'updatedAt',
        order: 'desc',
      });
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('update', () => {
    it('updates existing item', async () => {
      const saved = await service.save({
        userId: 'u1',
        category: MemoryCategory.PREFERENCE,
        key: 'k',
        value: 'old',
        confidence: 1,
        source: 'explicit',
        evidence: [],
      });
      await service.update(saved.id, { value: 'new' });
      const got = await service.get(saved.id);
      expect(got!.value).toBe('new');
    });

    it('skips update when explicitOverInferred and updating inferred over explicit', async () => {
      const store = createDefaultMemoryStore();
      const svc = new MemoryService(store, { explicitOverInferred: true });
      await svc.initialize();
      const saved = await svc.save({
        userId: 'u1',
        category: MemoryCategory.PREFERENCE,
        key: 'k',
        value: 'original',
        confidence: 1,
        source: 'explicit',
        evidence: [],
      });
      await svc.update(saved.id, { source: 'inferred', value: 'should-not-apply' });
      const got = await svc.get(saved.id);
      expect(got!.value).toBe('original');
    });
  });

  describe('delete', () => {
    it('removes item', async () => {
      const saved = await service.save({
        userId: 'u1',
        category: MemoryCategory.PREFERENCE,
        key: 'del',
        value: 'x',
        confidence: 1,
        source: 'explicit',
        evidence: [],
      });
      await service.delete(saved.id);
      expect(await service.get(saved.id)).toBeNull();
    });
  });

  describe('incrementAccess', () => {
    it('increments accessCount', async () => {
      const saved = await service.save({
        userId: 'u1',
        category: MemoryCategory.PREFERENCE,
        key: 'acc',
        value: 'v',
        confidence: 1,
        source: 'explicit',
        evidence: [],
      });
      await service.incrementAccess(saved.id);
      const got = await service.get(saved.id);
      expect(got!.accessCount).toBe(1);
    });

    it('does nothing for missing id', async () => {
      await expect(service.incrementAccess('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('search', () => {
    it('returns items from store search', async () => {
      await service.save({
        userId: 'u1',
        category: MemoryCategory.PREFERENCE,
        key: 'searchkey',
        value: 'searchable text',
        confidence: 1,
        source: 'explicit',
        evidence: [],
      });
      const results = await service.search('searchable', { userId: 'u1' });
      expect(Array.isArray(results)).toBe(true);
    });

    it('returns empty when store has no search', async () => {
      const store = createDefaultMemoryStore();
      const storeWithoutSearch = {
        initialize: store.initialize.bind(store),
        save: store.save.bind(store),
        saveBatch: store.saveBatch.bind(store),
        get: store.get.bind(store),
        update: store.update.bind(store),
        delete: store.delete.bind(store),
        deleteBatch: store.deleteBatch.bind(store),
        query: store.query.bind(store),
        getStats: store.getStats.bind(store),
        prune: store.prune.bind(store),
        search: undefined,
      };
      const svc = new MemoryService(storeWithoutSearch as any);
      await svc.initialize();
      const results = await svc.search('q', { userId: 'u1' });
      expect(results).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('returns stats', async () => {
      await service.save({
        userId: 'u1',
        category: MemoryCategory.PREFERENCE,
        key: 's1',
        value: 'v',
        confidence: 1,
        source: 'explicit',
        evidence: [],
      });
      const stats = await service.getStats('u1');
      expect(stats.total).toBeGreaterThanOrEqual(1);
      expect(stats.byCategory).toBeDefined();
    });
  });

  describe('prune', () => {
    it('returns count of pruned items', async () => {
      const removed = await service.prune();
      expect(typeof removed).toBe('number');
    });
  });
});
