/**
 * Buffer Memory Store - Simple FIFO buffer for recent memories
 */

import { MemoryStore } from '../memory-store.interface';
import {
  Memory,
  MemoryQuery,
  MemorySearchOptions,
  SummarizeOptions,
  MemoryStats,
  MemoryType,
} from '../types';
import { randomUUID } from 'crypto';

export interface BufferMemoryConfig {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
}

/**
 * In-memory buffer that keeps the most recent memories
 * Uses FIFO (First In, First Out) strategy
 */
export class BufferMemory implements MemoryStore {
  private memories: Map<string, Memory> = new Map();
  private sessionBuffers: Map<string, string[]> = new Map();
  private maxSize: number;
  private ttl?: number;

  constructor(config: BufferMemoryConfig = {}) {
    this.maxSize = config.maxSize || 100;
    this.ttl = config.ttl;
  }

  async initialize(): Promise<void> {
    // No initialization needed for in-memory store
  }

  async save(memory: Memory): Promise<string> {
    const id = memory.id || randomUUID();
    const memoryWithId = { ...memory, id };

    // Add expiration if TTL is set
    if (this.ttl && !memoryWithId.metadata.expiresAt) {
      memoryWithId.metadata.expiresAt = new Date(Date.now() + this.ttl);
    }

    this.memories.set(id, memoryWithId);

    // Track in session buffer
    if (memory.metadata.sessionId) {
      const buffer = this.sessionBuffers.get(memory.metadata.sessionId) || [];
      buffer.push(id);
      
      // Enforce max size per session
      if (buffer.length > this.maxSize) {
        const removedId = buffer.shift()!;
        this.memories.delete(removedId);
      }
      
      this.sessionBuffers.set(memory.metadata.sessionId, buffer);
    }

    // Enforce global max size
    if (this.memories.size > this.maxSize * 10) {
      const oldestId = Array.from(this.memories.keys())[0];
      this.memories.delete(oldestId);
    }

    return id;
  }

  async saveBatch(memories: Memory[]): Promise<string[]> {
    const ids: string[] = [];
    for (const memory of memories) {
      const id = await this.save(memory);
      ids.push(id);
    }
    return ids;
  }

  async retrieve(query: MemoryQuery): Promise<Memory[]> {
    this.cleanExpired();

    let results = Array.from(this.memories.values());

    // Filter by session
    if (query.sessionId) {
      results = results.filter((m) => m.metadata.sessionId === query.sessionId);
    }

    // Filter by user
    if (query.userId) {
      results = results.filter((m) => m.metadata.userId === query.userId);
    }

    // Filter by types
    if (query.types && query.types.length > 0) {
      results = results.filter((m) => query.types!.includes(m.type));
    }

    // Filter by date range
    if (query.startDate) {
      results = results.filter((m) => m.metadata.timestamp >= query.startDate!);
    }
    if (query.endDate) {
      results = results.filter((m) => m.metadata.timestamp <= query.endDate!);
    }

    // Filter by importance
    if (query.minImportance !== undefined) {
      results = results.filter(
        (m) => (m.metadata.importance || 0) >= query.minImportance!
      );
    }

    // Filter by entities
    if (query.entities && query.entities.length > 0) {
      results = results.filter((m) =>
        m.metadata.entities?.some((e) => query.entities!.includes(e))
      );
    }

    // Sort by timestamp (newest first)
    results.sort(
      (a, b) => b.metadata.timestamp.getTime() - a.metadata.timestamp.getTime()
    );

    // Apply limit
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  async search(query: string, options: MemorySearchOptions): Promise<Memory[]> {
    // Simple text-based search (no semantic search in buffer)
    const memories = await this.retrieve(options);
    
    const queryLower = query.toLowerCase();
    const scored = memories
      .map((memory) => ({
        memory,
        score: this.calculateTextScore(memory.content, queryLower),
      }))
      .filter((item) => item.score > (options.minScore || 0))
      .sort((a, b) => b.score - a.score);

    const results = scored.map((item) => ({
      ...item.memory,
      metadata: {
        ...item.memory.metadata,
        searchScore: item.score,
      },
    }));

    return results.slice(0, options.topK || 10);
  }

  async get(id: string): Promise<Memory | null> {
    this.cleanExpired();
    return this.memories.get(id) || null;
  }

  async update(id: string, updates: Partial<Memory>): Promise<void> {
    const memory = this.memories.get(id);
    if (!memory) {
      throw new Error(`Memory with id ${id} not found`);
    }

    const updated = {
      ...memory,
      ...updates,
      metadata: {
        ...memory.metadata,
        ...updates.metadata,
      },
    };

    this.memories.set(id, updated);
  }

  async delete(id: string): Promise<void> {
    this.memories.delete(id);
    
    // Remove from session buffers
    for (const [sessionId, buffer] of this.sessionBuffers.entries()) {
      const index = buffer.indexOf(id);
      if (index !== -1) {
        buffer.splice(index, 1);
        this.sessionBuffers.set(sessionId, buffer);
      }
    }
  }

  async deleteBatch(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.delete(id);
    }
  }

  async clearSession(sessionId: string): Promise<void> {
    const buffer = this.sessionBuffers.get(sessionId);
    if (buffer) {
      for (const id of buffer) {
        this.memories.delete(id);
      }
      this.sessionBuffers.delete(sessionId);
    }
  }

  async clear(): Promise<void> {
    this.memories.clear();
    this.sessionBuffers.clear();
  }

  async summarize(options: SummarizeOptions): Promise<string> {
    const memories = await this.retrieve({
      sessionId: options.sessionId,
      limit: options.maxLength || 50,
    });

    if (memories.length === 0) {
      return 'No memories to summarize.';
    }

    // Simple concatenation summary
    const contents = memories.map((m) => m.content).join('\n');
    return contents.slice(0, options.maxLength || 1000);
  }

  async consolidate(memories: Memory[]): Promise<Memory> {
    if (memories.length === 0) {
      throw new Error('No memories to consolidate');
    }

    // Merge memories into one
    const consolidated: Memory = {
      id: randomUUID(),
      type: memories[0].type,
      content: memories.map((m) => m.content).join('\n\n'),
      metadata: {
        ...memories[0].metadata,
        timestamp: new Date(),
        consolidated: true,
        sourceIds: memories.map((m) => m.id),
      },
    };

    return consolidated;
  }

  async getStats(sessionId?: string): Promise<MemoryStats> {
    this.cleanExpired();

    let memories = Array.from(this.memories.values());
    if (sessionId) {
      memories = memories.filter((m) => m.metadata.sessionId === sessionId);
    }

    const byType: Record<MemoryType, number> = {
      [MemoryType.CONVERSATION]: 0,
      [MemoryType.ENTITY]: 0,
      [MemoryType.FACT]: 0,
      [MemoryType.EVENT]: 0,
      [MemoryType.WORKING]: 0,
    };

    let totalImportance = 0;
    let oldestTime = Date.now();
    let newestTime = 0;

    for (const memory of memories) {
      byType[memory.type]++;
      totalImportance += memory.metadata.importance || 0;
      
      const time = memory.metadata.timestamp.getTime();
      if (time < oldestTime) oldestTime = time;
      if (time > newestTime) newestTime = time;
    }

    return {
      totalMemories: memories.length,
      byType,
      oldestMemory: new Date(oldestTime),
      newestMemory: new Date(newestTime),
      averageImportance: memories.length > 0 ? totalImportance / memories.length : 0,
    };
  }

  async prune(options?: {
    olderThan?: Date;
    minImportance?: number;
  }): Promise<number> {
    this.cleanExpired();

    let pruned = 0;
    const toDelete: string[] = [];

    for (const [id, memory] of this.memories.entries()) {
      let shouldPrune = false;

      if (options?.olderThan && memory.metadata.timestamp < options.olderThan) {
        shouldPrune = true;
      }

      if (
        options?.minImportance !== undefined &&
        (memory.metadata.importance || 0) < options.minImportance
      ) {
        shouldPrune = true;
      }

      if (shouldPrune) {
        toDelete.push(id);
        pruned++;
      }
    }

    await this.deleteBatch(toDelete);
    return pruned;
  }

  /**
   * Clean expired memories
   */
  private cleanExpired(): void {
    if (!this.ttl) return;

    const now = Date.now();
    const toDelete: string[] = [];

    for (const [id, memory] of this.memories.entries()) {
      if (
        memory.metadata.expiresAt &&
        memory.metadata.expiresAt.getTime() < now
      ) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.memories.delete(id);
    }
  }

  /**
   * Calculate simple text similarity score
   */
  private calculateTextScore(content: string, query: string): number {
    const contentLower = content.toLowerCase();
    const words = query.split(/\s+/);
    
    let score = 0;
    for (const word of words) {
      if (contentLower.includes(word)) {
        score += 1;
      }
    }
    
    return score / words.length;
  }
}
