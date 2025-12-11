/**
 * Advanced RAG Example
 * Demonstrates advanced features: Hybrid Search, Multi-Query, Pinecone, Cohere
 */

import {
  MemoryVectorStore,
  OpenAIEmbeddings,
  CohereEmbeddings,
  HybridSearchRetrieval,
  MultiQueryRetrieval,
  Document,
} from '@hazeljs/rag';

async function demonstrateHybridSearch() {
  console.log('\n🔍 === Hybrid Search Demo ===\n');

  // Setup embeddings
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'text-embedding-3-small',
  });

  // Create vector store
  const vectorStore = new MemoryVectorStore(embeddings);
  await vectorStore.initialize();

  // Sample documents
  const documents: Document[] = [
    {
      content: 'TypeScript is a strongly typed programming language that builds on JavaScript.',
      metadata: { category: 'programming', language: 'typescript' },
    },
    {
      content: 'React is a JavaScript library for building user interfaces with components.',
      metadata: { category: 'framework', language: 'javascript' },
    },
    {
      content: 'Node.js is a JavaScript runtime built on Chrome V8 engine for server-side development.',
      metadata: { category: 'runtime', language: 'javascript' },
    },
    {
      content: 'Python is a high-level programming language known for its simplicity and readability.',
      metadata: { category: 'programming', language: 'python' },
    },
  ];

  // Index documents
  await vectorStore.addDocuments(documents);

  // Create hybrid search
  const hybridSearch = new HybridSearchRetrieval(vectorStore, {
    vectorWeight: 0.7,
    keywordWeight: 0.3,
  });

  // Index for BM25
  await hybridSearch.indexDocuments(
    documents.map((doc, idx) => ({
      id: `doc_${idx}`,
      content: doc.content,
    }))
  );

  // Perform hybrid search
  const results = await hybridSearch.search('JavaScript programming', { topK: 3 });

  console.log('Query: "JavaScript programming"');
  console.log('\nResults (combining vector + keyword search):');
  results.forEach((result, idx) => {
    console.log(`\n[${idx + 1}] Score: ${result.score.toFixed(3)}`);
    console.log(`Content: ${result.content.substring(0, 80)}...`);
  });
}

async function demonstrateMultiQuery() {
  console.log('\n\n🎯 === Multi-Query Retrieval Demo ===\n');

  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'text-embedding-3-small',
  });

  const vectorStore = new MemoryVectorStore(embeddings);
  await vectorStore.initialize();

  // Index documents
  const documents: Document[] = [
    {
      content: 'HazelJS provides built-in service discovery for microservices architectures.',
      metadata: { topic: 'microservices' },
    },
    {
      content: 'The framework includes RAG capabilities for building AI-powered applications.',
      metadata: { topic: 'ai' },
    },
    {
      content: 'HazelJS supports multiple vector databases including Pinecone and Qdrant.',
      metadata: { topic: 'databases' },
    },
  ];

  await vectorStore.addDocuments(documents);

  // Create multi-query retrieval
  const multiQuery = new MultiQueryRetrieval(vectorStore, {
    numQueries: 3,
    llmProvider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Perform multi-query retrieval
  console.log('Original Question: "What databases does HazelJS support?"');
  console.log('\nGenerating multiple search queries...');

  const results = await multiQuery.retrieve('What databases does HazelJS support?', {
    topK: 2,
  });

  console.log('\nCombined Results:');
  results.forEach((result, idx) => {
    console.log(`\n[${idx + 1}] Score: ${result.score.toFixed(3)}`);
    console.log(`Content: ${result.content}`);
  });
}

async function demonstrateCohereEmbeddings() {
  console.log('\n\n🌐 === Cohere Embeddings Demo ===\n');

  if (!process.env.COHERE_API_KEY) {
    console.log('⚠️  COHERE_API_KEY not set, skipping Cohere demo');
    return;
  }

  const embeddings = new CohereEmbeddings({
    apiKey: process.env.COHERE_API_KEY,
    model: 'embed-english-v3.0',
    inputType: 'search_document',
  });

  console.log(`Model: embed-english-v3.0`);
  console.log(`Dimension: ${embeddings.getDimension()}`);

  // Generate embeddings
  const text = 'HazelJS is a modern TypeScript framework';
  const embedding = await embeddings.embed(text);

  console.log(`\nText: "${text}"`);
  console.log(`Embedding length: ${embedding.length}`);
  console.log(`First 5 values: [${embedding.slice(0, 5).map((v) => v.toFixed(4)).join(', ')}...]`);

  // Batch embeddings
  const texts = [
    'TypeScript framework',
    'Microservices architecture',
    'Vector database',
  ];

  const batchEmbeddings = await embeddings.embedBatch(texts);
  console.log(`\nBatch embeddings generated: ${batchEmbeddings.length} documents`);
}

async function demonstrateProductionVectorStores() {
  console.log('\n\n💾 === Production Vector Stores ===\n');

  console.log('Available Vector Stores:');
  console.log('  ✅ MemoryVectorStore - In-memory (development)');
  console.log('  ✅ PineconeVectorStore - Managed, serverless');
  console.log('  ✅ QdrantVectorStore - High-performance, Rust-based');
  console.log('  ⏳ WeaviateVectorStore - Coming soon');
  console.log('  ⏳ ChromaVectorStore - Coming soon');

  console.log('\nExample Pinecone Setup:');
  console.log(`
import { PineconeVectorStore, OpenAIEmbeddings } from '@hazeljs/rag';

const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
});

const vectorStore = new PineconeVectorStore(embeddings, {
  apiKey: process.env.PINECONE_API_KEY,
  environment: 'us-east-1-aws',
  indexName: 'hazeljs-docs',
  namespace: 'production',
});

await vectorStore.initialize();
await vectorStore.addDocuments(documents);
const results = await vectorStore.search('query', { topK: 5 });
  `);

  console.log('\nExample Qdrant Setup:');
  console.log(`
import { QdrantVectorStore, OpenAIEmbeddings } from '@hazeljs/rag';

const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
});

const vectorStore = new QdrantVectorStore(embeddings, {
  url: 'http://localhost:6333',
  collectionName: 'hazeljs-docs',
});

await vectorStore.initialize();
await vectorStore.addDocuments(documents);
const results = await vectorStore.search('query', { topK: 5 });
  `);
}

async function main() {
  console.log('🚀 Advanced RAG Features Demo\n');
  console.log('='.repeat(60));

  try {
    // Run demos
    await demonstrateHybridSearch();
    await demonstrateMultiQuery();
    await demonstrateCohereEmbeddings();
    await demonstrateProductionVectorStores();

    console.log('\n\n' + '='.repeat(60));
    console.log('✨ All demos completed successfully!');
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { main };
