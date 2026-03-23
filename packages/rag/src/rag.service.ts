/**
 * RAG Service
 * Main service for RAG operations in HazelJS
 */

import { Service } from '@hazeljs/core';
import { RAGPipeline, LLMFunction } from './rag-pipeline';
import { PromptRegistry } from '@hazeljs/prompts';
import './prompts/rag-answer.prompt';
import { RAG_ANSWER_KEY } from './prompts/rag-answer.prompt';
import {
  VectorStore,
  EmbeddingProvider,
  TextSplitter,
  Document,
  SearchResult,
  QueryOptions,
  RetrievalStrategy,
} from './types';
import { MultiQueryRetrieval } from './retrieval/multi-query';
import { HybridSearchRetrieval } from './retrieval/hybrid-search';
import { BM25, BM25Document } from './retrieval/bm25';
import { TextFileLoader } from './loaders/text-file.loader';
import { JSONFileLoader } from './loaders/json-file.loader';
import { CSVFileLoader } from './loaders/csv-file.loader';
import { MarkdownFileLoader } from './loaders/markdown-file.loader';
import { HTMLFileLoader } from './loaders/html-file.loader';
import { DirectoryLoader } from './loaders/directory.loader';
import { WebLoader } from './loaders/web.loader';
import { debug } from './utils/debug';

const dbg = debug('rag');

export interface RAGServiceConfig {
  vectorStore: VectorStore;
  embeddingProvider: EmbeddingProvider;
  textSplitter?: TextSplitter;
  llmFunction?: LLMFunction;
  topK?: number;
  /** Custom query generator for multi-query retrieval (uses simple variations if not set). */
  queryGenerator?: (question: string, numQueries: number) => Promise<string[]>;
  /** Weights for hybrid search. Defaults: vectorWeight=0.7, keywordWeight=0.3. */
  hybridWeights?: { vectorWeight?: number; keywordWeight?: number };
}

@Service()
export class RAGService {
  private pipeline: RAGPipeline;
  private multiQueryRetrieval?: MultiQueryRetrieval;
  private hybridRetrieval?: HybridSearchRetrieval;
  private bm25: BM25;
  private conversationHistory: Map<string, Array<{ role: string; content: string }>> = new Map();

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

    // Initialize BM25 for keyword search
    this.bm25 = new BM25();

    // Initialize multi-query retrieval
    this.multiQueryRetrieval = new MultiQueryRetrieval(config.vectorStore, {
      customGenerator: config.queryGenerator,
    });

    // Initialize hybrid search
    this.hybridRetrieval = new HybridSearchRetrieval(config.vectorStore, {
      vectorWeight: config.hybridWeights?.vectorWeight ?? 0.7,
      keywordWeight: config.hybridWeights?.keywordWeight ?? 0.3,
    });
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
   * Ingest documents from a file path, URL, or directory.
   * Auto-detects the source type and uses the appropriate loader.
   *
   * @example
   * ```ts
   * await rag.ingest('./docs/guide.pdf');
   * await rag.ingest('./data/faq.csv');
   * await rag.ingest('https://example.com/page');
   * await rag.ingest('./knowledge-base/');  // loads entire directory
   * ```
   */
  async ingest(source: string): Promise<string[]> {
    dbg('ingest start source=%s', source);
    const docs = await this.loadSource(source);
    dbg('ingest loaded docs=%d', docs.length);
    const ids = await this.index(docs);
    dbg('ingest complete ids=%d', ids.length);
    return ids;
  }

  /**
   * Auto-detect source type and load documents.
   */
  private async loadSource(source: string): Promise<Document[]> {
    // URL detection
    if (source.startsWith('http://') || source.startsWith('https://')) {
      const loader = new WebLoader({ url: source });
      return loader.load();
    }

    // Detect if source is a directory (ends with / or has no extension)
    const ext = this.getExtension(source);

    if (!ext || source.endsWith('/')) {
      const loader = new DirectoryLoader({ path: source });
      return loader.load();
    }

    // File-based loading by extension
    switch (ext) {
      case '.txt':
      case '.log':
        return new TextFileLoader({ path: source }).load();
      case '.json':
        return new JSONFileLoader({ path: source }).load();
      case '.csv':
        return new CSVFileLoader({ path: source }).load();
      case '.md':
      case '.mdx':
        return new MarkdownFileLoader({ path: source }).load();
      case '.html':
      case '.htm':
        return new HTMLFileLoader({ path: source }).load();
      case '.pdf': {
        // Optional dependency — dynamic import
        try {
          const { PdfLoader } = await import('./loaders/pdf.loader');
          return new PdfLoader({ path: source }).load();
        } catch {
          throw new Error(
            `PDF loading requires the 'pdf-parse' package. Install it with: npm install pdf-parse`
          );
        }
      }
      case '.docx': {
        try {
          const { DocxLoader } = await import('./loaders/docx.loader');
          return new DocxLoader({ path: source }).load();
        } catch {
          throw new Error(
            `DOCX loading requires the 'mammoth' package. Install it with: npm install mammoth`
          );
        }
      }
      default:
        // Fallback: treat as text file
        return new TextFileLoader({ path: source }).load();
    }
  }

  /**
   * Extract file extension from a path.
   */
  private getExtension(filePath: string): string {
    const dotIndex = filePath.lastIndexOf('.');
    const slashIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    if (dotIndex <= slashIndex || dotIndex === -1) return '';
    return filePath.slice(dotIndex).toLowerCase();
  }

  /**
   * Search for similar documents
   */
  async search(
    query: string,
    options?: QueryOptions & { strategy?: RetrievalStrategy }
  ): Promise<SearchResult[]> {
    dbg('search query=%s strategy=%s', query, options?.strategy || 'similarity');
    const { strategy, ...queryOptions } = options || {};
    const results = await this.pipeline.retrieve(query, queryOptions, strategy);
    dbg('search results=%d', results.length);
    return results;
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

    const prompt = PromptRegistry.get<{ context: string; query: string }>(RAG_ANSWER_KEY).render({
      context: contextStr,
      query,
    });

    return this.config.llmFunction(prompt);
  }

  /**
   * Full RAG pipeline: retrieve + generate
   */
  async ask(
    query: string,
    options?: QueryOptions
  ): Promise<{ answer: string; sources: SearchResult[] }> {
    dbg('ask query=%s', query);
    const sources = await this.retrieve(query, options);
    const answer = await this.generate(query, sources);
    dbg('ask complete answer_len=%d sources=%d', answer.length, sources.length);
    return { answer, sources };
  }

  /**
   * Multi-query RAG
   * Generates multiple search queries from a single question and combines
   * deduplicated results, ranked by frequency and average score.
   */
  async multiQuery(question: string, numQueries: number = 3): Promise<SearchResult[]> {
    dbg('multiQuery question=%s numQueries=%d', question, numQueries);
    if (!this.multiQueryRetrieval) {
      return this.search(question, { topK: 10 });
    }

    // Override numQueries on the fly
    const retrieval = new MultiQueryRetrieval(this.config.vectorStore, {
      numQueries,
      customGenerator: this.config.queryGenerator,
    });

    const results = await retrieval.retrieve(question, { topK: numQueries * 5 });
    dbg('multiQuery results=%d', results.length);
    return results;
  }

  /**
   * Compress retrieved context by removing low-relevance and redundant results.
   * Uses LLM-based compression when available, otherwise applies score-based filtering
   * with deduplication.
   */
  async compress(documents: SearchResult[], query: string): Promise<SearchResult[]> {
    if (documents.length === 0) return [];

    // Step 1: Remove results below a relevance threshold (adaptive: median * 0.6)
    const scores = documents.map((d) => d.score);
    const sortedScores = [...scores].sort((a, b) => a - b);
    const median = sortedScores[Math.floor(sortedScores.length / 2)];
    const threshold = median * 0.6;
    let filtered = documents.filter((d) => d.score >= threshold);

    // Step 2: Deduplicate near-identical content (Jaccard similarity > 0.8)
    const deduplicated: SearchResult[] = [];
    for (const doc of filtered) {
      const isDuplicate = deduplicated.some(
        (existing) => this.jaccardSimilarity(existing.content, doc.content) > 0.8
      );
      if (!isDuplicate) {
        deduplicated.push(doc);
      }
    }
    filtered = deduplicated;

    // Step 3: LLM-based compression if available
    if (this.config.llmFunction && filtered.length > 5) {
      try {
        const contextBlock = filtered.map((d, i) => `[${i}] ${d.content}`).join('\n\n');

        const compressPrompt =
          `Given the query: "${query}"\n\n` +
          `Below are retrieved passages. Return ONLY the indices (comma-separated) of the ` +
          `passages that are most relevant and non-redundant. Return at most 5 indices.\n\n` +
          contextBlock;

        const response = await this.config.llmFunction(compressPrompt);
        const indices = response
          .replace(/[^0-9,]/g, '')
          .split(',')
          .map(Number)
          .filter((n) => !isNaN(n) && n >= 0 && n < filtered.length);

        if (indices.length > 0) {
          return indices.map((i) => filtered[i]);
        }
      } catch {
        // Fallback to score-based top-5 below
      }
    }

    return filtered.slice(0, 5);
  }

  /**
   * Jaccard similarity between two strings (token-level).
   */
  private jaccardSimilarity(a: string, b: string): number {
    const tokensA = new Set(a.toLowerCase().split(/\s+/));
    const tokensB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...tokensA].filter((t) => tokensB.has(t)));
    const union = new Set([...tokensA, ...tokensB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * Self-query with automatic metadata extraction.
   * Extracts filter conditions from natural language when an LLM is available,
   * then applies them as metadata filters on the vector search.
   */
  async selfQuery(naturalLanguageQuery: string): Promise<SearchResult[]> {
    if (!this.config.llmFunction) {
      return this.search(naturalLanguageQuery);
    }

    try {
      const extractionPrompt =
        `Given the following natural language query, extract:\n` +
        `1. A simplified search query (just the semantic intent)\n` +
        `2. Any metadata filters expressed as JSON (e.g. {"category": "science", "year": 2024})\n\n` +
        `Query: "${naturalLanguageQuery}"\n\n` +
        `Respond in this exact JSON format:\n` +
        `{"searchQuery": "...", "filters": {...}}`;

      const response = await this.config.llmFunction(extractionPrompt);
      const cleaned = response
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned) as {
        searchQuery?: string;
        filters?: Record<string, unknown>;
      };

      const searchQuery = parsed.searchQuery || naturalLanguageQuery;
      const filter =
        parsed.filters && Object.keys(parsed.filters).length > 0 ? parsed.filters : undefined;

      return this.search(searchQuery, { filter });
    } catch {
      // Fallback to plain search on parse error
      return this.search(naturalLanguageQuery);
    }
  }

  /**
   * Conversational RAG with session memory.
   * Maintains per-session conversation history and rewrites the user's
   * follow-up question into a standalone query before retrieval.
   */
  async chat(
    message: string,
    sessionId: string
  ): Promise<{ answer: string; sources: SearchResult[] }> {
    dbg('chat message=%s session=%s', message, sessionId);
    // Get or create conversation history
    if (!this.conversationHistory.has(sessionId)) {
      this.conversationHistory.set(sessionId, []);
    }
    const history = this.conversationHistory.get(sessionId)!;

    // Rewrite the follow-up into a standalone question using conversation context
    let standaloneQuery = message;
    if (history.length > 0 && this.config.llmFunction) {
      try {
        const historyText = history
          .slice(-6) // last 3 exchanges
          .map((m) => `${m.role}: ${m.content}`)
          .join('\n');

        const rewritePrompt =
          `Given the conversation history and a follow-up question, ` +
          `rewrite the follow-up into a standalone question that captures the full context.\n\n` +
          `Conversation:\n${historyText}\n\n` +
          `Follow-up: ${message}\n\n` +
          `Standalone question:`;

        standaloneQuery = await this.config.llmFunction(rewritePrompt);
        dbg('chat rewritten query=%s', standaloneQuery);
      } catch {
        standaloneQuery = message;
      }
    }

    // Retrieve and generate
    const sources = await this.retrieve(standaloneQuery);
    const answer = await this.generate(standaloneQuery, sources);

    // Update conversation history
    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: answer });

    // Keep history bounded
    while (history.length > 20) {
      history.shift();
    }

    dbg(
      'chat complete answer_len=%d sources=%d history_len=%d',
      answer.length,
      sources.length,
      history.length
    );
    return { answer, sources };
  }

  /**
   * Clear conversation history for a session.
   */
  clearChat(sessionId: string): void {
    this.conversationHistory.delete(sessionId);
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
   * Rerank search results using cross-encoder-style LLM scoring.
   * When no LLM is configured, falls back to BM25-boosted re-scoring.
   */
  async rerank(results: SearchResult[], query: string, topN?: number): Promise<SearchResult[]> {
    const n = topN || 5;
    if (results.length <= n) return results;

    // Strategy 1: LLM-based reranking (when available)
    if (this.config.llmFunction) {
      try {
        const passages = results.map((r, i) => `[${i}] ${r.content.slice(0, 300)}`).join('\n\n');

        const rerankPrompt =
          `Given the query: "${query}"\n\n` +
          `Rank the following passages by relevance. Return ONLY the indices ` +
          `in order from most to least relevant (comma-separated). ` +
          `Return at most ${n} indices.\n\n${passages}`;

        const response = await this.config.llmFunction(rerankPrompt);
        const indices = response
          .replace(/[^0-9,]/g, '')
          .split(',')
          .map(Number)
          .filter((idx) => !isNaN(idx) && idx >= 0 && idx < results.length);

        if (indices.length > 0) {
          const seen = new Set<number>();
          const reranked: SearchResult[] = [];
          for (const idx of indices) {
            if (!seen.has(idx)) {
              seen.add(idx);
              reranked.push(results[idx]);
            }
            if (reranked.length >= n) break;
          }
          return reranked;
        }
      } catch {
        // Fallback to BM25 boost below
      }
    }

    // Strategy 2: BM25 keyword boost
    const bm25 = new BM25();
    const bm25Docs: BM25Document[] = results.map((r) => ({
      id: r.id,
      content: r.content,
      tokens: r.content
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean),
    }));
    bm25.addDocuments(bm25Docs);
    const keywordScores = bm25.search(query, results.length);
    const kwMap = new Map(keywordScores.map((k) => [k.id, k.score]));

    // Normalize BM25 scores
    const maxKw = Math.max(...keywordScores.map((k) => k.score), 1);

    const boosted = results.map((r) => ({
      ...r,
      score: r.score * 0.7 + ((kwMap.get(r.id) || 0) / maxKw) * 0.3,
    }));

    return boosted.sort((a, b) => b.score - a.score).slice(0, n);
  }

  /**
   * Ensemble retrieval combining multiple retrieval strategies.
   * Runs each strategy, normalizes scores, applies weights, and fuses results.
   */
  async ensemble(
    query: string,
    methods: RetrievalStrategy[],
    weights?: number[]
  ): Promise<SearchResult[]> {
    if (methods.length === 0) return this.search(query);

    // Default: equal weights
    const w =
      weights && weights.length === methods.length
        ? weights
        : methods.map(() => 1 / methods.length);

    // Run all strategies in parallel
    const allResults = await Promise.all(
      methods.map((strategy) => this.search(query, { strategy, topK: 20 }))
    );

    // Normalize and weight each result set
    const scoreMap = new Map<string, { result: SearchResult; score: number }>();

    for (let i = 0; i < allResults.length; i++) {
      const results = allResults[i];
      const weight = w[i];

      // Min-max normalize within this strategy
      const scores = results.map((r) => r.score);
      const min = Math.min(...scores, 0);
      const max = Math.max(...scores, 1);
      const range = max - min || 1;

      for (const result of results) {
        const normalizedScore = ((result.score - min) / range) * weight;
        const existing = scoreMap.get(result.id);
        if (existing) {
          existing.score += normalizedScore;
        } else {
          scoreMap.set(result.id, {
            result: { ...result },
            score: normalizedScore,
          });
        }
      }
    }

    // Sort by fused score
    const fused = [...scoreMap.values()]
      .sort((a, b) => b.score - a.score)
      .map(({ result, score }) => ({ ...result, score }));

    return fused.slice(0, 10);
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
        const age = (now - Number(timestamp)) / (1000 * 60 * 60 * 24); // days
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
