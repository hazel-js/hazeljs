/**
 * ChromaDB Vector Store
 * Lightweight, embedded vector database
 */

import { VectorStore, Document, SearchResult, QueryOptions } from '../types';
import { EmbeddingProvider } from '../types';

// Type for ChromaDB client (peer dependency)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChromaClient = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Collection = any;

export interface ChromaConfig {
  url?: string;
  collectionName: string;
  auth?: {
    provider: 'token';
    credentials: string;
  };
}

export class ChromaVectorStore implements VectorStore {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private embeddingProvider: EmbeddingProvider;
  private collectionName: string;
  private initialized: boolean = false;

  constructor(embeddingProvider: EmbeddingProvider, config: ChromaConfig) {
    this.embeddingProvider = embeddingProvider;
    this.collectionName = config.collectionName;

    // Initialize ChromaDB client
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ChromaClient } = require('chromadb');

    const clientConfig: Record<string, unknown> = {};
    if (config.url) {
      clientConfig.path = config.url;
    }
    if (config.auth) {
      clientConfig.auth = config.auth;
    }

    this.client = new ChromaClient(clientConfig);
  }

  async initialize(): Promise<void> {
    try {
      // Get or create collection
      this.collection = await this.client.getOrCreateCollection({
        name: this.collectionName,
        metadata: { 'hnsw:space': 'cosine' }, // Use cosine similarity
      });

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize ChromaDB collection: ${error}`);
    }
  }

  async addDocuments(documents: Document[]): Promise<string[]> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    const ids: string[] = [];
    const embeddings: number[][] = [];
    const metadatas: Record<string, unknown>[] = [];
    const documentsTexts: string[] = [];

    // Generate embeddings for all documents
    const texts = documents.map((doc) => doc.content);
    const generatedEmbeddings = await this.embeddingProvider.embedBatch(texts);

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const id = doc.id || this.generateId();

      ids.push(id);
      embeddings.push(generatedEmbeddings[i]);
      documentsTexts.push(doc.content);
      metadatas.push(doc.metadata || {});
    }

    // Add to ChromaDB
    await this.collection.add({
      ids,
      embeddings,
      documents: documentsTexts,
      metadatas,
    });

    return ids;
  }

  async search(query: string, options?: QueryOptions): Promise<SearchResult[]> {
    // Generate embedding for query
    const queryEmbedding = await this.embeddingProvider.embed(query);

    return this.searchByVector(queryEmbedding, options);
  }

  async searchByVector(embedding: number[], options?: QueryOptions): Promise<SearchResult[]> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    const topK = options?.topK || 5;
    const minScore = options?.minScore;
    const filter = options?.filter;

    try {
      // Build query
      const queryParams: {
        queryEmbeddings: number[][];
        nResults: number;
        where?: Record<string, unknown>;
      } = {
        queryEmbeddings: [embedding],
        nResults: topK,
      };

      // Add metadata filter if provided
      if (filter) {
        queryParams.where = filter;
      }

      const response = await this.collection.query(queryParams);

      // Transform results
      const results: SearchResult[] = [];

      if (response.ids && response.ids[0]) {
        for (let i = 0; i < response.ids[0].length; i++) {
          // ChromaDB returns distances, convert to similarity scores
          // For cosine distance: similarity = 1 - distance
          const distance = response.distances?.[0]?.[i] || 0;
          const score = 1 - distance;

          // Apply minimum score filter
          if (minScore && score < minScore) {
            continue;
          }

          results.push({
            id: response.ids[0][i],
            content: response.documents?.[0]?.[i] || '',
            metadata: response.metadatas?.[0]?.[i] || {},
            score,
          });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`ChromaDB search failed: ${error}`);
    }
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    try {
      await this.collection.delete({
        ids,
      });
    } catch (error) {
      throw new Error(`Failed to delete documents: ${error}`);
    }
  }

  async updateDocument(id: string, document: Partial<Document>): Promise<void> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    try {
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

      // Update in ChromaDB (delete and re-add)
      await this.collection.delete({ ids: [id] });
      await this.collection.add({
        ids: [id],
        embeddings: [embedding!],
        documents: [updated.content],
        metadatas: [updated.metadata || {}],
      });
    } catch (error) {
      throw new Error(`Failed to update document: ${error}`);
    }
  }

  async getDocument(id: string): Promise<Document | null> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    try {
      const response = await this.collection.get({
        ids: [id],
        include: ['embeddings', 'documents', 'metadatas'],
      });

      if (!response.ids || response.ids.length === 0) {
        return null;
      }

      return {
        id: response.ids[0],
        content: response.documents?.[0] || '',
        metadata: response.metadatas?.[0] || {},
        embedding: response.embeddings?.[0],
      };
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    try {
      // Delete the collection
      await this.client.deleteCollection({ name: this.collectionName });

      // Recreate it
      await this.initialize();
    } catch (error) {
      throw new Error(`Failed to clear vector store: ${error}`);
    }
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{ count: number }> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    try {
      const count = await this.collection.count();
      return { count };
    } catch (error) {
      throw new Error(`Failed to get stats: ${error}`);
    }
  }

  /**
   * Peek at first N documents
   */
  async peek(limit: number = 10): Promise<Document[]> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    try {
      const response = await this.collection.peek({ limit });
      const documents: Document[] = [];

      if (response.ids) {
        for (let i = 0; i < response.ids.length; i++) {
          documents.push({
            id: response.ids[i],
            content: response.documents?.[i] || '',
            metadata: response.metadatas?.[i] || {},
            embedding: response.embeddings?.[i],
          });
        }
      }

      return documents;
    } catch (error) {
      throw new Error(`Failed to peek documents: ${error}`);
    }
  }

  private generateId(): string {
    return `chroma_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}
