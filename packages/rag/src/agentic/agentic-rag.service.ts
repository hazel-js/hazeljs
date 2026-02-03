/**
 * Agentic RAG Service
 * Main service class demonstrating all agentic RAG capabilities
 */

import { VectorStore, SearchResult, QueryOptions } from '../types';
import { AgenticLLMProvider } from './types';
import {
  QueryPlanner,
  SelfReflective,
  AdaptiveRetrieval,
  MultiHop,
  HyDE,
  CorrectiveRAG,
  ContextAware,
  QueryRewriter,
  SourceVerification,
  ActiveLearning,
  Feedback,
  Cached,
} from './decorators';

export interface AgenticRAGServiceConfig {
  vectorStore: VectorStore;
  llmProvider?: AgenticLLMProvider;
  enableAllFeatures?: boolean;
}

export class AgenticRAGService {
  private vectorStore: VectorStore;
  private llmProvider?: AgenticLLMProvider;

  constructor(config: AgenticRAGServiceConfig) {
    this.vectorStore = config.vectorStore;
    this.llmProvider = config.llmProvider;
  }

  /**
   * Basic retrieval with all agentic features
   */
  @QueryPlanner({ decompose: true, maxSubQueries: 5, parallel: true })
  @SelfReflective({ maxIterations: 3, qualityThreshold: 0.8 })
  @AdaptiveRetrieval({ autoSelect: true, contextAware: true })
  @Cached({ ttl: 3600 })
  async retrieve(query: string, options?: QueryOptions): Promise<SearchResult[]> {
    return this.vectorStore.search(query, options);
  }

  /**
   * Advanced retrieval with HyDE
   */
  @HyDE({ generateHypothesis: true, numHypotheses: 3 })
  @CorrectiveRAG({ relevanceThreshold: 0.7, fallbackToWeb: true })
  @Cached({ ttl: 1800 })
  async hydeRetrieve(query: string, options?: QueryOptions): Promise<SearchResult[]> {
    return this.vectorStore.search(query, options);
  }

  /**
   * Multi-hop reasoning retrieval
   */
  @MultiHop({ maxHops: 3, strategy: 'breadth-first' })
  async deepRetrieve(query: string, options?: QueryOptions): Promise<SearchResult[]> {
    return this.vectorStore.search(query, options);
  }

  /**
   * Context-aware conversational retrieval
   */
  @ContextAware({ windowSize: 5, entityTracking: true, topicModeling: true })
  @QueryRewriter({ techniques: ['expansion', 'synonym'], llmBased: true })
  @Cached({ ttl: 600 })
  async conversationalRetrieve(
    query: string,
    sessionId: string,
    options?: QueryOptions
  ): Promise<SearchResult[]> {
    return this.vectorStore.search(query, {
      ...options,
      sessionId: sessionId as unknown,
    } as QueryOptions);
  }

  /**
   * Verified retrieval with source checking
   */
  @SourceVerification({
    checkFreshness: true,
    verifyAuthority: true,
    requireCitations: true,
  })
  @SelfReflective({ maxIterations: 2, qualityThreshold: 0.85 })
  async verifiedRetrieve(query: string, options?: QueryOptions): Promise<SearchResult[]> {
    return this.vectorStore.search(query, options);
  }

  /**
   * Learning-enabled retrieval
   */
  @ActiveLearning({ feedbackEnabled: true, retrainThreshold: 100 })
  @AdaptiveRetrieval({ autoSelect: true })
  async learningRetrieve(query: string, options?: QueryOptions): Promise<SearchResult[]> {
    return this.vectorStore.search(query, options);
  }

  /**
   * Provide feedback for active learning
   */
  @Feedback()
  async provideFeedback(_resultId: string, _rating: number, _relevant: boolean): Promise<void> {
    // Feedback is stored by decorator
  }

  /**
   * Combined: All features enabled
   */
  @QueryPlanner({ decompose: true, maxSubQueries: 5 })
  @SelfReflective({ maxIterations: 3, qualityThreshold: 0.8 })
  @AdaptiveRetrieval({ autoSelect: true, contextAware: true })
  @HyDE({ generateHypothesis: true, numHypotheses: 2 })
  @CorrectiveRAG({ relevanceThreshold: 0.7 })
  @ContextAware({ windowSize: 5, entityTracking: true })
  @QueryRewriter({ techniques: ['expansion', 'synonym'] })
  @SourceVerification({ checkFreshness: true, verifyAuthority: true })
  @ActiveLearning({ feedbackEnabled: true })
  @Cached({ ttl: 3600 })
  async superRetrieve(
    query: string,
    sessionId: string,
    options?: QueryOptions
  ): Promise<SearchResult[]> {
    return this.vectorStore.search(query, {
      ...options,
      sessionId: sessionId as unknown,
    } as QueryOptions);
  }
}
