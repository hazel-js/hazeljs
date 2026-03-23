import { RAGError, RAGErrorCode } from '../../errors/rag.error';

describe('RAGError', () => {
  describe('constructor', () => {
    it('should create error with message and code', () => {
      const error = new RAGError('Test error', RAGErrorCode.VECTOR_STORE_ERROR);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(RAGError);
      expect(error.code).toBe(RAGErrorCode.VECTOR_STORE_ERROR);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('RAGError');
    });

    it('should include cause if provided', () => {
      const cause = new Error('Original error');
      const error = new RAGError('Wrapper error', RAGErrorCode.EMBEDDING_ERROR, cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('static factory methods', () => {
    it('should create vectorStoreError', () => {
      const error = RAGError.vectorStoreError('Connection failed');

      expect(error.code).toBe(RAGErrorCode.VECTOR_STORE_ERROR);
      expect(error.message).toBe('Connection failed');
    });

    it('should create embeddingError', () => {
      const error = RAGError.embeddingError('API key invalid');

      expect(error.code).toBe(RAGErrorCode.EMBEDDING_ERROR);
      expect(error.message).toBe('API key invalid');
    });

    it('should create loaderError', () => {
      const error = RAGError.loaderError('./test.pdf');

      expect(error.code).toBe(RAGErrorCode.LOADER_ERROR);
      expect(error.message).toContain('./test.pdf');
    });

    it('should create splitterError', () => {
      const error = RAGError.splitterError('Invalid chunk size');

      expect(error.code).toBe(RAGErrorCode.SPLITTER_ERROR);
      expect(error.message).toBe('Invalid chunk size');
    });

    it('should create generationError', () => {
      const error = RAGError.generationError('No LLM configured');

      expect(error.code).toBe(RAGErrorCode.LLM_GENERATION_ERROR);
      expect(error.message).toContain('No LLM configured');
    });

    it('should create indexError', () => {
      const error = RAGError.indexError('Indexing failed');

      expect(error.code).toBe(RAGErrorCode.INDEX_ERROR);
      expect(error.message).toBe('Indexing failed');
    });

    it('should create retrievalError', () => {
      const error = RAGError.retrievalError('Search failed');

      expect(error.code).toBe(RAGErrorCode.RETRIEVAL_ERROR);
      expect(error.message).toBe('Search failed');
    });

    it('should create unsupportedFormat error', () => {
      const error = RAGError.unsupportedFormat('.xyz');

      expect(error.code).toBe(RAGErrorCode.UNSUPPORTED_FORMAT);
      expect(error.message).toContain('.xyz');
    });

    it('should create missingDependency error', () => {
      const error = RAGError.missingDependency('pdf-parse', 'PDF loading');

      expect(error.code).toBe(RAGErrorCode.MISSING_DEPENDENCY);
      expect(error.message).toContain('pdf-parse');
      expect(error.message).toContain('PDF loading');
    });

    it('should create configurationError', () => {
      const error = RAGError.configurationError('Invalid config');

      expect(error.code).toBe(RAGErrorCode.CONFIGURATION_ERROR);
      expect(error.message).toBe('Invalid config');
    });
  });

  describe('error handling', () => {
    it('should be catchable as Error', () => {
      try {
        throw RAGError.vectorStoreError('Test');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(RAGError);
      }
    });

    it('should preserve stack trace', () => {
      const error = RAGError.embeddingError('Test');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('RAGError');
    });

    it('should handle cause in factory methods', () => {
      const cause = new Error('Root cause');
      const error = RAGError.vectorStoreError('Connection failed', cause);

      expect(error.cause).toBe(cause);
    });
  });
});
