/**
 * Hybrid Memory Store - Combines buffer and vector memory strategies
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
import { BufferMemory } from './buffer-memory';
import { VectorMemory } from './vector-memory';

export interface HybridMemoryConfig {
  bufferSize?: number;
  archiveThreshold?: number; // Move to vector store after N messages
  ttl?: number;
}

/**
 * Hybrid memory that combines short-term buffer and long-term vector storage
 * Recent memories stay in fast buffer, older ones move to vector store
 */
export class HybridMemory implements MemoryStore {
  private buffer: BufferMemory;
  private vectorStore: VectorMemory;
  private archiveThreshold: number;

  constructor(
    buffer: BufferMemory,
    vectorStore: VectorMemory,
    config: HybridMemoryConfig = {}
  ) {
    this.buffer = buffer;
    this.vectorStore = vectorStore;
    this.archiveThreshold = config.archiveThreshold || 20;
  }

  async initialize(): Promise<void> {
    await this.buffer.initialize();
    await this.vectorStore.initialize();
  }

  async save(memory: Memory): Promise<string> {
    // Save to buffer first
    const id = await this.buffer.save(memory);

    // Check if we need to archive old memories
    await this.archiveOldMemories(memory.metadata.sessionId);

    return id;
  }

  async saveBatch(memories: Memory[]): Promise<string[]> {
    const ids = await this.buffer.saveBatch(memories);

    // Archive if needed
    if (memories.length > 0 && memories[0].metadata.sessionId) {
      await this.archiveOldMemories(memories[0].metadata.sessionId);
    }

    return ids;
  }

  async retrieve(query: MemoryQuery): Promise<Memory[]> {
    // Get from both stores
    const [bufferResults, vectorResults] = await Promise.all([
      this.buffer.retrieve(query),
      this.vectorStore.retrieve(query),
    ]);

    // Merge and deduplicate
    const merged = this.mergeResults(bufferResults, vectorResults);

    // Sort by timestamp
    merged.sort(
      (a, b) => b.metadata.timestamp.getTime() - a.metadata.timestamp.getTime()
    );

    return merged.slice(0, query.limit || 100);
  }

  async search(query: string, options: MemorySearchOptions): Promise<Memory[]> {
    // Search in both stores
    const [bufferResults, vectorResults] = await Promise.all([
      this.buffer.search(query, options),
      this.vectorStore.search(query, options),
    ]);

    // Merge results, prioritizing vector store scores
    const merged = this.mergeResults(bufferResults, vectorResults);

    return merged.slice(0, options.topK || 10);
  }

  async get(id: string): Promise<Memory | null> {
    // Try buffer first (faster)
    let memory = await this.buffer.get(id);
    if (memory) return memory;

    // Fall back to vector store
    return this.vectorStore.get(id);
  }

  async update(id: string, updates: Partial<Memory>): Promise<void> {
    // Try to update in buffer first
    try {
      await this.buffer.update(id, updates);
    } catch {
      // If not in buffer, update in vector store
      await this.vectorStore.update(id, updates);
    }
  }

  async delete(id: string): Promise<void> {
    // Delete from both stores
    await Promise.all([
      this.buffer.delete(id).catch(() => {}),
      this.vectorStore.delete(id).catch(() => {}),
    ]);
  }

  async deleteBatch(ids: string[]): Promise<void> {
    await Promise.all([
      this.buffer.deleteBatch(ids).catch(() => {}),
      this.vectorStore.deleteBatch(ids).catch(() => {}),
    ]);
  }

  async clearSession(sessionId: string): Promise<void> {
    await Promise.all([
      this.buffer.clearSession(sessionId),
      this.vectorStore.clearSession(sessionId),
    ]);
  }

  async clear(): Promise<void> {
    await Promise.all([this.buffer.clear(), this.vectorStore.clear()]);
  }

  async summarize(options: SummarizeOptions): Promise<string> {
    // Summarize from both stores
    const [bufferSummary, vectorSummary] = await Promise.all([
      this.buffer.summarize(options),
      this.vectorStore.summarize(options),
    ]);

    return `${bufferSummary}\n\n${vectorSummary}`;
  }

  async consolidate(memories: Memory[]): Promise<Memory> {
    // Consolidate and save to vector store
    const consolidated = await this.vectorStore.consolidate(memories);

    // Remove originals from buffer
    const ids = memories.map((m) => m.id);
    await this.buffer.deleteBatch(ids).catch(() => {});

    return consolidated;
  }

  async getStats(sessionId?: string): Promise<MemoryStats> {
    const [bufferStats, vectorStats] = await Promise.all([
      this.buffer.getStats(sessionId),
      this.vectorStore.getStats(sessionId),
    ]);

    // Combine stats
    const byType: Record<MemoryType, number> = {
      [MemoryType.CONVERSATION]: 0,
      [MemoryType.ENTITY]: 0,
      [MemoryType.FACT]: 0,
      [MemoryType.EVENT]: 0,
      [MemoryType.WORKING]: 0,
    };

    for (const type of Object.keys(byType) as MemoryType[]) {
      byType[type] = bufferStats.byType[type] + vectorStats.byType[type];
    }

    return {
      totalMemories: bufferStats.totalMemories + vectorStats.totalMemories,
      byType,
      oldestMemory:
        bufferStats.oldestMemory < vectorStats.oldestMemory
          ? bufferStats.oldestMemory
          : vectorStats.oldestMemory,
      newestMemory:
        bufferStats.newestMemory > vectorStats.newestMemory
          ? bufferStats.newestMemory
          : vectorStats.newestMemory,
      averageImportance:
        (bufferStats.averageImportance + vectorStats.averageImportance) / 2,
    };
  }

  async prune(options?: {
    olderThan?: Date;
    minImportance?: number;
  }): Promise<number> {
    const [bufferPruned, vectorPruned] = await Promise.all([
      this.buffer.prune(options),
      this.vectorStore.prune(options),
    ]);

    return bufferPruned + vectorPruned;
  }

  /**
   * Archive old memories from buffer to vector store
   */
  private async archiveOldMemories(sessionId?: string): Promise<void> {
    if (!sessionId) return;

    const bufferMemories = await this.buffer.retrieve({
      sessionId,
      limit: 1000,
    });

    // If buffer has more than threshold, archive oldest
    if (bufferMemories.length > this.archiveThreshold) {
      const toArchive = bufferMemories.slice(this.archiveThreshold);

      // Move to vector store
      await this.vectorStore.saveBatch(toArchive);

      // Remove from buffer
      const ids = toArchive.map((m) => m.id);
      await this.buffer.deleteBatch(ids);
    }
  }

  /**
   * Merge and deduplicate results from multiple stores
   */
  private mergeResults(
    bufferResults: Memory[],
    vectorResults: Memory[]
  ): Memory[] {
    const seen = new Set<string>();
    const merged: Memory[] = [];

    // Add buffer results first (more recent)
    for (const memory of bufferResults) {
      if (!seen.has(memory.id)) {
        seen.add(memory.id);
        merged.push(memory);
      }
    }

    // Add vector results
    for (const memory of vectorResults) {
      if (!seen.has(memory.id)) {
        seen.add(memory.id);
        merged.push(memory);
      }
    }

    return merged;
  }
}
