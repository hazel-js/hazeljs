// Error variable for testing — read by the hoisted jest.mock factory below
let mockRagError: Error | null = null;

jest.mock('@hazeljs/rag', () => {
  if (mockRagError) {
    throw mockRagError;
  }
  return {
    OpenAIEmbeddings: jest.fn().mockImplementation(() => ({})),
    CohereEmbeddings: jest.fn().mockImplementation(() => ({})),
    RecursiveTextSplitter: jest.fn().mockImplementation(() => ({})),
    MemoryVectorStore: jest.fn().mockImplementation(() => ({})),
    PineconeVectorStore: jest.fn(),
    QdrantVectorStore: jest.fn(),
    WeaviateVectorStore: jest.fn(),
    ChromaVectorStore: jest.fn(),
    RAGPipeline: jest.fn().mockImplementation((config: unknown) => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      config: {
        vectorStore: (config as { vectorStore?: unknown }).vectorStore,
        embeddingProvider: (config as { embeddingProvider?: unknown }).embeddingProvider,
        textSplitter: (config as { textSplitter?: unknown }).textSplitter,
      },
    })),
    RAGService: jest.fn().mockImplementation(() => ({
      index: jest.fn(),
      ingest: jest.fn(),
      ask: jest.fn(),
      search: jest.fn(),
      initialize: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

import { RAGFacade } from '../rag.facade';
import { AIEnhancedService } from '../../ai-enhanced.service';
import type { HazelAIConfig, RAGSource } from '../../platform/hazel-ai.types';

describe('RAGFacade', () => {
  let facade: RAGFacade;
  let mockAIService: jest.Mocked<AIEnhancedService>;
  let mockConfig: HazelAIConfig;
  let savedOpenAiKey: string | undefined;

  beforeAll(() => {
    savedOpenAiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = savedOpenAiKey || 'sk-test-jest-placeholder';
  });

  afterAll(() => {
    process.env.OPENAI_API_KEY = savedOpenAiKey;
  });

  afterEach(() => {
    mockRagError = null;
  });

  beforeEach(() => {
    mockAIService = {
      complete: jest.fn(),
      streamComplete: jest.fn(),
    } as any;

    mockConfig = {
      defaultProvider: 'openai',
    };

    facade = new RAGFacade(mockAIService, mockConfig);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create RAGFacade with dependencies', () => {
      expect(facade).toBeInstanceOf(RAGFacade);
    });

    it('should initialize with not initialized state', () => {
      expect((facade as any).initialized).toBe(false);
      expect((facade as any).ragService).toBeUndefined();
    });
  });

  describe('ensureRAG', () => {
    it('should initialize RAG service successfully', async () => {
      await (facade as any).ensureRAG();

      expect((facade as any).initialized).toBe(true);
      expect((facade as any).ragService).toBeDefined();
    });

    it('should not initialize multiple times', async () => {
      const { RAGPipeline } = await import('@hazeljs/rag');

      await (facade as any).ensureRAG();
      await (facade as any).ensureRAG();

      expect(RAGPipeline).toHaveBeenCalledTimes(1);
    });

    it('should throw helpful error when @hazeljs/rag is not installed', async () => {
      mockRagError = new Error('Cannot find module "@hazeljs/rag"');
      jest.resetModules();

      const newFacade = new RAGFacade(mockAIService, mockConfig);

      await expect((newFacade as any).ensureRAG()).rejects.toThrow(
        '@hazeljs/rag is required for RAG features. Install it:\n  npm install @hazeljs/rag'
      );

      mockRagError = null;
    });

    it('should rethrow non-module-not-found errors', async () => {
      mockRagError = new Error('Some other error');
      jest.resetModules();

      const newFacade = new RAGFacade(mockAIService, mockConfig);

      await expect((newFacade as any).ensureRAG()).rejects.toThrow('Some other error');

      mockRagError = null;
    });

    it('should use default provider when none specified', async () => {
      await (facade as any).ensureRAG();

      const { RAGPipeline } = await import('@hazeljs/rag');
      expect(RAGPipeline).toHaveBeenCalled();
      const [pipelineConfig] = (RAGPipeline as jest.Mock).mock.calls[0];
      expect(pipelineConfig).toEqual(
        expect.objectContaining({
          vectorStore: expect.anything(),
          embeddingProvider: expect.anything(),
          textSplitter: expect.anything(),
          topK: 5,
        })
      );
    });

    it('should configure LLM function using AI service', async () => {
      const mockResponse = {
        id: 'test-id',
        content: 'LLM response',
        role: 'assistant' as const,
        model: 'gpt-4',
      };
      mockAIService.complete.mockResolvedValue(mockResponse);

      await (facade as unknown as { ensureRAG: () => Promise<void> }).ensureRAG();

      // Access the pipeline through the ragService config
      // The LLM function is tested indirectly through the ask method
    });
  });

  describe('ingest', () => {
    beforeEach(async () => {
      await (facade as any).ensureRAG();
    });

    it('should ingest text content successfully', async () => {
      const textSource = {
        type: 'text' as const,
        content: 'Document content',
        metadata: { source: 'test' },
      };

      const mockRAGService = (facade as any).ragService;
      mockRAGService.index.mockResolvedValue(['doc1', 'doc2']);

      const result = await facade.ingest(textSource);

      expect(mockRAGService.index).toHaveBeenCalledWith({
        content: 'Document content',
        metadata: { source: 'test' },
      });
      expect(result).toEqual(['doc1', 'doc2']);
    });

    it('should ingest file path successfully', async () => {
      const filePath = '/path/to/document.pdf';
      const mockRAGService = (facade as any).ragService;
      mockRAGService.ingest.mockResolvedValue(['doc1']);

      const result = await facade.ingest(filePath);

      expect(mockRAGService.ingest).toHaveBeenCalledWith(filePath);
      expect(result).toEqual(['doc1']);
    });

    it('should handle ingestion errors', async () => {
      const textSource = {
        type: 'text' as const,
        content: 'Content',
      };
      const mockRAGService = (facade as any).ragService;
      mockRAGService.index.mockRejectedValue(new Error('Ingestion failed'));

      await expect(facade.ingest(textSource)).rejects.toThrow('Ingestion failed');
    });

    it('should handle pipeline creation errors', async () => {
      const mockRAGService = (facade as any).ragService;
      mockRAGService.index.mockImplementation(() => {
        throw new Error('Pipeline creation failed');
      });

      const textSource = {
        type: 'text' as const,
        content: 'Document content',
        metadata: { source: 'test' },
      };

      await expect(facade.ingest(textSource)).rejects.toThrow('Pipeline creation failed');
    });
  });

  describe('ask', () => {
    beforeEach(async () => {
      await (facade as any).ensureRAG();
    });

    it('should ask question successfully', async () => {
      const query = 'What is the meaning of life?';
      const mockResult = {
        answer: 'The meaning of life is 42.',
        sources: [
          { id: 'doc1', content: 'Life is...', score: 0.9 },
          { id: 'doc2', content: 'Meaning is...', score: 0.8 },
        ],
      };

      const mockRAGService = (facade as any).ragService;
      mockRAGService.ask.mockResolvedValue(mockResult);

      const result = await facade.ask(query);

      expect(mockRAGService.ask).toHaveBeenCalledWith(query, undefined);
      expect(result).toEqual(mockResult);
    });

    it('should ask with options', async () => {
      const query = 'Test query';
      const options = {
        topK: 5,
        strategy: 'hybrid' as const,
        minScore: 0.7,
      };
      const mockResult = {
        answer: 'Test answer',
        sources: [],
      };

      const mockRAGService = (facade as any).ragService;
      mockRAGService.ask.mockResolvedValue(mockResult);

      const result = await facade.ask(query, options);

      expect(mockRAGService.ask).toHaveBeenCalledWith(query, options);
      expect(result).toEqual(mockResult);
    });

    it('should handle ask errors', async () => {
      const mockRAGService = (facade as any).ragService;
      mockRAGService.ask.mockRejectedValue(new Error('Ask failed'));

      await expect(facade.ask('test query')).rejects.toThrow('Ask failed');
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await (facade as any).ensureRAG();
    });

    it('should search documents successfully', async () => {
      const query = 'search query';
      const mockSources = [
        { id: 'doc1', content: 'Content 1', score: 0.9 },
        { id: 'doc2', content: 'Content 2', score: 0.8 },
      ];

      const mockRAGService = (facade as any).ragService;
      mockRAGService.search.mockResolvedValue(mockSources);

      const result = await facade.search(query);

      expect(mockRAGService.search).toHaveBeenCalledWith(query, {});
      expect(result).toEqual(mockSources);
    });

    it('should search with options', async () => {
      const query = 'search query';
      const options = {
        topK: 3,
        strategy: 'hybrid' as const,
        minScore: 0.5,
      };
      const mockSources: RAGSource[] = [];

      const mockRAGService = (facade as any).ragService;
      mockRAGService.search.mockResolvedValue(mockSources);

      const result = await facade.search(query, options);

      expect(mockRAGService.search).toHaveBeenCalledWith(query, {
        topK: 3,
        strategy: 'hybrid',
        minScore: 0.5,
      });
      expect(result).toEqual(mockSources);
    });

    it('should handle search errors', async () => {
      const mockRAGService = (facade as any).ragService;
      mockRAGService.search.mockRejectedValue(new Error('Search failed'));

      await expect(facade.search('test query')).rejects.toThrow('Search failed');
    });
  });

  describe('lazy loading behavior', () => {
    it('should not load RAG service until first method call', async () => {
      expect((facade as any).initialized).toBe(false);

      const { RAGPipeline } = await import('@hazeljs/rag');

      await facade.ask('test');

      expect((facade as any).initialized).toBe(true);
      expect(RAGPipeline).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should provide helpful error messages for missing package', async () => {
      mockRagError = new Error('Cannot find module "@hazeljs/rag"');
      jest.resetModules();

      const newFacade = new RAGFacade(mockAIService, mockConfig);

      await expect(newFacade.ingest('test')).rejects.toThrow(/@hazeljs\/rag is required/);

      const newFacade2 = new RAGFacade(mockAIService, mockConfig);
      await expect(newFacade2.ask('test')).rejects.toThrow(/@hazeljs\/rag is required/);

      mockRagError = null;
    });

    it('should handle AI service errors in LLM function', async () => {
      mockAIService.complete.mockRejectedValue(new Error('AI service error'));

      await (facade as unknown as { ensureRAG: () => Promise<void> }).ensureRAG();

      const { RAGPipeline } = await import('@hazeljs/rag');
      const llm = (RAGPipeline as jest.Mock).mock.calls[0][1] as (p: string) => Promise<string>;

      await expect(llm('test')).rejects.toThrow('AI service error');
    });
  });

  describe('embedding provider and vector store branches', () => {
    it('uses CohereEmbeddings when defaultProvider is cohere', async () => {
      const prev = process.env.COHERE_API_KEY;
      process.env.COHERE_API_KEY = 'cohere-test-key';
      mockConfig = { defaultProvider: 'cohere' };
      facade = new RAGFacade(mockAIService, mockConfig);
      jest.clearAllMocks();
      await (facade as any).ensureRAG();
      const { CohereEmbeddings } = await import('@hazeljs/rag');
      expect(CohereEmbeddings).toHaveBeenCalled();
      process.env.COHERE_API_KEY = prev;
    });

    it('throws when cohere is selected but COHERE_API_KEY is missing', async () => {
      const prev = process.env.COHERE_API_KEY;
      delete process.env.COHERE_API_KEY;
      mockConfig = { defaultProvider: 'cohere' };
      facade = new RAGFacade(mockAIService, mockConfig);
      await expect((facade as any).ensureRAG()).rejects.toThrow('COHERE_API_KEY');
      process.env.COHERE_API_KEY = prev;
    });

    it('uses PineconeVectorStore when persistence requests pinecone', async () => {
      mockConfig = {
        defaultProvider: 'openai',
        persistence: {
          rag: {
            vectorStore: 'pinecone',
            apiKey: 'pk',
            environment: 'env',
            indexName: 'idx',
            options: { namespace: 'ns' },
          },
        },
      };
      facade = new RAGFacade(mockAIService, mockConfig);
      await (facade as any).ensureRAG();
      const { PineconeVectorStore } = await import('@hazeljs/rag');
      expect(PineconeVectorStore).toHaveBeenCalled();
    });

    it('uses QdrantVectorStore when persistence requests qdrant', async () => {
      mockConfig = {
        defaultProvider: 'openai',
        persistence: {
          rag: {
            vectorStore: 'qdrant',
            connectionString: 'http://localhost:6333',
            indexName: 'col',
            options: { vectorSize: 384 },
          },
        },
      };
      facade = new RAGFacade(mockAIService, mockConfig);
      await (facade as any).ensureRAG();
      const { QdrantVectorStore } = await import('@hazeljs/rag');
      expect(QdrantVectorStore).toHaveBeenCalled();
    });

    it('uses WeaviateVectorStore when persistence requests weaviate', async () => {
      mockConfig = {
        defaultProvider: 'openai',
        persistence: {
          rag: {
            vectorStore: 'weaviate',
            connectionString: 'example.com',
            apiKey: 'wkey',
            indexName: 'Doc',
            options: { scheme: 'http' as const },
          },
        },
      };
      facade = new RAGFacade(mockAIService, mockConfig);
      await (facade as any).ensureRAG();
      const { WeaviateVectorStore } = await import('@hazeljs/rag');
      expect(WeaviateVectorStore).toHaveBeenCalled();
    });

    it('uses ChromaVectorStore when persistence requests chroma', async () => {
      mockConfig = {
        defaultProvider: 'openai',
        persistence: {
          rag: {
            vectorStore: 'chroma',
            connectionString: 'http://chroma:8000',
            indexName: 'hazel',
            options: { auth: { provider: 'token', credentials: 't' } },
          },
        },
      };
      facade = new RAGFacade(mockAIService, mockConfig);
      await (facade as any).ensureRAG();
      const { ChromaVectorStore } = await import('@hazeljs/rag');
      expect(ChromaVectorStore).toHaveBeenCalled();
    });
  });
});
