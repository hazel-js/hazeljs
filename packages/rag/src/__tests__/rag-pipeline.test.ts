import { RAGPipeline } from '../rag-pipeline';
import { RetrievalStrategy } from '../types';
import type {
  VectorStore,
  SearchResult,
  EmbeddingProvider,
  TextSplitter,
  Document,
} from '../types';

function makeSearchResult(id: string, content: string, score = 0.9): SearchResult {
  return { id, content, score, metadata: { source: `${id}.txt` }, embedding: [0.1, 0.2, 0.3] };
}

function makeVectorStore(results: SearchResult[] = []): jest.Mocked<VectorStore> {
  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    addDocuments: jest.fn().mockResolvedValue(['id1']),
    search: jest.fn().mockResolvedValue(results),
    searchByVector: jest.fn().mockResolvedValue(results),
    deleteDocuments: jest.fn().mockResolvedValue(undefined),
    updateDocument: jest.fn().mockResolvedValue(undefined),
    getDocument: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  };
}

function makeEmbeddingProvider(): jest.Mocked<EmbeddingProvider> {
  return {
    embed: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    embedBatch: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
    getDimension: jest.fn().mockReturnValue(3),
  };
}

function makeTextSplitter(): jest.Mocked<TextSplitter> {
  return {
    split: jest.fn().mockReturnValue(['chunk 1', 'chunk 2']),
    splitDocuments: jest
      .fn()
      .mockImplementation((docs: Document[]) =>
        docs.map((d) => ({ ...d, content: d.content + ' (split)' }))
      ),
  };
}

describe('RAGPipeline', () => {
  describe('initialize', () => {
    it('calls vectorStore.initialize', async () => {
      const vs = makeVectorStore();
      const pipeline = new RAGPipeline({
        vectorStore: vs,
        embeddingProvider: makeEmbeddingProvider(),
      });
      await pipeline.initialize();
      expect(vs.initialize).toHaveBeenCalled();
    });
  });

  describe('addDocuments', () => {
    it('adds documents to the vector store', async () => {
      const vs = makeVectorStore();
      const pipeline = new RAGPipeline({
        vectorStore: vs,
        embeddingProvider: makeEmbeddingProvider(),
      });
      const docs: Document[] = [{ id: 'd1', content: 'Hello world', metadata: {} }];
      await pipeline.addDocuments(docs);
      expect(vs.addDocuments).toHaveBeenCalledWith(docs);
    });

    it('splits documents when textSplitter is configured', async () => {
      const vs = makeVectorStore();
      const splitter = makeTextSplitter();
      const pipeline = new RAGPipeline({
        vectorStore: vs,
        embeddingProvider: makeEmbeddingProvider(),
        textSplitter: splitter,
      });
      const docs: Document[] = [{ content: 'Hello world', metadata: {} }];
      await pipeline.addDocuments(docs);
      expect(splitter.splitDocuments).toHaveBeenCalledWith(docs);
      expect(vs.addDocuments).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ content: expect.stringContaining('(split)') }),
        ])
      );
    });
  });

  describe('query', () => {
    it('returns context when no LLM is configured', async () => {
      const vs = makeVectorStore([makeSearchResult('d1', 'TypeScript is great')]);
      const pipeline = new RAGPipeline({
        vectorStore: vs,
        embeddingProvider: makeEmbeddingProvider(),
      });
      const response = await pipeline.query('What is TypeScript?');
      expect(response.answer).toContain('TypeScript is great');
      expect(response.sources).toHaveLength(1);
      expect(response.context).toContain('TypeScript');
    });

    it('calls LLM when llmFunction and llmPrompt are both set', async () => {
      const vs = makeVectorStore([makeSearchResult('d1', 'TypeScript content')]);
      const llm = jest.fn().mockResolvedValue('Generated answer');
      const pipeline = new RAGPipeline(
        { vectorStore: vs, embeddingProvider: makeEmbeddingProvider() },
        llm
      );
      const response = await pipeline.query('query', {
        llmPrompt: 'Context: {context}\nQ: {query}',
      });
      expect(llm).toHaveBeenCalled();
      expect(response.answer).toBe('Generated answer');
    });

    it('does not call LLM when llmPrompt is missing', async () => {
      const vs = makeVectorStore([makeSearchResult('d1', 'content')]);
      const llm = jest.fn().mockResolvedValue('answer');
      const pipeline = new RAGPipeline(
        { vectorStore: vs, embeddingProvider: makeEmbeddingProvider() },
        llm
      );
      await pipeline.query('query');
      expect(llm).not.toHaveBeenCalled();
    });

    it('excludes context when includeContext is false', async () => {
      const vs = makeVectorStore([makeSearchResult('d1', 'content')]);
      const pipeline = new RAGPipeline({
        vectorStore: vs,
        embeddingProvider: makeEmbeddingProvider(),
      });
      const response = await pipeline.query('query', { includeContext: false });
      expect(response.context).toBe('');
    });

    it('uses config.topK when options.topK is omitted', async () => {
      const vs = makeVectorStore([]);
      const pipeline = new RAGPipeline({
        vectorStore: vs,
        embeddingProvider: makeEmbeddingProvider(),
        topK: 3,
      });
      await pipeline.query('query');
      expect(vs.search).toHaveBeenCalledWith('query', expect.objectContaining({ topK: 3 }));
    });
  });

  describe('retrieve strategies', () => {
    it('SIMILARITY strategy calls vectorStore.search', async () => {
      const vs = makeVectorStore([]);
      const pipeline = new RAGPipeline({
        vectorStore: vs,
        embeddingProvider: makeEmbeddingProvider(),
      });
      await pipeline.retrieve('query', {}, RetrievalStrategy.SIMILARITY);
      expect(vs.search).toHaveBeenCalled();
    });

    it('HYBRID strategy falls back to vectorStore.search', async () => {
      const vs = makeVectorStore([]);
      const pipeline = new RAGPipeline({
        vectorStore: vs,
        embeddingProvider: makeEmbeddingProvider(),
      });
      await pipeline.retrieve('query', {}, RetrievalStrategy.HYBRID);
      expect(vs.search).toHaveBeenCalled();
    });

    it('MMR strategy gets 3x candidates then runs MMR algorithm', async () => {
      const results = [
        makeSearchResult('d1', 'content 1'),
        makeSearchResult('d2', 'content 2'),
        makeSearchResult('d3', 'content 3'),
      ];
      const vs = makeVectorStore(results);
      const embedder = makeEmbeddingProvider();
      const pipeline = new RAGPipeline({ vectorStore: vs, embeddingProvider: embedder });
      const selected = await pipeline.retrieve('query', { topK: 2 }, RetrievalStrategy.MMR);
      expect(vs.search).toHaveBeenCalledWith(
        'query',
        expect.objectContaining({ topK: 6, includeEmbedding: true })
      );
      expect(selected.length).toBeLessThanOrEqual(2);
    });

    it('MMR returns empty array when no candidates', async () => {
      const vs = makeVectorStore([]);
      const pipeline = new RAGPipeline({
        vectorStore: vs,
        embeddingProvider: makeEmbeddingProvider(),
      });
      const selected = await pipeline.retrieve('query', {}, RetrievalStrategy.MMR);
      expect(selected).toHaveLength(0);
    });

    it('MMR skips candidates without embeddings', async () => {
      const results = [
        { id: 'd1', content: 'no embedding', score: 0.9, metadata: {} }, // no embedding
      ];
      const vs = makeVectorStore(results);
      const pipeline = new RAGPipeline({
        vectorStore: vs,
        embeddingProvider: makeEmbeddingProvider(),
      });
      const selected = await pipeline.retrieve('query', { topK: 1 }, RetrievalStrategy.MMR);
      expect(Array.isArray(selected)).toBe(true);
    });
  });

  describe('deleteDocuments & clear', () => {
    it('deleteDocuments delegates to vectorStore', async () => {
      const vs = makeVectorStore();
      const pipeline = new RAGPipeline({
        vectorStore: vs,
        embeddingProvider: makeEmbeddingProvider(),
      });
      await pipeline.deleteDocuments(['d1', 'd2']);
      expect(vs.deleteDocuments).toHaveBeenCalledWith(['d1', 'd2']);
    });

    it('clear delegates to vectorStore', async () => {
      const vs = makeVectorStore();
      const pipeline = new RAGPipeline({
        vectorStore: vs,
        embeddingProvider: makeEmbeddingProvider(),
      });
      await pipeline.clear();
      expect(vs.clear).toHaveBeenCalled();
    });
  });

  describe('buildContext', () => {
    it('includes metadata in context string', async () => {
      const vs = makeVectorStore([makeSearchResult('d1', 'Some content')]);
      const pipeline = new RAGPipeline({
        vectorStore: vs,
        embeddingProvider: makeEmbeddingProvider(),
      });
      const response = await pipeline.query('query');
      expect(response.context).toContain('[1]');
      expect(response.context).toContain('Some content');
    });
  });
});
