/**
 * Adapter that implements RAG's MemoryStore by delegating to @hazeljs/memory.
 * Use this to back RAG (and agent) memory with @hazeljs/memory (in-memory, Prisma, Redis, etc.)
 * in-process: one store and one MemoryManager can be shared by RAG and all agents.
 */

import { randomUUID } from 'crypto';
import type { MemoryService } from '@hazeljs/memory';
import {
  MemoryCategory,
  type MemoryItem,
  type MemoryItemInput,
  type MemoryQuery as HazelMemoryQuery,
  type MemoryStats as HazelMemoryStats,
  type PruneOptions,
} from '@hazeljs/memory';
import { MemoryStore as RAGMemoryStore } from '../memory-store.interface';
import {
  Memory,
  MemoryQuery,
  MemorySearchOptions,
  SummarizeOptions,
  MemoryStats,
  MemoryType,
} from '../types';

const RAG_KEY_PREFIX = 'rag:';
const RAG_CONV_PREFIX = 'rag:conv:';
const RAG_ENTITY_PREFIX = 'rag:entity:';
const RAG_FACT_PREFIX = 'rag:fact:';
const RAG_EVENT_PREFIX = 'rag:event:';
const RAG_WORKING_PREFIX = 'rag:working:';

function ragTypeToCategory(type: MemoryType): MemoryCategory {
  switch (type) {
    case MemoryType.CONVERSATION:
    case MemoryType.ENTITY:
    case MemoryType.EVENT:
      return MemoryCategory.EPISODIC;
    case MemoryType.FACT:
      return MemoryCategory.SEMANTIC_SUMMARY;
    case MemoryType.WORKING:
      return MemoryCategory.PREFERENCE;
    default:
      return MemoryCategory.EPISODIC;
  }
}

function keyPrefixForType(type: MemoryType): string {
  switch (type) {
    case MemoryType.CONVERSATION:
      return RAG_CONV_PREFIX;
    case MemoryType.ENTITY:
      return RAG_ENTITY_PREFIX;
    case MemoryType.FACT:
      return RAG_FACT_PREFIX;
    case MemoryType.EVENT:
      return RAG_EVENT_PREFIX;
    case MemoryType.WORKING:
      return RAG_WORKING_PREFIX;
    default:
      return RAG_KEY_PREFIX;
  }
}

interface StoredValue {
  type: MemoryType;
  content: string;
  metadata: Memory['metadata'];
  embedding?: number[];
}

function memoryToKey(memory: Memory): string {
  const sessionId = memory.metadata.sessionId ?? '';
  switch (memory.type) {
    case MemoryType.WORKING:
      return `rag:working:${sessionId}:${(memory.metadata.contextKey as string) ?? memory.id}`;
    case MemoryType.CONVERSATION:
      return `rag:conv:${memory.id}`;
    case MemoryType.ENTITY:
      return `rag:entity:${memory.id}`;
    case MemoryType.FACT:
      return `rag:fact:${memory.id}`;
    case MemoryType.EVENT:
      return `rag:event:${memory.id}`;
    default:
      return `rag:${memory.type}:${memory.id}`;
  }
}

function itemToMemory(item: MemoryItem): Memory {
  const value = item.value as StoredValue;
  if (typeof value === 'object' && value !== null && 'type' in value && 'content' in value) {
    return {
      id: item.id,
      type: value.type as MemoryType,
      content: value.content,
      metadata: {
        ...value.metadata,
        timestamp: value.metadata?.timestamp
          ? new Date(value.metadata.timestamp as string | number | Date)
          : item.createdAt,
      },
      embedding: value.embedding,
    };
  }
  return {
    id: item.id,
    type: MemoryType.CONVERSATION,
    content: typeof value === 'string' ? value : JSON.stringify(value),
    metadata: {
      timestamp: item.createdAt,
      sessionId: item.sessionId,
      userId: item.userId,
    },
  };
}

function memoryToStoredValue(memory: Memory): StoredValue {
  return {
    type: memory.type,
    content: memory.content,
    metadata: memory.metadata,
    embedding: memory.embedding,
  };
}

/**
 * Adapter that implements RAG's MemoryStore by delegating to @hazeljs/memory's MemoryService.
 * Use createHazelMemoryStoreAdapter() to construct.
 */
export class HazelMemoryStoreAdapter implements RAGMemoryStore {
  constructor(private readonly memoryService: MemoryService) {}

  async initialize(): Promise<void> {
    await this.memoryService.initialize();
  }

  async save(memory: Memory): Promise<string> {
    const sessionId = memory.metadata.sessionId ?? '';
    const input: MemoryItemInput = {
      id: memory.id,
      userId: sessionId,
      category: ragTypeToCategory(memory.type),
      key: memoryToKey(memory),
      value: memoryToStoredValue(memory),
      confidence: memory.metadata.importance ?? 0.5,
      source: 'explicit',
      evidence: [],
      sessionId: sessionId || undefined,
    };
    const item = await this.memoryService.save(input);
    return item.id;
  }

  async saveBatch(memories: Memory[]): Promise<string[]> {
    const ids: string[] = [];
    for (const m of memories) {
      ids.push(await this.save(m));
    }
    return ids;
  }

  async retrieve(query: MemoryQuery): Promise<Memory[]> {
    const sessionId = query.sessionId;
    if (!sessionId) {
      return [];
    }
    const types = query.types ?? [
      MemoryType.CONVERSATION,
      MemoryType.ENTITY,
      MemoryType.FACT,
      MemoryType.EVENT,
      MemoryType.WORKING,
    ];
    const categories = [...new Set(types.map(ragTypeToCategory))];
    const hazelQuery: HazelMemoryQuery = {
      userId: sessionId,
      category: categories.length === 1 ? categories[0]! : categories,
      notExpired: true,
      limit: query.limit ?? 100,
      orderBy: 'updatedAt',
      order: 'desc',
    };
    const items = await this.memoryService.query(hazelQuery);
    const prefixSet = new Set(types.map(keyPrefixForType));
    const filtered = items.filter((item) => {
      for (const prefix of prefixSet) {
        if (item.key.startsWith(prefix)) return true;
      }
      return false;
    });
    return filtered.map(itemToMemory);
  }

  async search(query: string, options: MemorySearchOptions): Promise<Memory[]> {
    const sessionId = options.sessionId;
    if (!sessionId) {
      return [];
    }
    const results = await this.memoryService.search(query, {
      userId: sessionId,
      category: [MemoryCategory.EPISODIC, MemoryCategory.SEMANTIC_SUMMARY],
      topK: options.topK ?? 10,
      minScore: options.minScore,
    });
    const memories = results.map(itemToMemory);
    const queryLower = query.toLowerCase();
    const scored = memories
      .filter((m) => m.content.toLowerCase().includes(queryLower) || true)
      .slice(0, options.topK ?? 10);
    return scored;
  }

  async get(id: string): Promise<Memory | null> {
    const item = await this.memoryService.get(id);
    return item ? itemToMemory(item) : null;
  }

  async update(id: string, updates: Partial<Memory>): Promise<void> {
    const item = await this.memoryService.get(id);
    if (!item) return;
    const value = item.value as StoredValue;
    const merged: StoredValue = {
      type: updates.type ?? value.type,
      content: updates.content ?? value.content,
      metadata: { ...value.metadata, ...updates.metadata },
      embedding: updates.embedding ?? value.embedding,
    };
    await this.memoryService.update(id, {
      value: merged,
      confidence: updates.metadata?.importance ?? item.confidence,
    });
  }

  async delete(id: string): Promise<void> {
    await this.memoryService.delete(id);
  }

  async deleteBatch(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.memoryService.delete(id);
    }
  }

  async clearSession(sessionId: string): Promise<void> {
    const items = await this.memoryService.query({
      userId: sessionId,
      notExpired: true,
      limit: 10_000,
    });
    const ragItems = items.filter((i) => i.key.startsWith(RAG_KEY_PREFIX));
    for (const item of ragItems) {
      await this.memoryService.delete(item.id);
    }
  }

  async clear(): Promise<void> {
    // When backed by shared @hazeljs/memory, we cannot list all RAG items without userId.
    // Use clearSession(sessionId) per session, or ensure the store supports listing by key prefix.
  }

  async summarize(options: SummarizeOptions): Promise<string> {
    const memories = await this.retrieve({
      sessionId: options.sessionId,
      limit: options.maxLength ?? 50,
    });
    if (memories.length === 0) return 'No memories to summarize.';
    const contents = memories.map((m) => m.content).join('\n');
    return contents.slice(0, options.maxLength ?? 1000);
  }

  async consolidate(memories: Memory[]): Promise<Memory> {
    if (memories.length === 0) {
      throw new Error('No memories to consolidate');
    }
    const consolidated: Memory = {
      id: randomUUID(),
      type: memories[0]!.type,
      content: memories.map((m) => m.content).join('\n\n'),
      metadata: {
        ...memories[0]!.metadata,
        timestamp: new Date(),
        consolidated: true,
        sourceIds: memories.map((m) => m.id),
      },
    };
    await this.save(consolidated);
    return consolidated;
  }

  async getStats(sessionId?: string): Promise<MemoryStats> {
    if (sessionId) {
      const items = await this.memoryService.query({
        userId: sessionId,
        notExpired: true,
        limit: 10_000,
      });
      const ragItems = items.filter((i) => i.key.startsWith(RAG_KEY_PREFIX));
      const byType: Record<MemoryType, number> = {
        [MemoryType.CONVERSATION]: 0,
        [MemoryType.ENTITY]: 0,
        [MemoryType.FACT]: 0,
        [MemoryType.EVENT]: 0,
        [MemoryType.WORKING]: 0,
      };
      let totalImportance = 0;
      let oldestTime = Number.MAX_SAFE_INTEGER;
      let newestTime = 0;
      for (const item of ragItems) {
        const key = item.key;
        if (key.startsWith(RAG_CONV_PREFIX)) byType[MemoryType.CONVERSATION]++;
        else if (key.startsWith(RAG_ENTITY_PREFIX)) byType[MemoryType.ENTITY]++;
        else if (key.startsWith(RAG_FACT_PREFIX)) byType[MemoryType.FACT]++;
        else if (key.startsWith(RAG_EVENT_PREFIX)) byType[MemoryType.EVENT]++;
        else if (key.startsWith(RAG_WORKING_PREFIX)) byType[MemoryType.WORKING]++;
        totalImportance += item.confidence;
        const t = item.updatedAt.getTime();
        if (t < oldestTime) oldestTime = t;
        if (t > newestTime) newestTime = t;
      }
      const n = ragItems.length;
      return {
        totalMemories: n,
        byType,
        oldestMemory: n > 0 ? new Date(oldestTime) : new Date(0),
        newestMemory: n > 0 ? new Date(newestTime) : new Date(0),
        averageImportance: n > 0 ? totalImportance / n : 0,
      };
    }
    const hazelStats: HazelMemoryStats = await this.memoryService.getStats();
    const byType: Record<MemoryType, number> = {
      [MemoryType.CONVERSATION]: hazelStats.byCategory[MemoryCategory.EPISODIC] ?? 0,
      [MemoryType.ENTITY]: 0,
      [MemoryType.EVENT]: 0,
      [MemoryType.FACT]: hazelStats.byCategory[MemoryCategory.SEMANTIC_SUMMARY] ?? 0,
      [MemoryType.WORKING]: hazelStats.byCategory[MemoryCategory.PREFERENCE] ?? 0,
    };
    return {
      totalMemories: hazelStats.total,
      byType,
      oldestMemory: hazelStats.oldestMemory ?? new Date(0),
      newestMemory: hazelStats.newestMemory ?? new Date(0),
      averageImportance: 0,
    };
  }

  async prune(options?: { olderThan?: Date; minImportance?: number }): Promise<number> {
    const pruneOpts: PruneOptions = {
      olderThan: options?.olderThan,
      minConfidence: options?.minImportance,
    };
    return this.memoryService.prune(pruneOpts);
  }
}

/**
 * Create a RAG MemoryStore that delegates to @hazeljs/memory's MemoryService.
 * Use for in-process shared memory: create one store and one MemoryManager at app level,
 * then pass the same MemoryManager to RAG and all agents.
 *
 * @param memoryService - MemoryService from @hazeljs/memory (e.g. from createDefaultMemoryStore or createPrismaMemoryStore)
 */
export function createHazelMemoryStoreAdapter(memoryService: MemoryService): HazelMemoryStoreAdapter {
  return new HazelMemoryStoreAdapter(memoryService);
}
