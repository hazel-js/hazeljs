/**
 * Core types for RAG package
 */

/**
 * Document to be indexed
 */
export interface Document {
  id?: string;
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[];
}

/**
 * Search result with similarity score
 */
export interface SearchResult {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  score: number;
  embedding?: number[];
}

/**
 * Query options for vector search
 */
export interface QueryOptions {
  topK?: number;
  filter?: Record<string, any>;
  includeMetadata?: boolean;
  includeEmbedding?: boolean;
  minScore?: number;
}

/**
 * Embedding provider interface
 */
export interface EmbeddingProvider {
  /**
   * Generate embeddings for text
   */
  embed(text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * Get the dimension of embeddings
   */
  getDimension(): number;
}

/**
 * Vector store interface
 */
export interface VectorStore {
  /**
   * Initialize the vector store
   */
  initialize(): Promise<void>;

  /**
   * Add documents to the store
   */
  addDocuments(documents: Document[]): Promise<string[]>;

  /**
   * Search for similar documents
   */
  search(query: string, options?: QueryOptions): Promise<SearchResult[]>;

  /**
   * Search using embedding vector
   */
  searchByVector(embedding: number[], options?: QueryOptions): Promise<SearchResult[]>;

  /**
   * Delete documents by IDs
   */
  deleteDocuments(ids: string[]): Promise<void>;

  /**
   * Update a document
   */
  updateDocument(id: string, document: Partial<Document>): Promise<void>;

  /**
   * Get document by ID
   */
  getDocument(id: string): Promise<Document | null>;

  /**
   * Clear all documents
   */
  clear(): Promise<void>;
}

/**
 * Text splitter interface
 */
export interface TextSplitter {
  /**
   * Split text into chunks
   */
  split(text: string): string[];

  /**
   * Split documents into chunks
   */
  splitDocuments(documents: Document[]): Document[];
}

/**
 * Document loader interface
 */
export interface DocumentLoader {
  /**
   * Load documents from source
   */
  load(): Promise<Document[]>;
}

/**
 * RAG configuration
 */
export interface RAGConfig {
  vectorStore: VectorStore;
  embeddingProvider: EmbeddingProvider;
  textSplitter?: TextSplitter;
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
}

/**
 * Retrieval strategy
 */
export enum RetrievalStrategy {
  SIMILARITY = 'similarity',
  MMR = 'mmr', // Maximal Marginal Relevance
  HYBRID = 'hybrid', // Combines keyword and semantic search
}

/**
 * RAG query options
 */
export interface RAGQueryOptions extends QueryOptions {
  strategy?: RetrievalStrategy;
  llmPrompt?: string;
  includeContext?: boolean;
}

/**
 * RAG response
 */
export interface RAGResponse {
  answer: string;
  sources: SearchResult[];
  context: string;
}
