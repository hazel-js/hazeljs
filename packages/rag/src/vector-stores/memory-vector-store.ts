/**
 * In-Memory Vector Store
 * Useful for development and testing
 */

import { VectorStore, Document, SearchResult, QueryOptions, EmbeddingProvider } from '../types';
import { cosineSimilarity } from '../utils/similarity';

export class MemoryVectorStore implements VectorStore {
  private documents: Map<string, Document> = new Map();
  private embeddingProvider: EmbeddingProvider;

  constructor(embeddingProvider: EmbeddingProvider) {
    this.embeddingProvider = embeddingProvider;
  }

  async initialize(): Promise<void> {
    // No initialization needed for memory store
  }

  async addDocuments(documents: Document[]): Promise<string[]> {
    const ids: string[] = [];

    // Generate embeddings for documents
    const texts = documents.map((doc) => doc.content);
    const embeddings = await this.embeddingProvider.embedBatch(texts);

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const id = doc.id || this.generateId();
      const embedding = embeddings[i];

      this.documents.set(id, {
        ...doc,
        id,
        embedding,
      });

      ids.push(id);
    }

    return ids;
  }

  async search(query: string, options: QueryOptions = {}): Promise<SearchResult[]> {
    const queryEmbedding = await this.embeddingProvider.embed(query);
    return this.searchByVector(queryEmbedding, options);
  }

  async searchByVector(embedding: number[], options: QueryOptions = {}): Promise<SearchResult[]> {
    const {
      topK = 5,
      filter = {},
      includeMetadata = true,
      includeEmbedding = false,
      minScore = 0,
    } = options;

    const results: SearchResult[] = [];

    for (const [id, doc] of this.documents.entries()) {
      if (!doc.embedding) continue;

      // Apply metadata filters
      if (Object.keys(filter).length > 0) {
        const matchesFilter = Object.entries(filter).every(
          ([key, value]) => doc.metadata?.[key] === value
        );
        if (!matchesFilter) continue;
      }

      // Calculate similarity
      const score = cosineSimilarity(embedding, doc.embedding);

      if (score >= minScore) {
        results.push({
          id,
          content: doc.content,
          metadata: includeMetadata ? doc.metadata : undefined,
          embedding: includeEmbedding ? doc.embedding : undefined,
          score,
        });
      }
    }

    // Sort by score descending and return top K
    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.documents.delete(id);
    }
  }

  async updateDocument(id: string, document: Partial<Document>): Promise<void> {
    const existing = this.documents.get(id);
    if (!existing) {
      throw new Error(`Document with id ${id} not found`);
    }

    const updated = { ...existing, ...document };

    // Re-generate embedding if content changed
    if (document.content && document.content !== existing.content) {
      updated.embedding = await this.embeddingProvider.embed(document.content);
    }

    this.documents.set(id, updated as Document);
  }

  async getDocument(id: string): Promise<Document | null> {
    return this.documents.get(id) || null;
  }

  async clear(): Promise<void> {
    this.documents.clear();
  }

  private generateId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
