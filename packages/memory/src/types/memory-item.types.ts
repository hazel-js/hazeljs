/**
 * Core memory item schema (explicit / inferred / system).
 */

import { MemoryCategory } from './category.types';

export type MemorySource = 'explicit' | 'inferred' | 'system';

/**
 * Value can be string, structured object, or embedding vector.
 */
export type MemoryValue = string | Record<string, unknown> | number[];

export interface MemoryItem {
  id: string;
  userId: string;
  category: MemoryCategory;
  key: string;
  value: MemoryValue;
  confidence: number;
  source: MemorySource;
  evidence: string[];
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  accessCount: number;
  sessionId?: string;
}

/**
 * Input for creating a memory (id and timestamps can be omitted).
 */
export interface MemoryItemInput
  extends Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt' | 'accessCount'> {
  id?: string;
  accessCount?: number;
}
