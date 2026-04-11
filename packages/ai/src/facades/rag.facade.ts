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
   * Build vector store from HazelAI persistence.rag (Pinecone, Qdrant, Weaviate, Chroma, or memory).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildVectorStore(embeddingProvider: any, rag: any): any {
    const ragConfig = this.config.persistence?.rag;
    const kind = ragConfig?.vectorStore ?? 'in-memory';

    if (!ragConfig || kind === 'in-memory') {
      return new rag.MemoryVectorStore(embeddingProvider);
    }

    const opts = ragConfig.options ?? {};

    switch (kind) {
      case 'pinecone':
        return new rag.PineconeVectorStore(embeddingProvider, {
          apiKey: ragConfig.apiKey || process.env.PINECONE_API_KEY || '',
          environment: ragConfig.environment || process.env.PINECONE_ENVIRONMENT || '',
          indexName: ragConfig.indexName || 'hazel',
          namespace: (opts.namespace as string) || undefined,
        });
      case 'qdrant':
        return new rag.QdrantVectorStore(embeddingProvider, {
          url: ragConfig.connectionString || (opts.url as string) || 'http://127.0.0.1:6333',
          apiKey: ragConfig.apiKey,
          collectionName: ragConfig.indexName || 'hazel',
          vectorSize: opts.vectorSize as number | undefined,
        });
      case 'weaviate':
        return new rag.WeaviateVectorStore(embeddingProvider, {
          scheme: (opts.scheme as 'http' | 'https') || 'https',
          host: ragConfig.connectionString || (opts.host as string) || 'localhost',
          apiKey: ragConfig.apiKey,
          className: ragConfig.indexName || 'HazelDocument',
        });
      case 'chroma':
        return new rag.ChromaVectorStore(embeddingProvider, {
          url: ragConfig.connectionString,
          collectionName: ragConfig.indexName || 'hazel',
          auth: opts.auth as { provider: 'token'; credentials: string } | undefined,
        });
      default:
        return new rag.MemoryVectorStore(embeddingProvider);
    }
  }

  /**
   * Ensure @hazeljs/rag is loaded and initialized with persistence configuration.
   * Throws a helpful error if the package is not installed.
   */
  private async ensureRAG(): Promise<void> {
    if (this.initialized) return;

    try {
      // Dynamic import — use `any` so @hazeljs/ai builds without pulling full RAG sources into this project.
      const rag = (await import('@hazeljs/rag')) as any;
      const RAGPipeline = rag.RAGPipeline;
      const RAGService = rag.RAGService;

      // Get RAG persistence configuration
      const ragConfig = this.config.persistence?.rag;
      const provider = (this.config.defaultProvider as 'openai' | 'cohere') || 'openai';

      let embeddingProvider;
      switch (provider) {
        case 'cohere': {
          const apiKey = process.env.COHERE_API_KEY;
          if (!apiKey) {
            throw new Error('RAG: COHERE_API_KEY is required for Cohere embeddings.');
          }
          embeddingProvider = new rag.CohereEmbeddings({ apiKey });
          break;
        }
        case 'openai':
        default: {
          const apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey) {
            throw new Error('RAG: OPENAI_API_KEY is required for OpenAI embeddings.');
          }
          embeddingProvider = new rag.OpenAIEmbeddings({ apiKey });
          break;
        }
      }

      const chunkSize = (ragConfig?.options?.chunkSize as number) ?? 1000;
      const chunkOverlap = (ragConfig?.options?.chunkOverlap as number) ?? 200;
      const textSplitter = new rag.RecursiveTextSplitter({ chunkSize, chunkOverlap });

      const vectorStore = this.buildVectorStore(embeddingProvider, rag);

      const llm = async (prompt: string) => {
        const response = await this.aiService.complete({
          messages: [{ role: 'user', content: prompt }],
        });
        return response.content;
      };

      const pipeline = new RAGPipeline(
        {
          vectorStore,
          embeddingProvider,
          textSplitter,
          topK: (ragConfig?.options?.topK as number) ?? 5,
        },
        llm
      );

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
