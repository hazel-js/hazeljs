import { AIEnhancedService } from '../ai-enhanced.service';
import type {
  HazelAIConfig,
  RAGOptions,
  RAGResult,
  RAGSource,
  KnowledgeSource,
  RAGFacadeInterface,
} from '../platform/hazel-ai.types';

/**
 * RAG Facade — Provides high-level RAG (Retrieval-Augmented Generation) APIs.
 *
 * This facade lazily loads @hazeljs/rag and provides simple methods
 * for ingesting documents and asking questions over them.
 * It gracefully handles missing @hazeljs/rag with helpful errors.
 */
export class RAGFacade implements RAGFacadeInterface {
  private ragService: unknown;
  private initialized = false;

  constructor(
    private aiService: AIEnhancedService,
    private config: HazelAIConfig
  ) {}

  /**
   * Ensure @hazeljs/rag is loaded and initialized.
   * Throws a helpful error if the package is not installed.
   */
  private async ensureRAG(): Promise<void> {
    if (this.initialized) return;

    try {
      const { RAGPipeline, RAGService } = await import('@hazeljs/rag');

      // Create a pipeline with sensible defaults
      const pipeline = RAGPipeline.from({
        provider: (this.config.defaultProvider as 'openai' | 'cohere') || 'openai',
        llm: async (prompt: string) => {
          const response = await this.aiService.complete({
            messages: [{ role: 'user', content: prompt }],
          });
          return response.content;
        },
      });

      await pipeline.initialize();

      // Create RAGService wrapper
      this.ragService = new RAGService({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vectorStore: (pipeline as any).config.vectorStore,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        embeddingProvider: (pipeline as any).config.embeddingProvider,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        textSplitter: (pipeline as any).config.textSplitter,
        llmFunction: async (prompt: string): Promise<string> => {
          const response = await this.aiService.complete({
            messages: [{ role: 'user', content: prompt }],
          });
          return response.content;
        },
      });

      await (this.ragService as { initialize(): Promise<void> }).initialize();
      this.initialized = true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Cannot find module')) {
        throw new Error(
          '@hazeljs/rag is required for RAG features. Install it:\n' + '  npm install @hazeljs/rag'
        );
      }
      throw error;
    }
  }

  /**
   * Ingest documents into the RAG system.
   *
   * @param source Path to file/directory, URL, or KnowledgeSource object
   * @returns Array of document IDs that were ingested
   */
  async ingest(source: string | KnowledgeSource): Promise<string[]> {
    await this.ensureRAG();

    // Handle text content directly
    if (typeof source === 'object' && source.type === 'text') {
      return (this.ragService as { index: (data: unknown) => Promise<string[]> }).index({
        content: source.content,
        metadata: source.metadata,
      });
    }

    // Handle file/directory/URL paths
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const path = typeof source === 'string' ? source : (source as any).path || (source as any).url;

    return (this.ragService as { ingest: (path: string) => Promise<string[]> }).ingest(path);
  }

  /**
   * Ask a question over the ingested documents.
   *
   * @param query The question to ask
   * @param options Optional RAG configuration
   * @returns Answer with source citations
   */
  async ask(query: string, options?: RAGOptions): Promise<RAGResult> {
    await this.ensureRAG();

    return (
      this.ragService as { ask: (query: string, options?: RAGOptions) => Promise<RAGResult> }
    ).ask(query, options);
  }

  /**
   * Search for relevant documents without generating an answer.
   *
   * @param query The search query
   * @param options Optional search configuration
   * @returns Array of relevant document sources
   */
  async search(query: string, options?: RAGOptions): Promise<RAGSource[]> {
    await this.ensureRAG();

    return (
      this.ragService as { search: (query: string, options?: RAGOptions) => Promise<RAGSource[]> }
    ).search(query, {
      topK: options?.topK,
      strategy: options?.strategy,
      minScore: options?.minScore,
    });
  }
}
