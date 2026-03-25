/**
 * Cohere Reranker
 *
 * Uses Cohere's Rerank API to re-order search results by relevance to the query.
 * This significantly improves RAG retrieval quality compared to pure vector search.
 */

import { Reranker, SearchResult } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CohereClientType = any;

export interface CohereRerankerConfig {
  /** Cohere API Key */
  apiKey: string;
  /**
   * The model to use.
   * Default: rerank-english-v3.0
   * Other options: rerank-multilingual-v3.0
   */
  model?: string;
  /** Number of maximum chunks per document (defaults to 10) */
  maxChunksPerDoc?: number;
}

export class CohereReranker implements Reranker {
  private client: CohereClientType;
  private model: string;
  private maxChunksPerDoc: number;

  constructor(config: CohereRerankerConfig) {
    // Dynamically require to avoid hard peer dependency
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CohereClient } = require('cohere-ai');
    this.client = new CohereClient({ token: config.apiKey });
    this.model = config.model || 'rerank-english-v3.0';
    this.maxChunksPerDoc = config.maxChunksPerDoc || 10;
  }

  /**
   * Reranks SearchResult objects based on how relevant they are to the given query.
   *
   * @param query The user's search query
   * @param results The potentially relevant documents (e.g. from a vector store)
   * @param topN How many top results to return (defaults to all returned results)
   */
  async rerank(query: string, results: SearchResult[], topN?: number): Promise<SearchResult[]> {
    if (!results || results.length === 0) {
      return [];
    }

    // Prepare documents for Cohere API (must be strings or objects with text)
    const documents = results.map((r) => r.content);

    try {
      const response = await this.client.rerank({
        model: this.model,
        query,
        documents,
        topN: topN || results.length,
        maxChunksPerDoc: this.maxChunksPerDoc,
        returnDocuments: false, // We already have the documents in `results` array
      });

      // The response returns items with indices and relevance scores
      // Re-map the newly scored results back to our SearchResult format
      const reranked: SearchResult[] = response.results.map(
        (item: { index: number; relevanceScore: number }) => {
          const originalResult = results[item.index];
          return {
            ...originalResult,
            score: item.relevanceScore, // Override with the superior rerank score
          };
        }
      );

      return reranked;
    } catch (error) {
      throw new Error(`Failed to rerank results using Cohere: ${error}`);
    }
  }
}
