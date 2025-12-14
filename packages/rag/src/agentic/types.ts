/**
 * Agentic RAG Types
 * Core types and interfaces for agentic RAG capabilities
 */

import { SearchResult } from '../types';

/**
 * Query Plan - Decomposed query structure
 */
export interface QueryPlan {
  originalQuery: string;
  subQueries: SubQuery[];
  strategy: 'sequential' | 'parallel' | 'adaptive';
  estimatedComplexity: number;
}

export interface SubQuery {
  id: string;
  query: string;
  type: 'factual' | 'analytical' | 'comparative' | 'temporal';
  dependencies: string[];
  priority: number;
}

/**
 * Reasoning Chain - Multi-hop reasoning result
 */
export interface ReasoningChain {
  query: string;
  hops: ReasoningHop[];
  finalAnswer: string;
  confidence: number;
  sources: SearchResult[];
}

export interface ReasoningHop {
  hopNumber: number;
  query: string;
  results: SearchResult[];
  reasoning: string;
  nextQuery?: string;
}

/**
 * Reflection Result - Self-reflection output
 */
export interface ReflectionResult {
  originalResponse: string;
  quality: QualityAssessment;
  improvements: string[];
  revisedResponse?: string;
  iterations: number;
}

export interface QualityAssessment {
  score: number;
  relevance: number;
  completeness: number;
  accuracy: number;
  clarity: number;
  issues: string[];
}

/**
 * Verified Response - Response with source verification
 */
export interface VerifiedResponse {
  answer: string;
  sources: VerifiedSource[];
  overallConfidence: number;
  citations: Citation[];
}

export interface VerifiedSource extends SearchResult {
  verification: SourceVerification;
}

export interface SourceVerification {
  authorityScore: number;
  freshnessScore: number;
  relevanceScore: number;
  verified: boolean;
  issues: string[];
}

export interface Citation {
  text: string;
  sourceId: string;
  position: number;
  confidence: number;
}

/**
 * Context - Conversation and session context
 */
export interface Context {
  sessionId: string;
  userId?: string;
  conversationHistory: Message[];
  entities: Entity[];
  topics: Topic[];
  metadata: Record<string, unknown>;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface Entity {
  name: string;
  type: string;
  mentions: number;
  lastSeen: Date;
  attributes: Record<string, unknown>;
}

export interface Topic {
  name: string;
  relevance: number;
  keywords: string[];
}

/**
 * Feedback Data - User feedback for active learning
 */
export interface FeedbackData {
  resultId: string;
  rating: number;
  relevant: boolean;
  comments?: string;
  timestamp: Date;
  userId?: string;
}

/**
 * Graph Search Result - Knowledge graph retrieval result
 */
export interface GraphSearchResult extends SearchResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  path: string[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  properties: Record<string, unknown>;
}

/**
 * Adaptive Strategy Result
 */
export interface AdaptiveStrategyResult {
  selectedStrategy: string;
  reason: string;
  confidence: number;
  alternatives: Array<{
    strategy: string;
    score: number;
  }>;
}

/**
 * HyDE Result - Hypothetical Document Embeddings
 */
export interface HyDEResult {
  hypotheticalDocuments: string[];
  retrievedResults: SearchResult[];
  aggregatedScore: number;
}

/**
 * Corrective RAG Result
 */
export interface CorrectiveRAGResult {
  results: SearchResult[];
  corrections: Correction[];
  fallbackUsed: boolean;
  confidence: number;
}

export interface Correction {
  type: 'low_relevance' | 'missing_info' | 'contradictory';
  description: string;
  action: string;
}

/**
 * LLM Provider Interface for Agentic RAG
 */
export interface AgenticLLMProvider {
  generate(prompt: string, options?: LLMOptions): Promise<string>;
  generateStructured<T>(prompt: string, schema: unknown): Promise<T>;
  embed(text: string): Promise<number[]>;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

/**
 * Cache Entry
 */
export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

/**
 * Agentic RAG Configuration
 */
export interface AgenticRAGConfig {
  name: string;
  description?: string;
  llmProvider?: AgenticLLMProvider;
  enableCaching?: boolean;
  enableMetrics?: boolean;
  maxRetries?: number;
}
