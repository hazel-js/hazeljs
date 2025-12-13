/**
 * Pinecone Vector Store
 * Production-ready vector database integration
 */

import { VectorStore, Document, SearchResult, QueryOptions } from '../types';
import { EmbeddingProvider } from '../types';

// Type for Pinecone client (peer dependency)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PineconeClient = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Index = any;

export interface PineconeConfig {
  apiKey: string;
  environment: string;
  indexName: string;
  namespace?: string;
  textKey?: string;
  metadataKey?: string;
}

export class PineconeVectorStore implements VectorStore {
  private client: PineconeClient;
  private index: Index;
  private embeddingProvider: EmbeddingProvider;
  private namespace: string;
  private textKey: string;
  private metadataKey: string;
  private initialized: boolean = false;

  constructor(embeddingProvider: EmbeddingProvider, config: PineconeConfig) {
    this.embeddingProvider = embeddingProvider;
    this.namespace = config.namespace || '';
    this.textKey = config.textKey || 'text';
    this.metadataKey = config.metadataKey || 'metadata';

    // Initialize Pinecone client
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pinecone } = require('@pinecone-database/pinecone');
    this.client = new Pinecone({
      apiKey: config.apiKey,
      environment: config.environment,
    });

    this.index = this.client.index(config.indexName);
  }

  async initialize(): Promise<void> {
    // Pinecone doesn't require explicit initialization
    // but we can verify the index exists
    try {
      await this.index.describeIndexStats();
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize Pinecone index: ${error}`);
    }
  }

  async addDocuments(documents: Document[]): Promise<string[]> {
    const ids: string[] = [];

    // Generate embeddings for all documents
    const texts = documents.map((doc) => doc.content);
    const embeddings = await this.embeddingProvider.embedBatch(texts);

    // Prepare vectors for upsert
    const vectors = documents.map((doc, idx) => {
      const id = this.generateId();
      ids.push(id);

      return {
        id,
        values: embeddings[idx],
        metadata: {
          [this.textKey]: doc.content,
          [this.metadataKey]: doc.metadata || {},
        },
      };
    });

    // Upsert to Pinecone in batches
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await this.index.namespace(this.namespace).upsert(batch);
    }

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

    // Query Pinecone
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const queryOptions: any = {
      vector: embedding,
      topK,
      includeMetadata: true,
    };

    if (filter && Object.keys(filter).length > 0) {
      queryOptions.filter = filter;
    }

    const queryResponse = await this.index.namespace(this.namespace).query(queryOptions);

    // Transform results
    const results: SearchResult[] = queryResponse.matches
      .filter((match: { score?: number }) => !minScore || (match.score ?? 0) >= minScore)
      .map((match: { id: string; score: number; metadata: Record<string, unknown> }) => ({
        id: match.id,
        content: match.metadata[this.textKey],
        metadata: match.metadata[this.metadataKey],
        score: match.score,
      }));

    return results;
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    await this.index.namespace(this.namespace).deleteMany(ids);
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
    await this.index.namespace(this.namespace).upsert([
      {
        id,
        values: embedding!,
        metadata: {
          [this.textKey]: updated.content,
          [this.metadataKey]: updated.metadata || {},
        },
      },
    ]);
  }

  async getDocument(id: string): Promise<Document | null> {
    try {
      const response = await this.index.namespace(this.namespace).fetch([id]);
      const vector = response.vectors[id];

      if (!vector) {
        return null;
      }

      return {
        id,
        content: vector.metadata[this.textKey],
        metadata: vector.metadata[this.metadataKey],
        embedding: vector.values,
      };
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    await this.index.namespace(this.namespace).deleteAll();
  }

  private generateId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}
