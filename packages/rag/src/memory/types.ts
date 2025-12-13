/**
 * Memory types and interfaces for persistent context management
 */

/**
 * Types of memory
 */
export enum MemoryType {
  CONVERSATION = 'conversation',
  ENTITY = 'entity',
  FACT = 'fact',
  EVENT = 'event',
  WORKING = 'working',
}

/**
 * Message in a conversation
 */
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Memory object
 */
export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  metadata: {
    timestamp: Date;
    userId?: string;
    sessionId?: string;
    importance?: number;
    entities?: string[];
    expiresAt?: Date;
    [key: string]: unknown;
  };
  embedding?: number[];
}

/**
 * Entity tracked in memory
 */
export interface Entity {
  name: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships: Array<{
    type: string;
    target: string;
  }>;
  firstSeen: Date;
  lastSeen: Date;
  mentions: number;
}

/**
 * Memory query options
 */
export interface MemoryQuery {
  sessionId?: string;
  userId?: string;
  types?: MemoryType[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  minImportance?: number;
  entities?: string[];
}

/**
 * Memory search options
 */
export interface MemorySearchOptions extends MemoryQuery {
  topK?: number;
  minScore?: number;
  includeEmbedding?: boolean;
}

/**
 * Summarization options
 */
export interface SummarizeOptions {
  sessionId?: string;
  maxLength?: number;
  strategy?: 'extractive' | 'abstractive';
}

/**
 * Memory configuration
 */
export interface MemoryConfig {
  maxConversationLength?: number;
  summarizeAfter?: number;
  entityExtraction?: boolean;
  importanceScoring?: boolean;
  memoryDecay?: boolean;
  decayRate?: number;
  maxWorkingMemorySize?: number;
}

/**
 * Conversation summary
 */
export interface ConversationSummary {
  sessionId: string;
  summary: string;
  messageCount: number;
  startTime: Date;
  endTime: Date;
  entities: string[];
  topics: string[];
}

/**
 * Memory statistics
 */
export interface MemoryStats {
  totalMemories: number;
  byType: Record<MemoryType, number>;
  oldestMemory: Date;
  newestMemory: Date;
  averageImportance: number;
}
