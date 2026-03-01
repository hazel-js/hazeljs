/**
 * Basic Agentic RAG Example
 * Demonstrates core agentic RAG features
 */

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

import {
  AgenticRAGService,
  QueryPlanner,
  SelfReflective,
  AdaptiveRetrieval,
  Cached,
  MemoryVectorStore,
  OpenAIEmbeddings,
  Document,
} from '@hazeljs/rag';

async function basicExample() {
  console.log('🤖 Basic Agentic RAG Example\n');

  // 1. Setup vector store
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'text-embedding-3-small',
  });
  const vectorStore = new MemoryVectorStore(embeddings);

  await vectorStore.initialize();

  // 2. Add sample documents
  const documents: Document[] = [
    {
      id: '1',
      content: 'Machine learning is a subset of artificial intelligence that focuses on algorithms that learn from data.',
      metadata: { source: 'ml-basics.pdf', timestamp: new Date() },
    },
    {
      id: '2',
      content: 'Deep learning uses neural networks with multiple layers to process complex patterns in data.',
      metadata: { source: 'deep-learning.pdf', timestamp: new Date() },
    },
    {
      id: '3',
      content: 'Natural language processing enables computers to understand and generate human language.',
      metadata: { source: 'nlp-guide.pdf', timestamp: new Date() },
    },
    {
      id: '4',
      content: 'Transformers are a type of neural network architecture that revolutionized NLP tasks.',
      metadata: { source: 'transformers.pdf', timestamp: new Date() },
    },
    {
      id: '5',
      content: 'Reinforcement learning trains agents to make decisions by rewarding desired behaviors.',
      metadata: { source: 'rl-intro.pdf', timestamp: new Date() },
    },
  ];

  await vectorStore.addDocuments(documents);
  console.log(`✅ Indexed ${documents.length} documents\n`);

  // 3. Create Agentic RAG service
  const agenticRAG = new AgenticRAGService({
    vectorStore,
    enableAllFeatures: true,
  });

  // 4. Example 1: Basic retrieval with adaptive strategy
  console.log('📝 Example 1: Adaptive Retrieval\n');
  const results1 = await agenticRAG.retrieve('What is machine learning?', {
    topK: 3,
  });

  console.log(`Found ${results1.length} results:`);
  results1.forEach((result, i) => {
    console.log(`${i + 1}. ${result.content.slice(0, 80)}...`);
    console.log(`   Score: ${result.score?.toFixed(3)}\n`);
  });

  // 5. Example 2: Complex query with query planning
  console.log('\n📝 Example 2: Query Planning (Complex Query)\n');
  const results2 = await agenticRAG.retrieve(
    'Compare machine learning and deep learning, and explain how they relate to NLP',
    { topK: 5 }
  );

  console.log(`Found ${results2.length} results for complex query:`);
  results2.forEach((result, i) => {
    console.log(`${i + 1}. ${result.content.slice(0, 80)}...`);
  });

  // 6. Example 3: Cached retrieval (second call should be instant)
  console.log('\n📝 Example 3: Caching\n');
  const start = Date.now();
  await agenticRAG.retrieve('What is machine learning?', { topK: 3 });
  const firstCallTime = Date.now() - start;

  const start2 = Date.now();
  await agenticRAG.retrieve('What is machine learning?', { topK: 3 });
  const cachedCallTime = Date.now() - start2;

  console.log(`First call: ${firstCallTime}ms`);
  console.log(`Cached call: ${cachedCallTime}ms`);
  console.log(`Speedup: ${(firstCallTime / cachedCallTime).toFixed(1)}x faster\n`);

  console.log('✅ Basic examples completed!\n');
}

// Run example
if (require.main === module) {
  basicExample().catch(console.error);
}

export { basicExample };
