/**
 * Tests for HazelMemoryStoreAdapter — RAG memory store backed by @hazeljs/memory.
 * Uses real @hazeljs/memory in-memory store when run in monorepo (moduleNameMapper).
 */

import {
  HazelMemoryStoreAdapter,
  createHazelMemoryStoreAdapter,
} from '../../memory/stores/hazel-memory-store.adapter';
import { MemoryService, createDefaultMemoryStore } from '@hazeljs/memory';
import type { Memory } from '../../memory/types';
import { MemoryType } from '../../memory/types';

function makeMemory(
  overrides: Partial<Omit<Memory, 'metadata'>> & { metadata?: Partial<Memory['metadata']> } = {}
): Memory {
  const metadata: Memory['metadata'] = {
    timestamp: new Date(),
    sessionId: 's1',
    userId: 'u1',
    ...(overrides.metadata ?? {}),
  };
  return {
    id: overrides.id ?? `mem-${Math.random().toString(36).slice(2)}`,
    type: overrides.type ?? MemoryType.CONVERSATION,
    content: overrides.content ?? 'hello',
    metadata,
    ...overrides,
  } as Memory;
}

describe('HazelMemoryStoreAdapter', () => {
  let memoryService: MemoryService;
  let adapter: HazelMemoryStoreAdapter;

  beforeEach(async () => {
    const store = createDefaultMemoryStore();
    memoryService = new MemoryService(store);
    await memoryService.initialize();
    adapter = createHazelMemoryStoreAdapter(memoryService);
    await adapter.initialize();
  });

  describe('createHazelMemoryStoreAdapter', () => {
    it('returns HazelMemoryStoreAdapter instance', () => {
      const a = createHazelMemoryStoreAdapter(memoryService);
      expect(a).toBeInstanceOf(HazelMemoryStoreAdapter);
    });
  });

  describe('initialize', () => {
    it('resolves', async () => {
      await expect(adapter.initialize()).resolves.toBeUndefined();
    });
  });

  describe('save', () => {
    it('saves memory and returns id', async () => {
      const mem = makeMemory({ type: MemoryType.CONVERSATION });
      const id = await adapter.save(mem);
      expect(id).toBeDefined();
      const got = await adapter.get(id);
      expect(got).not.toBeNull();
      expect(got!.content).toBe(mem.content);
      expect(got!.type).toBe(MemoryType.CONVERSATION);
    });

    it('saves WORKING memory with contextKey', async () => {
      const mem = makeMemory({
        type: MemoryType.WORKING,
        metadata: { sessionId: 's1', contextKey: 'task' },
      });
      const id = await adapter.save(mem);
      expect(id).toBeDefined();
    });
  });

  describe('saveBatch', () => {
    it('saves multiple and returns ids', async () => {
      const memories = [makeMemory({ content: 'a' }), makeMemory({ content: 'b' })];
      const ids = await adapter.saveBatch(memories);
      expect(ids).toHaveLength(2);
    });
  });

  describe('retrieve', () => {
    it('returns empty when sessionId missing', async () => {
      const results = await adapter.retrieve({});
      expect(results).toEqual([]);
    });

    it('returns memories for session', async () => {
      await adapter.save(makeMemory({ metadata: { sessionId: 's1' } }));
      const results = await adapter.retrieve({ sessionId: 's1' });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('respects limit', async () => {
      await adapter.save(makeMemory({ metadata: { sessionId: 's1' } }));
      const results = await adapter.retrieve({ sessionId: 's1', limit: 1 });
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('search', () => {
    it('returns empty when sessionId missing', async () => {
      const results = await adapter.search('query', {});
      expect(results).toEqual([]);
    });

    it('returns memories matching query', async () => {
      await adapter.save(makeMemory({ content: 'searchable text', metadata: { sessionId: 's1' } }));
      const results = await adapter.search('searchable', { sessionId: 's1' });
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('get', () => {
    it('returns null for missing id', async () => {
      expect(await adapter.get('nonexistent')).toBeNull();
    });

    it('returns saved memory by id', async () => {
      const mem = makeMemory();
      const id = await adapter.save(mem);
      const got = await adapter.get(id);
      expect(got).not.toBeNull();
      expect(got!.id).toBe(id);
    });
  });

  describe('update', () => {
    it('updates memory', async () => {
      const mem = makeMemory({ content: 'old' });
      const id = await adapter.save(mem);
      await adapter.update(id, { content: 'new' });
      const got = await adapter.get(id);
      expect(got!.content).toBe('new');
    });
  });

  describe('delete', () => {
    it('removes memory', async () => {
      const id = await adapter.save(makeMemory());
      await adapter.delete(id);
      expect(await adapter.get(id)).toBeNull();
    });
  });

  describe('deleteBatch', () => {
    it('removes all given ids', async () => {
      const id1 = await adapter.save(makeMemory());
      const id2 = await adapter.save(makeMemory());
      await adapter.deleteBatch([id1, id2]);
      expect(await adapter.get(id1)).toBeNull();
      expect(await adapter.get(id2)).toBeNull();
    });
  });

  describe('clearSession', () => {
    it('removes RAG memories for session', async () => {
      await adapter.save(makeMemory({ metadata: { sessionId: 's1' } }));
      await adapter.clearSession('s1');
      const results = await adapter.retrieve({ sessionId: 's1' });
      expect(results).toHaveLength(0);
    });
  });

  describe('summarize', () => {
    it('returns message when no memories', async () => {
      const out = await adapter.summarize({ sessionId: 's1' });
      expect(out).toContain('No memories');
    });

    it('returns concatenated content when memories exist', async () => {
      await adapter.save(makeMemory({ content: 'first', metadata: { sessionId: 's1' } }));
      const out = await adapter.summarize({ sessionId: 's1', maxLength: 500 });
      expect(out.length).toBeGreaterThan(0);
    });
  });

  describe('consolidate', () => {
    it('throws when memories array empty', async () => {
      await expect(adapter.consolidate([])).rejects.toThrow('No memories');
    });

    it('consolidates multiple memories', async () => {
      const m1 = makeMemory({ content: 'one' });
      const m2 = makeMemory({ content: 'two' });
      const id1 = await adapter.save(m1);
      const id2 = await adapter.save(m2);
      const consolidated = await adapter.consolidate([
        { ...m1, id: id1 },
        { ...m2, id: id2 },
      ]);
      expect(consolidated.id).toBeDefined();
      expect(consolidated.content).toContain('one');
      expect(consolidated.content).toContain('two');
    });
  });

  describe('getStats', () => {
    it('returns stats for session', async () => {
      await adapter.save(makeMemory({ metadata: { sessionId: 's1' } }));
      const stats = await adapter.getStats('s1');
      expect(stats.totalMemories).toBeGreaterThanOrEqual(1);
      expect(stats.byType).toBeDefined();
    });

    it('returns global stats when no sessionId', async () => {
      const stats = await adapter.getStats();
      expect(stats).toBeDefined();
      expect(stats.totalMemories).toBeDefined();
    });
  });

  describe('prune', () => {
    it('calls memoryService.prune', async () => {
      const removed = await adapter.prune();
      expect(typeof removed).toBe('number');
    });
  });
});
