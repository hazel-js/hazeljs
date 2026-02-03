/**
 * RAG Service Types
 * Defines the interface for RAG services used by the agent runtime
 */

export interface RAGDocument {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  score?: number;
}

export interface RAGSearchRequest {
  query: string;
  topK?: number;
  filter?: Record<string, unknown>;
  minScore?: number;
}

export interface RAGSearchResponse {
  documents: RAGDocument[];
  totalResults: number;
  searchTime?: number;
}

/**
 * RAG Service Interface
 * All RAG services must implement this interface
 */
export interface RAGService {
  /**
   * Search for relevant documents
   */
  search(request: RAGSearchRequest): Promise<RAGSearchResponse>;

  /**
   * Optional: Add documents to the index
   */
  addDocuments?(documents: RAGDocument[]): Promise<void>;

  /**
   * Optional: Check if the service is available
   */
  isAvailable?(): Promise<boolean>;
}
