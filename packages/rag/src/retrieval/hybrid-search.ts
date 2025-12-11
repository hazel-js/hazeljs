/**
 * Hybrid Search - Combines vector similarity and keyword search (BM25)
 */

import { VectorStore, SearchResult, QueryOptions } from '../types';
import { BM25, BM25Document } from './bm25';

export interface HybridSearchConfig {
  vectorWeight?: number;    // Weight for vector search (default: 0.7)
  keywordWeight?: number;   // Weight for keyword search (default: 0.3)
  bm25Config?: {
    k1?: number;
    b?: number;
  };
}

export class HybridSearchRetrieval {
  private vectorStore: VectorStore;
  private bm25: BM25;
  private vectorWeight: number;
  private keywordWeight: number;
  private documentsIndexed: boolean = false;

  constructor(vectorStore: VectorStore, config: HybridSearchConfig = {}) {
    this.vectorStore = vectorStore;
    this.vectorWeight = config.vectorWeight || 0.7;
    this.keywordWeight = config.keywordWeight || 0.3;
    this.bm25 = new BM25(config.bm25Config);

    // Validate weights sum to 1
    const totalWeight = this.vectorWeight + this.keywordWeight;
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      throw new Error('Vector and keyword weights must sum to 1.0');
    }
  }

  /**
   * Index documents for hybrid search
   */
  async indexDocuments(documents: Array<{ id: string; content: string }>): Promise<void> {
    // Prepare BM25 documents
    const bm25Docs: BM25Document[] = documents.map((doc) => ({
      id: doc.id,
      content: doc.content,
      tokens: this.tokenize(doc.content),
    }));

    this.bm25.addDocuments(bm25Docs);
    this.documentsIndexed = true;
  }

  /**
   * Perform hybrid search combining vector and keyword search
   */
  async search(
    query: string,
    options?: QueryOptions
  ): Promise<SearchResult[]> {
    if (!this.documentsIndexed) {
      throw new Error('Documents must be indexed before searching');
    }

    const topK = options?.topK || 10;

    // Perform vector search
    const vectorResults = await this.vectorStore.search(query, {
      ...options,
      topK: topK * 2, // Get more results for fusion
    });

    // Perform BM25 keyword search
    const keywordResults = this.bm25.search(query, topK * 2);

    // Combine and re-rank results
    const hybridResults = this.fuseResults(vectorResults, keywordResults);

    // Return top K results
    return hybridResults.slice(0, topK);
  }

  /**
   * Fuse vector and keyword results using weighted scores
   */
  private fuseResults(
    vectorResults: SearchResult[],
    keywordResults: Array<{ id: string; score: number }>
  ): SearchResult[] {
    // Normalize scores to 0-1 range
    const normalizedVector = this.normalizeScores(
      vectorResults.map((r) => ({ id: r.id, score: r.score }))
    );
    const normalizedKeyword = this.normalizeScores(keywordResults);

    // Create score maps
    const vectorScores = new Map(normalizedVector.map((r) => [r.id, r.score]));
    const keywordScores = new Map(normalizedKeyword.map((r) => [r.id, r.score]));

    // Get all unique document IDs
    const allIds = new Set([
      ...vectorResults.map((r) => r.id),
      ...keywordResults.map((r) => r.id),
    ]);

    // Calculate hybrid scores
    const hybridScores: Array<{ id: string; score: number; result: SearchResult }> = [];

    for (const id of allIds) {
      const vectorScore = vectorScores.get(id) || 0;
      const keywordScore = keywordScores.get(id) || 0;

      const hybridScore =
        this.vectorWeight * vectorScore + this.keywordWeight * keywordScore;

      // Find the original result
      const result = vectorResults.find((r) => r.id === id);
      if (result) {
        hybridScores.push({
          id,
          score: hybridScore,
          result: { ...result, score: hybridScore },
        });
      }
    }

    // Sort by hybrid score
    return hybridScores
      .sort((a, b) => b.score - a.score)
      .map((item) => item.result);
  }

  /**
   * Normalize scores to 0-1 range using min-max normalization
   */
  private normalizeScores(
    results: Array<{ id: string; score: number }>
  ): Array<{ id: string; score: number }> {
    if (results.length === 0) {
      return [];
    }

    const scores = results.map((r) => r.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min;

    if (range === 0) {
      return results.map((r) => ({ id: r.id, score: 1.0 }));
    }

    return results.map((r) => ({
      id: r.id,
      score: (r.score - min) / range,
    }));
  }

  /**
   * Tokenize text
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 0);
  }

  /**
   * Clear indexed documents
   */
  clear(): void {
    this.bm25.clear();
    this.documentsIndexed = false;
  }
}
