/**
 * BM25 (Best Matching 25) - Keyword-based ranking algorithm
 * Used for hybrid search combining with vector similarity
 */

export interface BM25Document {
  id: string;
  content: string;
  tokens: string[];
}

export interface BM25Config {
  k1?: number; // Term frequency saturation parameter (default: 1.5)
  b?: number;  // Length normalization parameter (default: 0.75)
}

export class BM25 {
  private documents: BM25Document[] = [];
  private idf: Map<string, number> = new Map();
  private avgDocLength: number = 0;
  private k1: number;
  private b: number;

  constructor(config: BM25Config = {}) {
    this.k1 = config.k1 || 1.5;
    this.b = config.b || 0.75;
  }

  /**
   * Add documents to the BM25 index
   */
  addDocuments(documents: BM25Document[]): void {
    this.documents.push(...documents);
    this.calculateIDF();
    this.calculateAvgDocLength();
  }

  /**
   * Search documents using BM25 scoring
   */
  search(query: string, topK: number = 5): Array<{ id: string; score: number }> {
    const queryTokens = this.tokenize(query);
    const scores: Array<{ id: string; score: number }> = [];

    for (const doc of this.documents) {
      const score = this.calculateScore(queryTokens, doc);
      scores.push({ id: doc.id, score });
    }

    // Sort by score descending and return top K
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Calculate BM25 score for a document given query tokens
   */
  private calculateScore(queryTokens: string[], doc: BM25Document): number {
    let score = 0;

    for (const token of queryTokens) {
      const idf = this.idf.get(token) || 0;
      const tf = this.termFrequency(token, doc.tokens);
      const docLength = doc.tokens.length;

      // BM25 formula
      const numerator = tf * (this.k1 + 1);
      const denominator =
        tf + this.k1 * (1 - this.b + this.b * (docLength / this.avgDocLength));

      score += idf * (numerator / denominator);
    }

    return score;
  }

  /**
   * Calculate Inverse Document Frequency for all terms
   */
  private calculateIDF(): void {
    const termDocCount = new Map<string, number>();
    const N = this.documents.length;

    // Count documents containing each term
    for (const doc of this.documents) {
      const uniqueTokens = new Set(doc.tokens);
      for (const token of uniqueTokens) {
        termDocCount.set(token, (termDocCount.get(token) || 0) + 1);
      }
    }

    // Calculate IDF for each term
    for (const [term, docCount] of termDocCount.entries()) {
      // IDF = log((N - df + 0.5) / (df + 0.5) + 1)
      const idf = Math.log((N - docCount + 0.5) / (docCount + 0.5) + 1);
      this.idf.set(term, idf);
    }
  }

  /**
   * Calculate average document length
   */
  private calculateAvgDocLength(): void {
    const totalLength = this.documents.reduce(
      (sum, doc) => sum + doc.tokens.length,
      0
    );
    this.avgDocLength = totalLength / this.documents.length || 1;
  }

  /**
   * Calculate term frequency in document
   */
  private termFrequency(term: string, tokens: string[]): number {
    return tokens.filter((t) => t === term).length;
  }

  /**
   * Tokenize text into terms
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 0);
  }

  /**
   * Clear all documents
   */
  clear(): void {
    this.documents = [];
    this.idf.clear();
    this.avgDocLength = 0;
  }
}
