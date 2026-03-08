/**
 * Query, options, and stats for memory stores.
 */

import { MemoryCategory } from './category.types';
import { MemoryItem } from './memory-item.types';

export interface MemoryQuery {
  userId: string;
  category?: MemoryCategory | MemoryCategory[];
  source?: import('./memory-item.types').MemorySource | import('./memory-item.types').MemorySource[];
  minConfidence?: number;
  notExpired?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt';
  order?: 'asc' | 'desc';
}

export interface MemorySearchOptions {
  userId: string;
  category?: MemoryCategory | MemoryCategory[];
  topK?: number;
  minScore?: number;
  vectorQuery?: number[];
}

export interface MemoryStats {
  total: number;
  byCategory: Record<MemoryCategory, number>;
  oldestMemory: Date | null;
  newestMemory: Date | null;
}

export interface PruneOptions {
  userId?: string;
  olderThan?: Date;
  minConfidence?: number;
  category?: MemoryCategory;
  maxItemsPerUser?: number;
}
