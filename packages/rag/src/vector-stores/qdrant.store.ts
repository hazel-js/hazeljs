/**
 * Qdrant Vector Store
 * High-performance Rust-based vector database integration
 */

import { VectorStore, Document, SearchResult, QueryOptions } from '../types';
import { EmbeddingProvider } from '../types';

// Type for Qdrant client (peer dependency)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QdrantClient = any;

export interface QdrantConfig {
  url: string;
  apiKey?: string;
  collectionName: string;
  vectorSize?: number;
  /** Skip client-server version check (avoids warning when Qdrant is unreachable). Default: true */
  checkCompatibility?: boolean;
}

export class QdrantVectorStore implements VectorStore {
  private client: QdrantClient;
  private embeddingProvider: EmbeddingProvider;
  private collectionName: string;
  private vectorSize: number;
  private initialized: boolean = false;

  constructor(embeddingProvider: EmbeddingProvider, config: QdrantConfig) {
    this.embeddingProvider = embeddingProvider;
    this.collectionName = config.collectionName;
    this.vectorSize = config.vectorSize || embeddingProvider.getDimension();

    // Initialize Qdrant client
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { QdrantClient: Client } = require('@qdrant/js-client-rest');
    this.client = new Client({
      url: config.url,
      apiKey: config.apiKey,
      checkCompatibility: config.checkCompatibility ?? false,
    });
  }

  async initialize(): Promise<void> {
    try {
      // Check if collection exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        (c: { name: string }) => c.name === this.collectionName
      );

      if (!exists) {
        // Create collection
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.vectorSize,
            distance: 'Cosine',
          },
        });
      }

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize Qdrant collection: ${error}`);
    }
  }

  async addDocuments(documents: Document[]): Promise<string[]> {
    const ids: string[] = [];

    // Generate embeddings for all documents
    const texts = documents.map((doc) => doc.content);
    const embeddings = await this.embeddingProvider.embedBatch(texts);

    // Prepare points for upsert
    const points = documents.map((doc, idx) => {
      const id = doc.id || this.generateId();
      ids.push(id);

      return {
        id,
        vector: embeddings[idx],
        payload: {
          content: doc.content,
          metadata: doc.metadata || {},
        },
      };
    });

    // Upsert to Qdrant
    await this.client.upsert(this.collectionName, {
      wait: true,
      points,
    });

    return ids;
  }

  async search(query: string, options?: QueryOptions): Promise<SearchResult[]> {
    // Generate embedding for query
    const queryEmbedding = await this.embeddingProvider.embed(query);

    return this.searchByVector(queryEmbedding, options);
  }

  async searchByVector(embedding: number[], options?: QueryOptions): Promise<SearchResult[]> {
    const topK = options?.topK || 5;
    const minScore = options?.minScore;
    const filter = options?.filter;

    // Build Qdrant filter
    const qdrantFilter = filter ? this.buildFilter(filter) : undefined;

    // Search Qdrant
    const searchResponse = await this.client.search(this.collectionName, {
      vector: embedding,
      limit: topK,
      filter: qdrantFilter,
      with_payload: true,
    });

    // Transform results
    const results: SearchResult[] = searchResponse
      .filter((result: { score: number }) => !minScore || result.score >= minScore)
      .map(
        (result: {
          id: string | number;
          score: number;
          payload: { content: string; metadata: Record<string, unknown> };
        }) => ({
          id: result.id.toString(),
          content: result.payload.content,
          metadata: result.payload.metadata,
          score: result.score,
        })
      );

    return results;
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    await this.client.delete(this.collectionName, {
      wait: true,
      points: ids,
    });
  }

  async updateDocument(id: string, document: Partial<Document>): Promise<void> {
    // Get existing document
    const existing = await this.getDocument(id);
    if (!existing) {
      throw new Error(`Document with id ${id} not found`);
    }

    // Merge updates
    const updated = { ...existing, ...document };

    // Generate new embedding if content changed
    let embedding = existing.embedding;
    if (document.content && document.content !== existing.content) {
      embedding = await this.embeddingProvider.embed(document.content);
    }

    // Upsert updated document
    await this.client.upsert(this.collectionName, {
      wait: true,
      points: [
        {
          id,
          vector: embedding!,
          payload: {
            content: updated.content,
            metadata: updated.metadata || {},
          },
        },
      ],
    });
  }

  async getDocument(id: string): Promise<Document | null> {
    try {
      const response = await this.client.retrieve(this.collectionName, {
        ids: [id],
        with_payload: true,
        with_vector: true,
      });

      if (!response || response.length === 0) {
        return null;
      }

      const point = response[0];
      return {
        id: point.id.toString(),
        content: point.payload.content,
        metadata: point.payload.metadata,
        embedding: point.vector,
      };
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    // Delete and recreate collection
    await this.client.deleteCollection(this.collectionName);
    await this.initialize();
  }

  private buildFilter(filter: Record<string, unknown>): {
    must: Array<{ key: string; match: { value: unknown } }>;
  } {
    // Build Qdrant filter from simple key-value pairs
    const must: Array<{ key: string; match: { value: unknown } }> = [];

    for (const [key, value] of Object.entries(filter)) {
      must.push({
        key: `metadata.${key}`,
        match: { value },
      });
    }

    return { must };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}
