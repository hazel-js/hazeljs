/**
 * RAG Service
 * Main service for RAG operations in HazelJS
 */

import { Injectable } from '@hazeljs/core';
import { RAGPipeline, LLMFunction } from './rag-pipeline';
import {
  VectorStore,
  EmbeddingProvider,
  TextSplitter,
  Document,
  SearchResult,
  QueryOptions,
  RetrievalStrategy,
} from './types';

export interface RAGServiceConfig {
  vectorStore: VectorStore;
  embeddingProvider: EmbeddingProvider;
  textSplitter?: TextSplitter;
  llmFunction?: LLMFunction;
  topK?: number;
}

@Injectable()
export class RAGService {
  private pipeline: RAGPipeline;

  constructor(private config: RAGServiceConfig) {
    this.pipeline = new RAGPipeline(
      {
        vectorStore: config.vectorStore,
        embeddingProvider: config.embeddingProvider,
        textSplitter: config.textSplitter,
        topK: config.topK,
      },
      config.llmFunction
    );
  }

  /**
   * Initialize the RAG service
   */
  async initialize(): Promise<void> {
    await this.pipeline.initialize();
  }

  /**
   * Index a document or multiple documents
   */
  async index(documents: Document | Document[]): Promise<string[]> {
    const docs = Array.isArray(documents) ? documents : [documents];
    return this.pipeline.addDocuments(docs);
  }

  /**
   * Search for similar documents
   */
  async search(
    query: string,
    options?: QueryOptions & { strategy?: RetrievalStrategy }
  ): Promise<SearchResult[]> {
    const { strategy, ...queryOptions } = options || {};
    return this.pipeline.retrieve(query, queryOptions, strategy);
  }

  /**
   * Retrieve relevant context for a query
   */
  async retrieve(query: string, options?: QueryOptions): Promise<SearchResult[]> {
    return this.pipeline.retrieve(query, options);
  }

  /**
   * Generate an answer using RAG
   */
  async generate(query: string, context: SearchResult[] | string): Promise<string> {
    if (!this.config.llmFunction) {
      throw new Error('LLM function not configured');
    }

    const contextStr =
      typeof context === 'string'
        ? context
        : context.map((r, idx) => `[${idx + 1}] ${r.content}`).join('\n\n');

    const prompt = `Based on the following context, answer the question.

Context:
${contextStr}

Question: ${query}

Answer:`;

    return this.config.llmFunction(prompt);
  }

  /**
   * Full RAG pipeline: retrieve + generate
   */
  async ask(
    query: string,
    options?: QueryOptions
  ): Promise<{ answer: string; sources: SearchResult[] }> {
    const sources = await this.retrieve(query, options);
    const answer = await this.generate(query, sources);
    return { answer, sources };
  }

  /**
   * Multi-query RAG
   * Generates multiple search queries and combines results
   */
  async multiQuery(question: string, _numQueries: number = 3): Promise<SearchResult[]> {
    // TODO: Implement query generation using LLM
    // For now, just use the original query
    return this.search(question, { topK: 10 });
  }

  /**
   * Compress retrieved context
   */
  async compress(documents: SearchResult[], _query: string): Promise<SearchResult[]> {
    // TODO: Implement context compression
    // For now, return top results
    return documents.slice(0, 5);
  }

  /**
   * Self-query with automatic metadata extraction
   */
  async selfQuery(naturalLanguageQuery: string): Promise<SearchResult[]> {
    // TODO: Implement metadata extraction from natural language
    // For now, just do regular search
    return this.search(naturalLanguageQuery);
  }

  /**
   * Conversational RAG with session memory
   */
  async chat(
    message: string,
    _sessionId: string
  ): Promise<{ answer: string; sources: SearchResult[] }> {
    // TODO: Implement conversation memory
    return this.ask(message);
  }

  /**
   * Hybrid search combining vector and keyword search
   */
  async hybridSearch(
    query: string,
    options?: QueryOptions & { vectorWeight?: number; keywordWeight?: number }
  ): Promise<SearchResult[]> {
    return this.search(query, { ...options, strategy: RetrievalStrategy.HYBRID });
  }

  /**
   * Rerank search results
   */
  async rerank(results: SearchResult[], _query: string, topN?: number): Promise<SearchResult[]> {
    // TODO: Implement reranking with external model
    // For now, return top N results
    return results.slice(0, topN || 5);
  }

  /**
   * Ensemble retrieval combining multiple methods
   */
  async ensemble(
    query: string,
    _methods: RetrievalStrategy[],
    _weights?: number[]
  ): Promise<SearchResult[]> {
    // TODO: Implement ensemble retrieval
    return this.search(query);
  }

  /**
   * Time-weighted retrieval favoring recent documents
   */
  async timeWeighted(query: string, decayRate: number = 0.01): Promise<SearchResult[]> {
    const results = await this.search(query, { includeMetadata: true });

    // Apply time decay to scores
    const now = Date.now();
    return results
      .map((result) => {
        const timestamp = result.metadata?.timestamp || now;
        const age = (now - timestamp) / (1000 * 60 * 60 * 24); // days
        const timeWeight = Math.exp(-decayRate * age);

        return {
          ...result,
          score: result.score * timeWeight,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Delete documents by IDs
   */
  async delete(ids: string[]): Promise<void> {
    await this.pipeline.deleteDocuments(ids);
  }

  /**
   * Clear all documents
   */
  async clear(): Promise<void> {
    await this.pipeline.clear();
  }
}
