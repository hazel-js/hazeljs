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
import { BM25, BM25Document } from './retrieval/bm25';
import { OpenAIEmbeddings } from './embeddings/openai-embeddings';
import { CohereEmbeddings } from './embeddings/cohere-embeddings';
import { MemoryVectorStore } from './vector-stores/memory-vector-store';
import { RecursiveTextSplitter } from './text-splitters/recursive-text-splitter';

export type LLMFunction = (prompt: string) => Promise<string>;

/**
 * Shorthand configuration for `RAGPipeline.from()`.
 *
 * Only `provider` (or `apiKey`) is required — everything else has sensible defaults.
 */
export interface RAGPipelineQuickConfig {
  /** Embedding provider name. Defaults to `'openai'`. */
  provider?: 'openai' | 'cohere';
  /** API key for the embedding provider. Falls back to `OPENAI_API_KEY` / `COHERE_API_KEY` env vars. */
  apiKey?: string;
  /** Embedding model name (provider-specific). */
  embeddingModel?: string;
  /** Vector store to use. Defaults to in-memory. */
  vectorStore?: 'memory';
  /** Number of results to return. Default: 5. */
  topK?: number;
  /** Chunk size for text splitting. Default: 1000. */
  chunkSize?: number;
  /** Chunk overlap for text splitting. Default: 200. */
  chunkOverlap?: number;
  /** LLM function for answer generation. */
  llm?: LLMFunction;
}

export class RAGPipeline {
  private config: RAGConfig;
  private llmFunction?: LLMFunction;
  private bm25: BM25;
  private bm25Indexed: boolean = false;

  constructor(config: RAGConfig, llmFunction?: LLMFunction) {
    this.config = config;
    this.llmFunction = llmFunction;
    this.bm25 = new BM25();
  }

  /**
   * Create a RAGPipeline with sensible defaults from minimal configuration.
   *
   * @example
   * ```ts
   * const pipeline = RAGPipeline.from({ provider: 'openai', topK: 5, llm: myLLM });
   * await pipeline.initialize();
   * await pipeline.addDocuments(docs);
   * const result = await pipeline.query('What is X?');
   * ```
   */
  static from(quick: RAGPipelineQuickConfig = {}): RAGPipeline {
    const provider = quick.provider ?? 'openai';

    // Resolve embedding provider
    let embeddingProvider;
    switch (provider) {
      case 'cohere': {
        const apiKey = quick.apiKey ?? process.env.COHERE_API_KEY;
        if (!apiKey) {
          throw new Error(
            'RAGPipeline.from(): Missing API key for Cohere. ' +
              'Pass `apiKey` or set the COHERE_API_KEY environment variable.'
          );
        }
        embeddingProvider = new CohereEmbeddings({
          apiKey,
          model: quick.embeddingModel,
        });
        break;
      }
      case 'openai':
      default: {
        const apiKey = quick.apiKey ?? process.env.OPENAI_API_KEY;
        if (!apiKey) {
          throw new Error(
            'RAGPipeline.from(): Missing API key for OpenAI. ' +
              'Pass `apiKey` or set the OPENAI_API_KEY environment variable.'
          );
        }
        embeddingProvider = new OpenAIEmbeddings({
          apiKey,
          model: quick.embeddingModel,
        });
        break;
      }
    }

    // Resolve vector store (currently only memory; extensible later)
    const vectorStore = new MemoryVectorStore(embeddingProvider);

    // Resolve text splitter
    const textSplitter = new RecursiveTextSplitter({
      chunkSize: quick.chunkSize ?? 1000,
      chunkOverlap: quick.chunkOverlap ?? 200,
    });

    return new RAGPipeline(
      {
        vectorStore,
        embeddingProvider,
        textSplitter,
        topK: quick.topK ?? 5,
      },
      quick.llm
    );
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

    const ids = await this.config.vectorStore.addDocuments(processedDocs);

    // Index in BM25 for hybrid search
    const bm25Docs: BM25Document[] = processedDocs.map((doc, i) => ({
      id: doc.id || ids[i],
      content: doc.content,
      tokens: doc.content
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 0),
    }));
    this.bm25.addDocuments(bm25Docs);
    this.bm25Indexed = true;

    return ids;
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
    let results: SearchResult[];

    switch (strategy) {
      case RetrievalStrategy.SIMILARITY:
        results = await this.config.vectorStore.search(query, options);
        break;
      case RetrievalStrategy.MMR:
        results = await this.retrieveWithMMR(query, options);
        break;
      case RetrievalStrategy.HYBRID:
        results = await this.retrieveHybrid(query, options);
        break;
      default:
        results = await this.config.vectorStore.search(query, options);
        break;
    }

    // Apply reranker if configured
    if (this.config.reranker && results.length > 0) {
      results = await this.config.reranker.rerank(
        query,
        results,
        options.topK || this.config.topK || 5
      );
    }

    return results;
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
   * Hybrid retrieval — combines BM25 keyword search with vector similarity.
   * Uses weighted score fusion (default 0.7 vector, 0.3 keyword).
   */
  private async retrieveHybrid(
    query: string,
    options: RAGQueryOptions = {}
  ): Promise<SearchResult[]> {
    const topK = options.topK || this.config.topK || 5;

    // Always run vector search
    const vectorResults = await this.config.vectorStore.search(query, {
      ...options,
      topK: topK * 2,
    });

    // If BM25 hasn't been indexed yet, fall back to vector-only
    if (!this.bm25Indexed) {
      return vectorResults.slice(0, topK);
    }

    // BM25 keyword search
    const keywordResults = this.bm25.search(query, topK * 2);

    // Normalize scores to [0, 1]
    const normalize = (items: Array<{ id: string; score: number }>): Map<string, number> => {
      if (items.length === 0) return new Map<string, number>();
      const scores = items.map((r) => r.score);
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      const range = max - min || 1;
      return new Map(items.map((r) => [r.id, (r.score - min) / range]));
    };

    const vectorScores = normalize(vectorResults.map((r) => ({ id: r.id, score: r.score })));
    const keywordScores = normalize(keywordResults);

    const vectorWeight = 0.7;
    const keywordWeight = 0.3;

    // Fuse scores
    const allIds = new Set([...vectorScores.keys(), ...keywordScores.keys()]);
    const fused: Array<{ id: string; score: number }> = [];

    for (const id of allIds) {
      const vs = vectorScores.get(id) || 0;
      const ks = keywordScores.get(id) || 0;
      fused.push({ id, score: vectorWeight * vs + keywordWeight * ks });
    }

    fused.sort((a, b) => b.score - a.score);

    // Map back to full SearchResult objects
    const resultMap = new Map(vectorResults.map((r) => [r.id, r]));
    return fused
      .slice(0, topK)
      .map((f) => {
        const original = resultMap.get(f.id);
        if (original) return { ...original, score: f.score };
        return null;
      })
      .filter((r): r is SearchResult => r !== null);
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
    this.bm25.clear();
    this.bm25Indexed = false;
  }
}
