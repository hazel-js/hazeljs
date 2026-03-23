/**
 * Structured RAG errors for robust handling and observability.
 *
 * Mirrors the `AgentError` pattern from `@hazeljs/agent` for consistency.
 */

export enum RAGErrorCode {
  VECTOR_STORE_ERROR = 'RAG_VECTOR_STORE_ERROR',
  EMBEDDING_ERROR = 'RAG_EMBEDDING_ERROR',
  LOADER_ERROR = 'RAG_LOADER_ERROR',
  SPLITTER_ERROR = 'RAG_SPLITTER_ERROR',
  LLM_GENERATION_ERROR = 'RAG_LLM_GENERATION_ERROR',
  INDEX_ERROR = 'RAG_INDEX_ERROR',
  RETRIEVAL_ERROR = 'RAG_RETRIEVAL_ERROR',
  UNSUPPORTED_FORMAT = 'RAG_UNSUPPORTED_FORMAT',
  MISSING_DEPENDENCY = 'RAG_MISSING_DEPENDENCY',
  CONFIGURATION_ERROR = 'RAG_CONFIGURATION_ERROR',
}

export class RAGError extends Error {
  readonly code: RAGErrorCode;
  readonly cause?: Error;

  constructor(message: string, code: RAGErrorCode, cause?: Error) {
    super(message);
    this.name = 'RAGError';
    this.code = code;
    this.cause = cause;
    Object.setPrototypeOf(this, RAGError.prototype);
  }

  static vectorStoreError(message: string, cause?: Error): RAGError {
    return new RAGError(message, RAGErrorCode.VECTOR_STORE_ERROR, cause);
  }

  static embeddingError(message: string, cause?: Error): RAGError {
    return new RAGError(message, RAGErrorCode.EMBEDDING_ERROR, cause);
  }

  static loaderError(source: string, cause?: Error): RAGError {
    return new RAGError(
      `Failed to load documents from "${source}". Check that the file exists and is readable.`,
      RAGErrorCode.LOADER_ERROR,
      cause
    );
  }

  static splitterError(message: string, cause?: Error): RAGError {
    return new RAGError(message, RAGErrorCode.SPLITTER_ERROR, cause);
  }

  static generationError(message: string, cause?: Error): RAGError {
    return new RAGError(
      `LLM generation failed: ${message}. Ensure an llmFunction is configured.`,
      RAGErrorCode.LLM_GENERATION_ERROR,
      cause
    );
  }

  static indexError(message: string, cause?: Error): RAGError {
    return new RAGError(message, RAGErrorCode.INDEX_ERROR, cause);
  }

  static retrievalError(message: string, cause?: Error): RAGError {
    return new RAGError(message, RAGErrorCode.RETRIEVAL_ERROR, cause);
  }

  static unsupportedFormat(extension: string): RAGError {
    return new RAGError(
      `Unsupported file format "${extension}". ` +
        `Supported: .txt, .log, .json, .csv, .md, .mdx, .html, .htm, .pdf, .docx`,
      RAGErrorCode.UNSUPPORTED_FORMAT
    );
  }

  static missingDependency(packageName: string, feature: string): RAGError {
    return new RAGError(
      `The "${feature}" feature requires the "${packageName}" package. ` +
        `Install it with: npm install ${packageName}`,
      RAGErrorCode.MISSING_DEPENDENCY
    );
  }

  static configurationError(message: string): RAGError {
    return new RAGError(message, RAGErrorCode.CONFIGURATION_ERROR);
  }
}
