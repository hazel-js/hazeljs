/**
 * Vector Memory Store - Stores memories as embeddings for semantic search
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
import { VectorStore } from '../../types';
import { EmbeddingProvider } from '../../types';
import { randomUUID } from 'crypto';

export interface VectorMemoryConfig {
  collectionName?: string;
  namespace?: string;
}

/**
 * Memory store that uses vector embeddings for semantic search
 * Leverages existing vector store infrastructure
 */
export class VectorMemory implements MemoryStore {
  private vectorStore: VectorStore;
  private embeddings: EmbeddingProvider;
  private config: VectorMemoryConfig;

  constructor(
    vectorStore: VectorStore,
    embeddings: EmbeddingProvider,
    config: VectorMemoryConfig = {}
  ) {
    this.vectorStore = vectorStore;
    this.embeddings = embeddings;
    this.config = config;
  }

  async initialize(): Promise<void> {
    await this.vectorStore.initialize();
  }

  async save(memory: Memory): Promise<string> {
    const id = memory.id || randomUUID();
    
    // Generate embedding if not provided
    let embedding = memory.embedding;
    if (!embedding) {
      embedding = await this.embeddings.embed(memory.content);
    }

    // Store as document in vector store
    await this.vectorStore.addDocuments([
      {
        id,
        content: memory.content,
        metadata: {
          ...memory.metadata,
          memoryType: memory.type,
          timestamp: memory.metadata.timestamp.toISOString(),
        },
        embedding,
      },
    ]);

    return id;
  }

  async saveBatch(memories: Memory[]): Promise<string[]> {
    const ids: string[] = [];
    const documents = [];

    for (const memory of memories) {
      const id = memory.id || randomUUID();
      ids.push(id);

      let embedding = memory.embedding;
      if (!embedding) {
        embedding = await this.embeddings.embed(memory.content);
      }

      documents.push({
        id,
        content: memory.content,
        metadata: {
          ...memory.metadata,
          memoryType: memory.type,
          timestamp: memory.metadata.timestamp.toISOString(),
        },
        embedding,
      });
    }

    await this.vectorStore.addDocuments(documents);
    return ids;
  }

  async retrieve(query: MemoryQuery): Promise<Memory[]> {
    // Build metadata filter
    const filter: Record<string, any> = {};

    if (query.sessionId) {
      filter.sessionId = query.sessionId;
    }
    if (query.userId) {
      filter.userId = query.userId;
    }
    if (query.types && query.types.length > 0) {
      filter.memoryType = query.types;
    }

    // For date range and other filters, we'll need to fetch and filter
    const results = await this.vectorStore.search('', {
      topK: query.limit || 100,
      filter,
      includeMetadata: true,
      includeEmbedding: true,
    });

    // Convert search results to memories
    let memories = results.map((result) => this.searchResultToMemory(result));

    // Apply additional filters
    if (query.startDate) {
      memories = memories.filter(
        (m) => m.metadata.timestamp >= query.startDate!
      );
    }
    if (query.endDate) {
      memories = memories.filter((m) => m.metadata.timestamp <= query.endDate!);
    }
    if (query.minImportance !== undefined) {
      memories = memories.filter(
        (m) => (m.metadata.importance || 0) >= query.minImportance!
      );
    }
    if (query.entities && query.entities.length > 0) {
      memories = memories.filter((m) =>
        m.metadata.entities?.some((e) => query.entities!.includes(e))
      );
    }

    // Sort by timestamp
    memories.sort(
      (a, b) => b.metadata.timestamp.getTime() - a.metadata.timestamp.getTime()
    );

    return memories.slice(0, query.limit || 100);
  }

  async search(query: string, options: MemorySearchOptions): Promise<Memory[]> {
    // Build metadata filter
    const filter: Record<string, any> = {};

    if (options.sessionId) {
      filter.sessionId = options.sessionId;
    }
    if (options.userId) {
      filter.userId = options.userId;
    }
    if (options.types && options.types.length > 0) {
      filter.memoryType = options.types;
    }

    // Perform semantic search
    const results = await this.vectorStore.search(query, {
      topK: options.topK || 10,
      filter,
      includeMetadata: true,
      includeEmbedding: options.includeEmbedding,
      minScore: options.minScore,
    });

    // Convert to memories
    const memories = results.map((result) => this.searchResultToMemory(result));

    // Apply additional filters
    let filtered = memories;
    if (options.startDate) {
      filtered = filtered.filter((m) => m.metadata.timestamp >= options.startDate!);
    }
    if (options.endDate) {
      filtered = filtered.filter((m) => m.metadata.timestamp <= options.endDate!);
    }
    if (options.minImportance !== undefined) {
      filtered = filtered.filter(
        (m) => (m.metadata.importance || 0) >= options.minImportance!
      );
    }

    return filtered;
  }

  async get(id: string): Promise<Memory | null> {
    const doc = await this.vectorStore.getDocument(id);
    if (!doc) return null;

    return this.documentToMemory(doc);
  }

  async update(id: string, updates: Partial<Memory>): Promise<void> {
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Memory with id ${id} not found`);
    }

    const updated = {
      ...existing,
      ...updates,
      metadata: {
        ...existing.metadata,
        ...updates.metadata,
      },
    };

    // Re-generate embedding if content changed
    let embedding = updated.embedding;
    if (updates.content && updates.content !== existing.content) {
      embedding = await this.embeddings.embed(updated.content);
    }

    await this.vectorStore.updateDocument(id, {
      content: updated.content,
      metadata: {
        ...updated.metadata,
        memoryType: updated.type,
        timestamp: updated.metadata.timestamp.toISOString(),
      },
      embedding,
    });
  }

  async delete(id: string): Promise<void> {
    await this.vectorStore.deleteDocuments([id]);
  }

  async deleteBatch(ids: string[]): Promise<void> {
    await this.vectorStore.deleteDocuments(ids);
  }

  async clearSession(sessionId: string): Promise<void> {
    // Retrieve all memories for session
    const memories = await this.retrieve({ sessionId });
    const ids = memories.map((m) => m.id);
    
    if (ids.length > 0) {
      await this.deleteBatch(ids);
    }
  }

  async clear(): Promise<void> {
    await this.vectorStore.clear();
  }

  async summarize(options: SummarizeOptions): Promise<string> {
    const memories = await this.retrieve({
      sessionId: options.sessionId,
      limit: options.maxLength || 50,
    });

    if (memories.length === 0) {
      return 'No memories to summarize.';
    }

    const contents = memories.map((m) => m.content).join('\n');
    return contents.slice(0, options.maxLength || 1000);
  }

  async consolidate(memories: Memory[]): Promise<Memory> {
    if (memories.length === 0) {
      throw new Error('No memories to consolidate');
    }

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

    // Save consolidated memory
    await this.save(consolidated);

    // Optionally delete source memories
    // await this.deleteBatch(memories.map(m => m.id));

    return consolidated;
  }

  async getStats(sessionId?: string): Promise<MemoryStats> {
    const memories = await this.retrieve({
      sessionId,
      limit: 10000, // Large limit to get all
    });

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
    const memories = await this.retrieve({ limit: 10000 });
    const toDelete: string[] = [];

    for (const memory of memories) {
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
        toDelete.push(memory.id);
      }
    }

    if (toDelete.length > 0) {
      await this.deleteBatch(toDelete);
    }

    return toDelete.length;
  }

  /**
   * Convert search result to memory
   */
  private searchResultToMemory(result: any): Memory {
    return {
      id: result.id,
      type: result.metadata.memoryType as MemoryType,
      content: result.content,
      metadata: {
        ...result.metadata,
        timestamp: new Date(result.metadata.timestamp),
      },
      embedding: result.embedding,
    };
  }

  /**
   * Convert document to memory
   */
  private documentToMemory(doc: any): Memory {
    return {
      id: doc.id,
      type: doc.metadata.memoryType as MemoryType,
      content: doc.content,
      metadata: {
        ...doc.metadata,
        timestamp: new Date(doc.metadata.timestamp),
      },
      embedding: doc.embedding,
    };
  }
}
