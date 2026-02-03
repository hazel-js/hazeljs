/**
 * Memory Manager - High-level interface for managing different types of memory
 */

import { MemoryStore } from './memory-store.interface';
import {
  Memory,
  MemoryType,
  MemoryConfig,
  Message,
  Entity,
  MemoryQuery,
  MemorySearchOptions,
} from './types';
import { randomUUID } from 'crypto';

/**
 * Central manager for all memory operations
 * Provides high-level APIs for conversation, entity, fact, and working memory
 */
export class MemoryManager {
  private store: MemoryStore;
  private config: MemoryConfig;

  constructor(store: MemoryStore, config: MemoryConfig = {}) {
    this.store = store;
    this.config = {
      maxConversationLength: config.maxConversationLength || 20,
      summarizeAfter: config.summarizeAfter || 50,
      entityExtraction: config.entityExtraction ?? true,
      importanceScoring: config.importanceScoring ?? true,
      memoryDecay: config.memoryDecay ?? false,
      decayRate: config.decayRate || 0.1,
      maxWorkingMemorySize: config.maxWorkingMemorySize || 10,
      ...config,
    };
  }

  async initialize(): Promise<void> {
    await this.store.initialize();
  }

  // ==================== Conversation Memory ====================

  /**
   * Add a message to conversation history
   */
  async addMessage(message: Message, sessionId: string, userId?: string): Promise<string> {
    const memory: Memory = {
      id: randomUUID(),
      type: MemoryType.CONVERSATION,
      content: `${message.role}: ${message.content}`,
      metadata: {
        timestamp: message.timestamp || new Date(),
        sessionId,
        userId,
        role: message.role,
        importance: this.calculateImportance(message.content),
        ...message.metadata,
      },
    };

    const id = await this.store.save(memory);

    // Check if we need to summarize
    await this.checkAndSummarize(sessionId);

    return id;
  }

  /**
   * Get conversation history for a session
   */
  async getConversationHistory(sessionId: string, limit?: number): Promise<Message[]> {
    const memories = await this.store.retrieve({
      sessionId,
      types: [MemoryType.CONVERSATION],
      limit: limit || this.config.maxConversationLength,
    });

    return memories.map((m) => ({
      role: m.metadata.role as 'user' | 'assistant' | 'system',
      content: m.content.replace(/^(user|assistant|system): /, ''),
      timestamp: m.metadata.timestamp,
      metadata: m.metadata,
    }));
  }

  /**
   * Summarize conversation history
   */
  async summarizeConversation(sessionId: string): Promise<string> {
    return this.store.summarize({
      sessionId,
      maxLength: 1000,
      strategy: 'extractive',
    });
  }

  /**
   * Clear conversation history for a session
   */
  async clearConversation(sessionId: string): Promise<void> {
    const memories = await this.store.retrieve({
      sessionId,
      types: [MemoryType.CONVERSATION],
    });

    const ids = memories.map((m) => m.id);
    if (ids.length > 0) {
      await this.store.deleteBatch(ids);
    }
  }

  // ==================== Entity Memory ====================

  /**
   * Track an entity mentioned in conversation
   */
  async trackEntity(entity: Entity, sessionId?: string): Promise<void> {
    const memory: Memory = {
      id: randomUUID(),
      type: MemoryType.ENTITY,
      content: JSON.stringify(entity),
      metadata: {
        timestamp: new Date(),
        sessionId,
        entityName: entity.name,
        entityType: entity.type,
        entities: [entity.name],
        importance: 0.8,
      },
    };

    await this.store.save(memory);
  }

  /**
   * Get entity by name
   */
  async getEntity(name: string): Promise<Entity | null> {
    const memories = await this.store.retrieve({
      entities: [name],
      types: [MemoryType.ENTITY],
      limit: 1,
    });

    if (memories.length === 0) return null;

    try {
      return JSON.parse(memories[0].content) as Entity;
    } catch {
      return null;
    }
  }

  /**
   * Update entity information
   */
  async updateEntity(name: string, updates: Partial<Entity>): Promise<void> {
    const existing = await this.getEntity(name);
    if (!existing) {
      throw new Error(`Entity ${name} not found`);
    }

    const updated: Entity = {
      ...existing,
      ...updates,
      lastSeen: new Date(),
      mentions: existing.mentions + 1,
    };

    const memories = await this.store.retrieve({
      entities: [name],
      types: [MemoryType.ENTITY],
      limit: 1,
    });

    if (memories.length > 0) {
      await this.store.update(memories[0].id, {
        content: JSON.stringify(updated),
        metadata: {
          ...memories[0].metadata,
          timestamp: new Date(),
        },
      });
    }
  }

  /**
   * Get all tracked entities
   */
  async getAllEntities(sessionId?: string): Promise<Entity[]> {
    const memories = await this.store.retrieve({
      sessionId,
      types: [MemoryType.ENTITY],
      limit: 1000,
    });

    return memories
      .map((m) => {
        try {
          return JSON.parse(m.content) as Entity;
        } catch {
          return null;
        }
      })
      .filter((e): e is Entity => e !== null);
  }

  // ==================== Semantic Memory (Facts) ====================

  /**
   * Store a fact or piece of knowledge
   */
  async storeFact(fact: string, metadata?: Record<string, unknown>): Promise<string> {
    const memory: Memory = {
      id: randomUUID(),
      type: MemoryType.FACT,
      content: fact,
      metadata: {
        timestamp: new Date(),
        importance: this.calculateImportance(fact),
        ...metadata,
      },
    };

    return this.store.save(memory);
  }

  /**
   * Recall facts related to a query
   */
  async recallFacts(query: string, options?: MemorySearchOptions): Promise<string[]> {
    const memories = await this.store.search(query, {
      types: [MemoryType.FACT],
      topK: options?.topK || 5,
      ...options,
    });

    return memories.map((m) => m.content);
  }

  /**
   * Update a fact
   */
  async updateFact(id: string, newContent: string): Promise<void> {
    await this.store.update(id, {
      content: newContent,
      metadata: {
        timestamp: new Date(),
        updated: true,
      },
    });
  }

  // ==================== Working Memory ====================

  /**
   * Set a value in working memory (temporary context)
   */
  async setContext(key: string, value: unknown, sessionId: string): Promise<void> {
    // Check if context already exists
    const existing = await this.store.retrieve({
      sessionId,
      types: [MemoryType.WORKING],
      limit: 1000,
    });

    const existingContext = existing.find((m) => m.metadata.contextKey === key);

    if (existingContext) {
      // Update existing
      await this.store.update(existingContext.id, {
        content: JSON.stringify(value),
        metadata: {
          ...existingContext.metadata,
          timestamp: new Date(),
        },
      });
    } else {
      // Create new
      const memory: Memory = {
        id: randomUUID(),
        type: MemoryType.WORKING,
        content: JSON.stringify(value),
        metadata: {
          timestamp: new Date(),
          sessionId,
          contextKey: key,
          importance: 0.5,
        },
      };

      await this.store.save(memory);
    }

    // Enforce max working memory size
    await this.pruneWorkingMemory(sessionId);
  }

  /**
   * Get a value from working memory
   */
  async getContext(key: string, sessionId: string): Promise<unknown> {
    const memories = await this.store.retrieve({
      sessionId,
      types: [MemoryType.WORKING],
      limit: 1000,
    });

    const memory = memories.find((m) => m.metadata.contextKey === key);
    if (!memory) return null;

    try {
      return JSON.parse(memory.content);
    } catch {
      return memory.content;
    }
  }

  /**
   * Clear working memory for a session
   */
  async clearContext(sessionId: string): Promise<void> {
    const memories = await this.store.retrieve({
      sessionId,
      types: [MemoryType.WORKING],
    });

    const ids = memories.map((m) => m.id);
    if (ids.length > 0) {
      await this.store.deleteBatch(ids);
    }
  }

  // ==================== Memory Retrieval ====================

  /**
   * Get relevant memories for a query
   */
  async relevantMemories(query: string, options: MemorySearchOptions): Promise<Memory[]> {
    return this.store.search(query, options);
  }

  /**
   * Get memories by query parameters
   */
  async getMemories(query: MemoryQuery): Promise<Memory[]> {
    return this.store.retrieve(query);
  }

  /**
   * Get memory statistics
   */
  async getStats(sessionId?: string): Promise<import('./types').MemoryStats> {
    return this.store.getStats(sessionId);
  }

  // ==================== Private Helper Methods ====================

  /**
   * Calculate importance score for content
   */
  private calculateImportance(content: string): number {
    if (!this.config.importanceScoring) return 0.5;

    // Simple heuristic: longer content and questions are more important
    let score = 0.5;

    if (content.length > 100) score += 0.2;
    if (content.includes('?')) score += 0.1;
    if (content.includes('important') || content.includes('remember')) score += 0.2;

    return Math.min(score, 1.0);
  }

  /**
   * Check if conversation needs summarization
   */
  private async checkAndSummarize(sessionId: string): Promise<void> {
    if (!this.config.summarizeAfter) return;

    const memories = await this.store.retrieve({
      sessionId,
      types: [MemoryType.CONVERSATION],
      limit: 1000,
    });

    if (memories.length >= this.config.summarizeAfter) {
      // Summarize oldest messages
      const toSummarize = memories.slice(this.config.maxConversationLength!);

      if (toSummarize.length > 0) {
        await this.store.consolidate(toSummarize);

        // Delete original messages
        const ids = toSummarize.map((m) => m.id);
        await this.store.deleteBatch(ids);
      }
    }
  }

  /**
   * Prune working memory to max size
   */
  private async pruneWorkingMemory(sessionId: string): Promise<void> {
    const memories = await this.store.retrieve({
      sessionId,
      types: [MemoryType.WORKING],
      limit: 1000,
    });

    if (memories.length > this.config.maxWorkingMemorySize!) {
      // Remove oldest
      const toRemove = memories
        .sort((a, b) => a.metadata.timestamp.getTime() - b.metadata.timestamp.getTime())
        .slice(0, memories.length - this.config.maxWorkingMemorySize!);

      const ids = toRemove.map((m) => m.id);
      await this.store.deleteBatch(ids);
    }
  }
}
