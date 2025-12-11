# @hazeljs/rag

**Retrieval-Augmented Generation (RAG) and Vector Search for HazelJS**

Build powerful AI applications with semantic search, document retrieval, and LLM-augmented responses.

## Features

- 🔍 **Vector Search** - Semantic similarity search using embeddings
- 📚 **Document Management** - Load, split, and index documents
- 🤖 **RAG Pipeline** - Complete retrieval-augmented generation workflow
- 🎯 **Multiple Strategies** - Similarity, MMR (Maximal Marginal Relevance), Hybrid search
- 🔌 **Pluggable Backends** - Support for Pinecone, Weaviate, Qdrant, ChromaDB, and in-memory
- 🌐 **Multiple Embedding Providers** - OpenAI, Cohere, HuggingFace
- ✂️ **Smart Text Splitting** - Recursive text splitter with overlap
- 📊 **Metadata Filtering** - Filter results by custom metadata

## Installation

```bash
npm install @hazeljs/rag
```

### Optional Peer Dependencies

Install the vector store and embedding provider you want to use:

```bash
# OpenAI Embeddings
npm install openai

# Vector Stores (choose one or more)
npm install @pinecone-database/pinecone  # Pinecone
npm install weaviate-ts-client            # Weaviate
npm install @qdrant/js-client-rest        # Qdrant
npm install chromadb                      # ChromaDB

# Additional Embedding Providers
npm install cohere-ai                     # Cohere
npm install @huggingface/inference        # HuggingFace
```

## Quick Start

### Basic RAG Pipeline

```typescript
import {
  RAGPipeline,
  MemoryVectorStore,
  OpenAIEmbeddings,
  RecursiveTextSplitter,
} from '@hazeljs/rag';

// 1. Setup embedding provider
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'text-embedding-3-small',
});

// 2. Setup vector store
const vectorStore = new MemoryVectorStore(embeddings);

// 3. Setup text splitter
const textSplitter = new RecursiveTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

// 4. Create RAG pipeline
const rag = new RAGPipeline({
  vectorStore,
  embeddingProvider: embeddings,
  textSplitter,
  topK: 5,
});

// 5. Initialize
await rag.initialize();

// 6. Add documents
await rag.addDocuments([
  {
    content: 'HazelJS is a modern TypeScript framework for building scalable applications.',
    metadata: { source: 'docs', category: 'intro' },
  },
  {
    content: 'The framework includes built-in support for microservices, caching, and AI.',
    metadata: { source: 'docs', category: 'features' },
  },
]);

// 7. Query
const result = await rag.query('What is HazelJS?', {
  topK: 3,
  filter: { source: 'docs' },
});

console.log(result.answer);
console.log(result.sources);
```

### With LLM Integration

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Create LLM function
const llmFunction = async (prompt: string) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  });
  return response.choices[0].message.content || '';
};

// Create RAG pipeline with LLM
const rag = new RAGPipeline(config, llmFunction);

// Query with custom prompt
const result = await rag.query('What is HazelJS?', {
  llmPrompt: `Based on the following context, answer the question.

Context:
{context}

Question: {query}

Answer:`,
});
```

## Vector Stores

### Memory Vector Store (Development)

```typescript
import { MemoryVectorStore, OpenAIEmbeddings } from '@hazeljs/rag';

const embeddings = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY! });
const vectorStore = new MemoryVectorStore(embeddings);
```

### Pinecone (Production)

```typescript
import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeVectorStore } from '@hazeljs/rag';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pinecone.index('my-index');

const vectorStore = new PineconeVectorStore(index, embeddings);
```

### Qdrant

```typescript
import { QdrantClient } from '@qdrant/js-client-rest';
import { QdrantVectorStore } from '@hazeljs/rag';

const client = new QdrantClient({ url: 'http://localhost:6333' });
const vectorStore = new QdrantVectorStore(client, embeddings, {
  collectionName: 'my-collection',
});
```

## Embedding Providers

### OpenAI

```typescript
import { OpenAIEmbeddings } from '@hazeljs/rag';

const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'text-embedding-3-small', // or 'text-embedding-3-large'
  dimensions: 1536,
});
```

### Cohere

```typescript
import { CohereEmbeddings } from '@hazeljs/rag';

const embeddings = new CohereEmbeddings({
  apiKey: process.env.COHERE_API_KEY!,
  model: 'embed-english-v3.0',
});
```

### HuggingFace

```typescript
import { HuggingFaceEmbeddings } from '@hazeljs/rag';

const embeddings = new HuggingFaceEmbeddings({
  apiKey: process.env.HUGGINGFACE_API_KEY!,
  model: 'sentence-transformers/all-MiniLM-L6-v2',
});
```

## Text Splitting

### Recursive Text Splitter

```typescript
import { RecursiveTextSplitter } from '@hazeljs/rag';

const splitter = new RecursiveTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ['\n\n', '\n', '. ', ' ', ''],
});

const chunks = splitter.split(longText);
```

## Retrieval Strategies

### Similarity Search (Default)

```typescript
const results = await rag.retrieve('query', {
  topK: 5,
  strategy: RetrievalStrategy.SIMILARITY,
});
```

### MMR (Maximal Marginal Relevance)

Balances relevance and diversity to avoid redundant results:

```typescript
const results = await rag.retrieve('query', {
  topK: 5,
  strategy: RetrievalStrategy.MMR,
});
```

### Hybrid Search

Combines keyword and semantic search:

```typescript
const results = await rag.retrieve('query', {
  topK: 5,
  strategy: RetrievalStrategy.HYBRID,
});
```

## Metadata Filtering

```typescript
await rag.addDocuments([
  {
    content: 'Document 1',
    metadata: { category: 'tech', year: 2024 },
  },
  {
    content: 'Document 2',
    metadata: { category: 'science', year: 2023 },
  },
]);

// Filter by metadata
const results = await rag.query('query', {
  filter: { category: 'tech', year: 2024 },
});
```

## Advanced Usage

### Custom Document Loaders

```typescript
import { DocumentLoader, Document } from '@hazeljs/rag';

class PDFLoader implements DocumentLoader {
  constructor(private filePath: string) {}

  async load(): Promise<Document[]> {
    // Load and parse PDF
    const text = await this.parsePDF(this.filePath);
    return [{ content: text, metadata: { source: this.filePath } }];
  }

  private async parsePDF(path: string): Promise<string> {
    // PDF parsing logic
    return '';
  }
}

const loader = new PDFLoader('./document.pdf');
const documents = await loader.load();
await rag.addDocuments(documents);
```

### Batch Operations

```typescript
// Add multiple documents efficiently
const ids = await rag.addDocuments(documents);

// Delete multiple documents
await rag.deleteDocuments(ids);

// Clear all documents
await rag.clear();
```

## API Reference

### RAGPipeline

```typescript
class RAGPipeline {
  constructor(config: RAGConfig, llmFunction?: LLMFunction);
  initialize(): Promise<void>;
  addDocuments(documents: Document[]): Promise<string[]>;
  query(query: string, options?: RAGQueryOptions): Promise<RAGResponse>;
  retrieve(query: string, options?: QueryOptions, strategy?: RetrievalStrategy): Promise<SearchResult[]>;
  deleteDocuments(ids: string[]): Promise<void>;
  clear(): Promise<void>;
}
```

### Types

```typescript
interface Document {
  id?: string;
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[];
}

interface SearchResult {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  score: number;
  embedding?: number[];
}

interface RAGResponse {
  answer: string;
  sources: SearchResult[];
  context: string;
}
```

## Use Cases

- 📖 **Documentation Search** - Semantic search across documentation
- 💬 **Chatbots** - Context-aware conversational AI
- 🔍 **Knowledge Base** - Internal knowledge management
- 📝 **Content Recommendations** - Similar content discovery
- 🎓 **Educational Tools** - Q&A systems with source citations
- 🏢 **Enterprise Search** - Semantic search across company data

## Performance Tips

1. **Batch Operations** - Add documents in batches for better performance
2. **Chunk Size** - Balance between context and precision (500-1500 tokens)
3. **Overlap** - Use 10-20% overlap for better context continuity
4. **Caching** - Cache embeddings for frequently accessed documents
5. **Filtering** - Use metadata filters to reduce search space

## License

MIT

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.
