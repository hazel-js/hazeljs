/**
 * RAG Pipeline
 * Main class for Retrieval-Augmented Generation
 */

import {
  RAGConfig,
  RAGQueryOptions,
  RAGResponse,
  Document,
  SearchResult,
  RetrievalStrategy,
} from './types';

export type LLMFunction = (prompt: string) => Promise<string>;

export class RAGPipeline {
  private config: RAGConfig;
  private llmFunction?: LLMFunction;

  constructor(config: RAGConfig, llmFunction?: LLMFunction) {
    this.config = config;
    this.llmFunction = llmFunction;
  }

  /**
   * Initialize the RAG pipeline
   */
  async initialize(): Promise<void> {
    await this.config.vectorStore.initialize();
  }

  /**
   * Add documents to the knowledge base
   */
  async addDocuments(documents: Document[]): Promise<string[]> {
    let processedDocs = documents;

    // Split documents if text splitter is configured
    if (this.config.textSplitter) {
      processedDocs = this.config.textSplitter.splitDocuments(documents);
    }

    return this.config.vectorStore.addDocuments(processedDocs);
  }

  /**
   * Query the RAG system
   */
  async query(query: string, options: RAGQueryOptions = {}): Promise<RAGResponse> {
    const {
      topK = this.config.topK || 5,
      strategy = RetrievalStrategy.SIMILARITY,
      llmPrompt,
      includeContext = true,
      ...searchOptions
    } = options;

    // Retrieve relevant documents
    const sources = await this.retrieve(query, { ...searchOptions, topK }, strategy);

    // Build context from sources
    const context = this.buildContext(sources);

    // Generate answer using LLM if available
    let answer = '';
    if (this.llmFunction && llmPrompt) {
      answer = await this.generateAnswer(query, context, llmPrompt);
    } else {
      answer = context; // Return context if no LLM
    }

    return {
      answer,
      sources,
      context: includeContext ? context : '',
    };
  }

  /**
   * Retrieve relevant documents
   */
  async retrieve(
    query: string,
    options: RAGQueryOptions = {},
    strategy: RetrievalStrategy = RetrievalStrategy.SIMILARITY
  ): Promise<SearchResult[]> {
    switch (strategy) {
      case RetrievalStrategy.SIMILARITY:
        return this.config.vectorStore.search(query, options);

      case RetrievalStrategy.MMR:
        return this.retrieveWithMMR(query, options);

      case RetrievalStrategy.HYBRID:
        return this.retrieveHybrid(query, options);

      default:
        return this.config.vectorStore.search(query, options);
    }
  }

  /**
   * Retrieve with Maximal Marginal Relevance (MMR)
   * Balances relevance and diversity
   */
  private async retrieveWithMMR(
    query: string,
    options: RAGQueryOptions = {}
  ): Promise<SearchResult[]> {
    const { topK = 5, ...searchOptions } = options;

    // Get more results than needed for MMR selection
    const candidates = await this.config.vectorStore.search(query, {
      ...searchOptions,
      topK: topK * 3,
      includeEmbedding: true,
    });

    if (candidates.length === 0) return [];

    // Get query embedding (not used in MMR, but kept for potential future use)
    await this.config.embeddingProvider.embed(query);

    // MMR algorithm
    const selected: SearchResult[] = [];
    const lambda = 0.5; // Balance between relevance and diversity

    while (selected.length < topK && candidates.length > 0) {
      let bestScore = -Infinity;
      let bestIdx = -1;

      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        if (!candidate.embedding) continue;

        // Calculate relevance to query
        const relevance = candidate.score;

        // Calculate max similarity to already selected documents
        let maxSimilarity = 0;
        for (const selectedDoc of selected) {
          if (!selectedDoc.embedding) continue;
          const similarity = this.cosineSimilarity(candidate.embedding, selectedDoc.embedding);
          maxSimilarity = Math.max(maxSimilarity, similarity);
        }

        // MMR score
        const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0) {
        selected.push(candidates[bestIdx]);
        candidates.splice(bestIdx, 1);
      } else {
        break;
      }
    }

    return selected;
  }

  /**
   * Hybrid retrieval (combines keyword and semantic search)
   * For now, just returns semantic search results
   * TODO: Implement keyword search integration
   */
  private async retrieveHybrid(
    query: string,
    options: RAGQueryOptions = {}
  ): Promise<SearchResult[]> {
    // For now, fallback to similarity search
    // In production, this would combine BM25 or other keyword search with vector search
    return this.config.vectorStore.search(query, options);
  }

  /**
   * Build context string from search results
   */
  private buildContext(results: SearchResult[]): string {
    return results
      .map((result, idx) => {
        const metadata = result.metadata ? `\nMetadata: ${JSON.stringify(result.metadata)}` : '';
        return `[${idx + 1}] ${result.content}${metadata}`;
      })
      .join('\n\n');
  }

  /**
   * Generate answer using LLM
   */
  private async generateAnswer(query: string, context: string, prompt: string): Promise<string> {
    if (!this.llmFunction) {
      throw new Error('LLM function not configured');
    }

    const fullPrompt = prompt.replace('{context}', context).replace('{query}', query);

    return this.llmFunction(fullPrompt);
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Delete documents from the knowledge base
   */
  async deleteDocuments(ids: string[]): Promise<void> {
    await this.config.vectorStore.deleteDocuments(ids);
  }

  /**
   * Clear all documents
   */
  async clear(): Promise<void> {
    await this.config.vectorStore.clear();
  }
}
