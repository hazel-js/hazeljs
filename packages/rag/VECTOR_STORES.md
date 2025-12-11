# Vector Stores Guide

HazelJS RAG supports 5 different vector stores. Each requires its own client library to be installed.

## Quick Start

### Memory Vector Store (Built-in)
No additional dependencies required. Perfect for development and testing.

```bash
# No installation needed!
```

```typescript
import { MemoryVectorStore, OpenAIEmbeddings } from '@hazeljs/rag';

const embeddings = new OpenAIEmbeddings({ apiKey: '...' });
const vectorStore = new MemoryVectorStore(embeddings);
await vectorStore.initialize();
```

---

## Production Vector Stores

### Pinecone (Managed, Serverless)

**Install:**
```bash
npm install @pinecone-database/pinecone
```

**Setup:**
```typescript
import { PineconeVectorStore, OpenAIEmbeddings } from '@hazeljs/rag';

const embeddings = new OpenAIEmbeddings({ apiKey: '...' });
const vectorStore = new PineconeVectorStore(embeddings, {
  apiKey: process.env.PINECONE_API_KEY,
  environment: 'us-east-1-aws',
  indexName: 'my-index',
  namespace: 'production', // optional
});

await vectorStore.initialize();
```

**Get API Key:** https://www.pinecone.io/

---

### Qdrant (High-Performance, Self-Hosted)

**Install:**
```bash
npm install @qdrant/js-client-rest
```

**Start Qdrant:**
```bash
docker run -p 6333:6333 qdrant/qdrant
```

**Setup:**
```typescript
import { QdrantVectorStore, OpenAIEmbeddings } from '@hazeljs/rag';

const embeddings = new OpenAIEmbeddings({ apiKey: '...' });
const vectorStore = new QdrantVectorStore(embeddings, {
  url: 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY, // optional for local
  collectionName: 'my-collection',
});

await vectorStore.initialize();
```

**Learn More:** https://qdrant.tech/

---

### Weaviate (GraphQL, Semantic Search)

**Install:**
```bash
npm install weaviate-ts-client
```

**Start Weaviate:**
```bash
docker run -p 8080:8080 semitechnologies/weaviate:latest
```

**Setup:**
```typescript
import { WeaviateVectorStore, OpenAIEmbeddings } from '@hazeljs/rag';

const embeddings = new OpenAIEmbeddings({ apiKey: '...' });
const vectorStore = new WeaviateVectorStore(embeddings, {
  scheme: 'http',
  host: 'localhost:8080',
  apiKey: process.env.WEAVIATE_API_KEY, // optional for local
  className: 'MyDocuments',
});

await vectorStore.initialize();
```

**Learn More:** https://weaviate.io/

---

### ChromaDB (Embedded, Lightweight)

**Install:**
```bash
npm install chromadb
```

**Start ChromaDB:**
```bash
docker run -p 8000:8000 chromadb/chroma
```

**Setup:**
```typescript
import { ChromaVectorStore, OpenAIEmbeddings } from '@hazeljs/rag';

const embeddings = new OpenAIEmbeddings({ apiKey: '...' });
const vectorStore = new ChromaVectorStore(embeddings, {
  url: 'http://localhost:8000',
  collectionName: 'my-collection',
});

await vectorStore.initialize();
```

**Learn More:** https://www.trychroma.com/

---

## Comparison

| Feature | Memory | Pinecone | Qdrant | Weaviate | ChromaDB |
|---------|--------|----------|--------|----------|----------|
| **Setup** | None | API Key | Docker | Docker | Docker |
| **Persistence** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Scalability** | Low | High | High | High | Medium |
| **Cost** | Free | Paid | Free (OSS) | Free (OSS) | Free (OSS) |
| **Best For** | Dev/Test | Production | High-perf | GraphQL | Prototyping |
| **Metadata Filtering** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Hybrid Search** | ❌ | ✅ | ✅ | ✅ | ❌ |
| **Multi-tenancy** | ❌ | ✅ | ✅ | ✅ | ❌ |

---

## Common Operations

All vector stores implement the same interface:

```typescript
// Initialize
await vectorStore.initialize();

// Add documents
const ids = await vectorStore.addDocuments([
  {
    content: 'Document text',
    metadata: { category: 'tech' },
  },
]);

// Search
const results = await vectorStore.search('query', {
  topK: 5,
  minScore: 0.7,
  filter: { category: 'tech' },
});

// Get document
const doc = await vectorStore.getDocument(ids[0]);

// Update document
await vectorStore.updateDocument(ids[0], {
  content: 'Updated text',
});

// Delete documents
await vectorStore.deleteDocuments([ids[0]]);

// Clear all
await vectorStore.clear();
```

---

## Choosing a Vector Store

### For Development
- **Memory**: Quick prototyping, no setup
- **ChromaDB**: Local development with persistence

### For Production
- **Pinecone**: Fully managed, zero ops, auto-scaling
- **Qdrant**: Self-hosted, high performance, cost-effective
- **Weaviate**: GraphQL API, advanced semantic features

### By Use Case
- **Small datasets (<10K docs)**: Memory or ChromaDB
- **Medium datasets (10K-1M docs)**: Any production store
- **Large datasets (>1M docs)**: Pinecone, Qdrant, or Weaviate
- **Serverless/Edge**: Pinecone
- **On-premise**: Qdrant or Weaviate
- **GraphQL required**: Weaviate

---

## Troubleshooting

### "Cannot find module '@qdrant/js-client-rest'"
Install the Qdrant client: `npm install @qdrant/js-client-rest`

### "Cannot find module 'weaviate-ts-client'"
Install the Weaviate client: `npm install weaviate-ts-client`

### "Cannot find module 'chromadb'"
Install the ChromaDB client: `npm install chromadb`

### Connection errors
Make sure the vector database server is running:
- Qdrant: `docker run -p 6333:6333 qdrant/qdrant`
- Weaviate: `docker run -p 8080:8080 semitechnologies/weaviate:latest`
- ChromaDB: `docker run -p 8000:8000 chromadb/chroma`

---

## Examples

See the `example/src/rag/` directory for complete examples:
- `simple-rag-example.ts` - Basic RAG usage
- `decorator-rag-example.ts` - Decorator-based API
- `advanced-rag-example.ts` - Hybrid search, multi-query
- `vector-stores-example.ts` - All vector stores comparison

---

## License

MIT
