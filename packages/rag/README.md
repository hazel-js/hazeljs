# @hazeljs/rag

**Your docs. Your data. AI that actually knows them.**

Load documents from any source, build a knowledge graph, embed into vector stores, and retrieve answers with semantic, hybrid, or graph-based search. Full RAG + GraphRAG pipeline — no PhD required.

[![npm version](https://img.shields.io/npm/v/@hazeljs/rag.svg)](https://www.npmjs.com/package/@hazeljs/rag)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/rag)](https://www.npmjs.com/package/@hazeljs/rag)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- 📂 **11 Document Loaders** — TXT, Markdown, JSON, CSV, HTML, PDF, DOCX, web scraping, YouTube transcripts, GitHub repos, and inline text. All return the same `Document[]` interface.
- 🕸️ **GraphRAG** — Extract entities and relationships from documents, build a knowledge graph, detect communities, and answer questions with entity-centric (local), thematic (global), or hybrid search.
- 🔍 **Vector Search** — Semantic similarity search with configurable embeddings and vector stores
- 🤖 **RAG Pipeline** — Complete load → split → embed → retrieve → augment workflow
- 🎯 **Multiple Strategies** — Similarity, Hybrid (vector + BM25), Multi-Query retrieval
- 🔌 **5 Vector Stores** — Memory, Pinecone, Qdrant, Weaviate, ChromaDB (unified interface)
- 🌐 **Embedding Providers** — OpenAI and Cohere, easily extensible
- ✂️ **Smart Text Splitting** — Recursive, character, and token splitters
- 📊 **Metadata Filtering** — Filter results by any metadata field
- 🧠 **Memory System** — Conversation history, entity memory, fact storage, working memory

---

## Installation

```bash
npm install @hazeljs/rag
```

### Optional peer dependencies

Install only what you need:

```bash
# LLM (required for GraphRAG and RAG query synthesis)
npm install openai

# Vector stores
npm install @pinecone-database/pinecone   # Pinecone
npm install @qdrant/js-client-rest        # Qdrant
npm install weaviate-ts-client            # Weaviate
npm install chromadb                      # ChromaDB

# Alternative embedding providers
npm install cohere-ai

# Document loaders
npm install pdf-parse   # PdfLoader
npm install mammoth     # DocxLoader
npm install cheerio     # HtmlFileLoader / WebLoader CSS selectors

# Memory backend (for createHazelMemoryStoreAdapter from @hazeljs/rag/memory-hazel)
npm install @hazeljs/memory
```

---

## Quick Start

### Basic RAG pipeline

```typescript
import {
  RAGPipeline,
  MemoryVectorStore,
  OpenAIEmbeddings,
  RecursiveTextSplitter,
  DirectoryLoader,
} from '@hazeljs/rag';

const embeddings = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });
const vectorStore = new MemoryVectorStore(embeddings);

const rag = new RAGPipeline({
  vectorStore,
  embeddingProvider: embeddings,
  textSplitter: new RecursiveTextSplitter({ chunkSize: 800, chunkOverlap: 150 }),
  topK: 5,
});
await rag.initialize();

// Load from disk — auto-detects file types
const docs = await new DirectoryLoader({ dirPath: './knowledge-base', recursive: true }).load();
await rag.addDocuments(docs);

const result = await rag.query('What is HazelJS?', { topK: 3 });
console.log(result.answer);
console.log(result.sources);
```

---

## Document Loaders

Every loader extends `BaseDocumentLoader` and returns `Document[]` ready for chunking and indexing.

### Built-in loaders

| Loader | Source | Extra install |
|--------|--------|:---:|
| `TextFileLoader` | `.txt` files | — |
| `MarkdownFileLoader` | `.md` / `.mdx` with heading splits and YAML front-matter | — |
| `JSONFileLoader` | `.json` with `textKey` / JSON Pointer extraction | — |
| `CSVFileLoader` | `.csv` rows mapped to documents | — |
| `HtmlFileLoader` | `.html` tag stripping; optional CSS selector via cheerio | opt. |
| `DirectoryLoader` | Recursive walk; auto-detects loader by extension | — |
| `PdfLoader` | PDFs; split by page or full document | `pdf-parse` |
| `DocxLoader` | Word documents; plain text or HTML output | `mammoth` |
| `WebLoader` | HTTP scraping with retry/timeout; optional CSS selector | opt. |
| `YouTubeTranscriptLoader` | YouTube transcripts; no API key; segment by duration | — |
| `GitHubLoader` | GitHub REST API; filter by path, extension, `maxFiles` | — |

### Examples

```typescript
import {
  TextFileLoader,
  MarkdownFileLoader,
  JSONFileLoader,
  CSVFileLoader,
  PdfLoader,
  DocxLoader,
  WebLoader,
  YouTubeTranscriptLoader,
  GitHubLoader,
  DirectoryLoader,
} from '@hazeljs/rag';

// Plain text
const textDocs = await new TextFileLoader({ filePath: './notes.txt' }).load();

// Markdown — one document per heading section
const mdDocs = await new MarkdownFileLoader({
  filePath: './guide.md',
  splitByHeading: true,
  parseYamlFrontMatter: true,
}).load();

// JSON — extract the 'body' field from each element
const jsonDocs = await new JSONFileLoader({ filePath: './articles.json', textKey: 'body' }).load();

// CSV — map columns to content / metadata
const csvDocs = await new CSVFileLoader({
  filePath: './faqs.csv',
  contentColumns: ['question', 'answer'],
  metadataColumns: ['category'],
}).load();

// PDF — one document per page
const pdfDocs = await new PdfLoader({ filePath: './report.pdf', splitByPage: true }).load();

// DOCX
const wordDocs = await new DocxLoader({ filePath: './agreement.docx' }).load();

// Web scraping
const webDocs = await new WebLoader({
  urls: ['https://hazeljs.com/docs', 'https://hazeljs.com/blog'],
  timeout: 10_000,
  maxRetries: 3,
}).load();

// YouTube transcript (no API key needed)
const ytDocs = await new YouTubeTranscriptLoader({
  videoUrl: 'https://www.youtube.com/watch?v=VIDEO_ID',
  segmentDuration: 60,   // group into 60-second chunks
}).load();

// GitHub repository
const githubDocs = await new GitHubLoader({
  owner: 'hazeljs',
  repo: 'hazel',
  directory: 'docs',
  extensions: ['.md'],
  token: process.env.GITHUB_TOKEN,
}).load();

// Directory — auto-detects every file type
const allDocs = await new DirectoryLoader({
  dirPath: './knowledge-base',
  recursive: true,
  extensions: ['.md', '.txt', '.pdf'],
}).load();
```

### Custom loaders

```typescript
import { BaseDocumentLoader, Loader, DocumentLoaderRegistry } from '@hazeljs/rag';

@Loader({ name: 'NotionLoader', extensions: [] })
export class NotionLoader extends BaseDocumentLoader {
  constructor(private readonly databaseId: string) { super(); }

  async load() {
    const pages = await fetchNotionPages(this.databaseId);
    return pages.map(p =>
      this.createDocument(p.content, { source: `notion:${p.id}`, title: p.title }),
    );
  }
}

// Register so DirectoryLoader can auto-detect it
DocumentLoaderRegistry.register(NotionLoader, (id: string) => new NotionLoader(id));
```

---

## GraphRAG

GraphRAG builds a **knowledge graph** from your documents — entities, relationships, and community clusters — and enables three complementary search modes that go far beyond cosine similarity.

### Why GraphRAG?

| Question type | Traditional RAG | GraphRAG |
|---|---|---|
| "What does X do?" | ✅ Good | ✅ Excellent (entity traversal) |
| "How do X and Y relate?" | ❌ Poor | ✅ Excellent (relationships) |
| "What are the main architectural layers?" | ❌ Poor | ✅ Excellent (community reports) |
| Multi-document cross-referencing | ❌ Fragmented | ✅ Native |

### Build the graph

```typescript
import OpenAI from 'openai';
import { GraphRAGPipeline, DirectoryLoader } from '@hazeljs/rag';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const graphRag = new GraphRAGPipeline({
  // Provider-agnostic: any LLM that accepts a string prompt
  llm: async (prompt) => {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });
    return res.choices[0].message.content ?? '';
  },
  extractionChunkSize: 2000,      // chars per LLM extraction call
  generateCommunityReports: true, // LLM summaries per community cluster
  maxCommunitySize: 15,           // split clusters larger than this
  localSearchDepth: 2,            // BFS hops for local search
  localSearchTopK: 5,             // seed entities per query
  globalSearchTopK: 5,            // community reports for global search
});

const docs = await new DirectoryLoader({ dirPath: './knowledge-base', recursive: true }).load();
const stats = await graphRag.build(docs);
// { documentsProcessed, entitiesExtracted, relationshipsExtracted,
//   communitiesDetected, communityReportsGenerated, duration }
```

### Search modes

```typescript
// LOCAL — entity-centric, BFS graph traversal
// Best for: specific questions about named concepts, classes, or technologies
const local = await graphRag.search(
  'How does dependency injection work?',
  { mode: 'local' },
);
console.log(local.answer);
console.log(local.entities);      // entities found and traversed
console.log(local.relationships); // evidence relationships

// GLOBAL — community report ranking
// Best for: broad thematic questions, architecture overviews
const global = await graphRag.search(
  'What are the main architectural layers of this system?',
  { mode: 'global' },
);
console.log(global.communities);  // ranked community reports used

// HYBRID — runs both in parallel, single synthesis call (recommended default)
const result = await graphRag.search('What vector stores does @hazeljs/rag support?');
// mode defaults to 'hybrid'
console.log(`${result.mode} search in ${result.duration}ms`);
```

### Incremental updates

```typescript
const newDocs = await new WebLoader({ urls: ['https://hazeljs.com/blog/new'] }).load();
await graphRag.addDocuments(newDocs);
// Re-runs community detection and regenerates reports automatically
```

### Inspect the graph

```typescript
const graph = graphRag.getGraph();

// Entities, relationships, community reports
console.log([...graph.entities.values()].slice(0, 5));
console.log([...graph.relationships.values()].slice(0, 5));
console.log([...graph.communityReports.values()].map(r => r.title));

// Statistics
const stats = graphRag.getStats();
console.log(stats.entityTypeBreakdown);   // { TECHNOLOGY: 14, CONCEPT: 12, ... }
console.log(stats.topEntities.slice(0, 5)); // most-connected entities
```

---

## Vector Stores

All stores implement the same interface — swap them with a one-line change.

```typescript
import { MemoryVectorStore, OpenAIEmbeddings } from '@hazeljs/rag';

// Development
const vectorStore = new MemoryVectorStore(embeddings);

// Pinecone (production, serverless)
import { PineconeVectorStore } from '@hazeljs/rag';
const vectorStore = new PineconeVectorStore(embeddings, {
  apiKey: process.env.PINECONE_API_KEY,
  indexName: 'my-knowledge-base',
});

// Qdrant (high-performance, self-hosted)
import { QdrantVectorStore } from '@hazeljs/rag';
const vectorStore = new QdrantVectorStore(embeddings, {
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  collectionName: 'my-collection',
});

// Weaviate (GraphQL, flexible)
import { WeaviateVectorStore } from '@hazeljs/rag';
const vectorStore = new WeaviateVectorStore(embeddings, {
  host: process.env.WEAVIATE_HOST || 'http://localhost:8080',
  className: 'MyKnowledgeBase',
});

// ChromaDB (prototyping)
import { ChromaVectorStore } from '@hazeljs/rag';
const vectorStore = new ChromaVectorStore(embeddings, {
  url: process.env.CHROMA_URL || 'http://localhost:8000',
  collectionName: 'my-collection',
});
```

### Vector store comparison

| | Memory | Pinecone | Qdrant | Weaviate | ChromaDB |
|---|:---:|:---:|:---:|:---:|:---:|
| Setup | None | API Key | Docker | Docker | Docker |
| Persistence | ❌ | ✅ | ✅ | ✅ | ✅ |
| Best for | Dev/Test | Production | High-perf | GraphQL | Prototyping |
| Cost | Free | Paid | OSS | OSS | OSS |

---

## Embedding Providers

```typescript
import { OpenAIEmbeddings, CohereEmbeddings } from '@hazeljs/rag';

// OpenAI
const openaiEmbed = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-small',  // 1536 dims
  // model: 'text-embedding-3-large', // 3072 dims, highest quality
});

// Cohere (multilingual)
const cohereEmbed = new CohereEmbeddings({
  apiKey: process.env.COHERE_API_KEY,
  model: 'embed-multilingual-v3.0',
});
```

---

## Retrieval Strategies

```typescript
import { HybridSearchRetrieval, MultiQueryRetrieval } from '@hazeljs/rag';

// Hybrid — vector + BM25 keyword fusion
const hybrid = new HybridSearchRetrieval(vectorStore, {
  vectorWeight: 0.7,
  keywordWeight: 0.3,
  topK: 10,
});
const results = await hybrid.search('machine learning algorithms', { topK: 5 });

// Multi-query — LLM generates N query variations, deduplicates results
const multiQuery = new MultiQueryRetrieval(vectorStore, {
  llmApiKey: process.env.OPENAI_API_KEY,
  numQueries: 3,
  topK: 10,
});
const results2 = await multiQuery.search('How do I deploy my app?', { topK: 5 });
```

---

## Text Splitting

```typescript
import { RecursiveTextSplitter } from '@hazeljs/rag';

const splitter = new RecursiveTextSplitter({
  chunkSize: 1000,      // target chars per chunk
  chunkOverlap: 200,    // overlap for context continuity
  separators: ['\n\n', '\n', '. ', ' '],
});

const chunks = splitter.split(longDocument);
```

---

## Memory System

```typescript
import {
  RAGPipelineWithMemory,
  MemoryManager,
  HybridMemory,
  BufferMemory,
  VectorMemory,
} from '@hazeljs/rag';

const buffer = new BufferMemory({ maxSize: 20 });
const vectorMemory = new VectorMemory(vectorStore, embeddings);
const memory = new MemoryManager(new HybridMemory(buffer, vectorMemory));

const rag = new RAGPipelineWithMemory(config, memory, llmFunction);

const response = await rag.queryWithMemory(
  'What did we discuss about deployment?',
  'session-123',
  'user-456',
);
console.log(response.answer);
console.log(response.memories);
```

### Using @hazeljs/memory as the backend

To back RAG (and agent) memory with **@hazeljs/memory** (in-memory, Prisma, Redis, etc.) in-process, install the optional peer and use the adapter:

```bash
npm install @hazeljs/memory
```

```typescript
import { MemoryManager, RAGPipelineWithMemory } from '@hazeljs/rag';
import { createHazelMemoryStoreAdapter } from '@hazeljs/rag/memory-hazel';
import { MemoryService, createDefaultMemoryStore } from '@hazeljs/memory';

// One store and one MemoryManager at app level (in-process, no separate service)
const hazelStore = createDefaultMemoryStore();
const memoryService = new MemoryService(hazelStore);
const ragStore = createHazelMemoryStoreAdapter(memoryService);
const memoryManager = new MemoryManager(ragStore);

// Pass the same MemoryManager to RAG and to every AgentRuntime for shared memory
const rag = new RAGPipelineWithMemory(config, memoryManager, llmFunction);
// agentRuntime = new AgentRuntime({ ..., memoryManager });
```

- **In-process:** RAG, agents, and memory run in the same Node.js process; no HTTP, no separate memory service.
- **Shared memory:** Create one store and one `MemoryManager` once, then pass the same instance into `RAGPipelineWithMemory` and every `AgentRuntime`.
- For Prisma or other backends, use `createPrismaMemoryStore` (or the appropriate factory) from `@hazeljs/memory` and pass it to `MemoryService` before wrapping with `createHazelMemoryStoreAdapter`.

---

## API Reference

### `GraphRAGPipeline`

```typescript
class GraphRAGPipeline {
  constructor(config: GraphRAGConfig);
  build(docs: Document[]): Promise<GraphBuildStats>;
  addDocuments(docs: Document[]): Promise<GraphBuildStats>;
  search(query: string, options?: GraphSearchOptions): Promise<GraphSearchResult>;
  getGraph(): KnowledgeGraph;
  getStats(): GraphStats;
  clear(): void;
}
```

### `RAGPipeline`

```typescript
class RAGPipeline {
  constructor(config: RAGConfig, llmFunction?: LLMFunction);
  initialize(): Promise<void>;
  addDocuments(documents: Document[]): Promise<string[]>;
  query(query: string, options?: RAGQueryOptions): Promise<RAGResponse>;
  search(query: string, options?: QueryOptions): Promise<SearchResult[]>;
  deleteDocuments(ids: string[]): Promise<void>;
  clear(): Promise<void>;
}
```

### `Document`

```typescript
interface Document {
  id?: string;
  content: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
}
```

---

## Use Cases

- 📖 **Documentation Q&A** — Index all your docs and answer developer questions
- 🕸️ **Codebase Understanding** — GraphRAG over a repo to explain architecture and dependencies
- 💬 **Context-Aware Chatbots** — RAG + memory for multi-turn conversations
- 🔍 **Enterprise Knowledge Base** — Combine web, GitHub, PDFs, and internal wikis
- 🎓 **Research Assistants** — Multi-document reasoning with knowledge graph traversal
- 📝 **Content Intelligence** — Semantic search + relationship mapping across articles

---

## License

Apache 2.0

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.
