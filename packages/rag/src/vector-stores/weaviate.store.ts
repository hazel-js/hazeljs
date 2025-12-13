/**
 * Weaviate Vector Store
 * Open-source vector database with GraphQL API
 */

import { VectorStore, Document, SearchResult, QueryOptions } from '../types';
import { EmbeddingProvider } from '../types';

// Type for Weaviate client (peer dependency)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WeaviateClient = any;

export interface WeaviateConfig {
  scheme: 'http' | 'https';
  host: string;
  apiKey?: string;
  className: string;
  textKey?: string;
  metadataKeys?: string[];
}

export class WeaviateVectorStore implements VectorStore {
  private client: WeaviateClient;
  private embeddingProvider: EmbeddingProvider;
  private className: string;
  private textKey: string;
  private metadataKeys: string[];
  private initialized: boolean = false;

  constructor(embeddingProvider: EmbeddingProvider, config: WeaviateConfig) {
    this.embeddingProvider = embeddingProvider;
    this.className = config.className;
    this.textKey = config.textKey || 'content';
    this.metadataKeys = config.metadataKeys || ['metadata'];

    // Initialize Weaviate client
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const weaviate = require('weaviate-ts-client');
    this.client = weaviate.client({
      scheme: config.scheme,
      host: config.host,
      apiKey: config.apiKey ? new weaviate.ApiKey(config.apiKey) : undefined,
    });
  }

  async initialize(): Promise<void> {
    try {
      // Check if class exists
      const schema = await this.client.schema.getter().do();
      const classExists = schema.classes?.some(
        (c: { class: string }) => c.class === this.className
      );

      if (!classExists) {
        // Create class schema
        const classObj = {
          class: this.className,
          vectorizer: 'none', // We provide our own vectors
          properties: [
            {
              name: this.textKey,
              dataType: ['text'],
              description: 'Document content',
            },
            {
              name: 'metadata',
              dataType: ['object'],
              description: 'Document metadata',
            },
          ],
        };

        await this.client.schema.classCreator().withClass(classObj).do();
      }

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize Weaviate class: ${error}`);
    }
  }

  async addDocuments(documents: Document[]): Promise<string[]> {
    const ids: string[] = [];

    // Generate embeddings for all documents
    const texts = documents.map((doc) => doc.content);
    const embeddings = await this.embeddingProvider.embedBatch(texts);

    // Batch import
    let batcher = this.client.batch.objectsBatcher();

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const id = doc.id || this.generateId();
      ids.push(id);

      const obj = {
        class: this.className,
        id,
        properties: {
          [this.textKey]: doc.content,
          metadata: doc.metadata || {},
        },
        vector: embeddings[i],
      };

      batcher = batcher.withObject(obj);
    }

    await batcher.do();
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

    try {
      // Build query
      let queryBuilder = this.client.graphql
        .get()
        .withClassName(this.className)
        .withFields(`${this.textKey} metadata _additional { id distance }`)
        .withNearVector({ vector: embedding })
        .withLimit(topK);

      // Add metadata filter if provided
      if (options?.filter) {
        const where = this.buildWhereFilter(options.filter);
        if (where) {
          queryBuilder = queryBuilder.withWhere(where);
        }
      }

      const response = await queryBuilder.do();

      // Transform results
      const results: SearchResult[] = (response.data.Get[this.className] || [])
        .map((item: { [key: string]: unknown; _additional: { id: string; distance: number } }) => {
          // Convert distance to similarity score (1 - distance for cosine)
          const score = 1 - item._additional.distance;

          return {
            id: item._additional.id,
            content: item[this.textKey],
            metadata: item.metadata,
            score,
          };
        })
        .filter((result: SearchResult) => !minScore || result.score >= minScore);

      return results;
    } catch (error) {
      throw new Error(`Weaviate search failed: ${error}`);
    }
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    try {
      for (const id of ids) {
        await this.client.data.deleter().withClassName(this.className).withId(id).do();
      }
    } catch (error) {
      throw new Error(`Failed to delete documents: ${error}`);
    }
  }

  async updateDocument(id: string, document: Partial<Document>): Promise<void> {
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

      // Update in Weaviate
      await this.client.data
        .updater()
        .withClassName(this.className)
        .withId(id)
        .withProperties({
          [this.textKey]: updated.content,
          metadata: updated.metadata || {},
        })
        .withVector(embedding!)
        .do();
    } catch (error) {
      throw new Error(`Failed to update document: ${error}`);
    }
  }

  async getDocument(id: string): Promise<Document | null> {
    try {
      const response = await this.client.data
        .getterById()
        .withClassName(this.className)
        .withId(id)
        .withVector()
        .do();

      if (!response) {
        return null;
      }

      return {
        id: response.id,
        content: response.properties[this.textKey],
        metadata: response.properties.metadata,
        embedding: response.vector,
      };
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      // Delete all objects of this class
      await this.client.schema.classDeleter().withClassName(this.className).do();

      // Recreate the class
      await this.initialize();
    } catch (error) {
      throw new Error(`Failed to clear vector store: ${error}`);
    }
  }

  /**
   * Build Weaviate where filter from simple key-value pairs
   */
  private buildWhereFilter(filter: Record<string, unknown>):
    | {
        path: string[];
        operator: string;
        valueText: string;
      }
    | {
        operator: string;
        operands: Array<{ path: string[]; operator: string; valueText: string }>;
      }
    | undefined {
    const conditions = Object.entries(filter).map(([key, value]) => ({
      path: ['metadata', key],
      operator: 'Equal',
      valueText: String(value),
    }));

    if (conditions.length === 0) {
      return undefined;
    }

    if (conditions.length === 1) {
      return conditions[0];
    }

    return {
      operator: 'And',
      operands: conditions,
    };
  }

  private generateId(): string {
    // Weaviate uses UUID format
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
