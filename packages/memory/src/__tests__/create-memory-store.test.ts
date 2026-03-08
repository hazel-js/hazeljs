import { createMemoryStore } from '../store/create-memory-store';
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

describe('createMemoryStore', () => {
  it('returns in-memory store when no config', () => {
    const store = createMemoryStore();
    expect(store).toBeDefined();
    expect(store.initialize).toBeDefined();
    expect(store.save).toBeDefined();
  });

  it('returns in-memory store when type is in-memory', () => {
    const store = createMemoryStore({ type: 'in-memory' });
    expect(store).toBeDefined();
  });

  it('returns in-memory store with options when type is in-memory and options provided', async () => {
    const store = createMemoryStore({
      type: 'in-memory',
      options: { maxTotalItems: 50 },
    });
    await store.initialize();
    const id = await store.save(makeItem());
    expect(id).toBeDefined();
  });

  it('returns composite store when type is composite', async () => {
    const primary = createDefaultMemoryStore();
    const store = createMemoryStore({
      type: 'composite',
      options: { primary },
    });
    expect(store).toBeDefined();
    await store.initialize();
    const id = await store.save(makeItem());
    expect(id).toBeDefined();
  });

  it('throws or returns postgres store when type is postgres (requires pool)', () => {
    expect(() =>
      createMemoryStore({
        type: 'postgres',
        options: {
          pool: {
            query: async () => ({ rows: [], rowCount: 0 }),
          },
        },
      })
    ).not.toThrow();
  });

  it('throws or returns redis store when type is redis (requires client)', () => {
    const mockClient = {
      get: async () => null,
      set: async () => undefined,
      del: async () => 0,
      sadd: async () => 0,
      smembers: async () => [],
      srem: async () => 0,
      mget: async () => [],
      keys: async () => [],
    };
    expect(() =>
      createMemoryStore({
        type: 'redis',
        options: { client: mockClient },
      })
    ).not.toThrow();
  });

  it('returns default store when config type is unknown (fallback)', () => {
    const store = createMemoryStore({ type: 'unknown' as 'in-memory', options: undefined } as any);
    expect(store).toBeDefined();
    expect(store.initialize).toBeDefined();
  });
});
