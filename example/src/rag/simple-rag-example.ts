/**
 * Simple RAG Example
 * Demonstrates basic RAG functionality with in-memory vector store
 */

import {
  RAGPipeline,
  MemoryVectorStore,
  OpenAIEmbeddings,
  RecursiveTextSplitter,
  Document,
} from '@hazeljs/rag';

async function main() {
  console.log('🚀 HazelJS RAG Example\n');

  // 1. Setup embedding provider
  console.log('📊 Setting up OpenAI embeddings...');
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'text-embedding-3-small',
    dimensions: 1536,
  });

  // 2. Setup vector store
  console.log('💾 Creating in-memory vector store...');
  const vectorStore = new MemoryVectorStore(embeddings);

  // 3. Setup text splitter
  console.log('✂️  Configuring text splitter...');
  const textSplitter = new RecursiveTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });

  // 4. Create RAG pipeline
  console.log('🔧 Initializing RAG pipeline...\n');
  const rag = new RAGPipeline({
    vectorStore,
    embeddingProvider: embeddings,
    textSplitter,
    topK: 3,
  });

  await rag.initialize();

  // 5. Add sample documents
  console.log('📚 Adding documents to knowledge base...');
  const documents: Document[] = [
    {
      content: `HazelJS is a modern, TypeScript-first framework for building scalable backend applications. 
      It provides a modular architecture with built-in support for dependency injection, decorators, and middleware.`,
      metadata: { source: 'intro', category: 'framework' },
    },
    {
      content: `The framework includes powerful features like service discovery, distributed caching, 
      microservices support, and AI integration. It's designed to make building complex applications simple and maintainable.`,
      metadata: { source: 'features', category: 'framework' },
    },
    {
      content: `HazelJS supports multiple database integrations through Prisma, including PostgreSQL, MySQL, 
      MongoDB, and SQLite. It also provides built-in caching with Redis and in-memory strategies.`,
      metadata: { source: 'database', category: 'integration' },
    },
    {
      content: `The @hazeljs/ai package provides seamless integration with OpenAI, Anthropic, and Google Gemini. 
      You can easily add AI capabilities to your applications with simple decorators and services.`,
      metadata: { source: 'ai', category: 'integration' },
    },
    {
      content: `Service discovery in HazelJS is inspired by Netflix Eureka. It supports multiple backends including 
      Redis, Consul, and Kubernetes, making it perfect for microservices architectures.`,
      metadata: { source: 'discovery', category: 'microservices' },
    },
    {
      content: `The @hazeljs/rag package brings retrieval-augmented generation capabilities with support for 
      vector databases like Pinecone, Weaviate, Qdrant, and ChromaDB. Perfect for building AI-powered search and chatbots.`,
      metadata: { source: 'rag', category: 'ai' },
    },
  ];

  const ids = await rag.addDocuments(documents);
  console.log(`✅ Added ${ids.length} documents\n`);

  // 6. Perform queries
  const queries = [
    'What is HazelJS?',
    'How does HazelJS handle databases?',
    'Tell me about AI features in HazelJS',
    'What microservices features are available?',
  ];

  for (const query of queries) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`❓ Query: "${query}"`);
    console.log('='.repeat(60));

    const result = await rag.query(query, {
      topK: 2,
      minScore: 0.5, // Lower threshold to show more results
    });

    if (result.sources.length === 0) {
      console.log('\n⚠️  No results found above similarity threshold');
    } else {
      console.log('\n📝 Top Results:');
      result.sources.forEach((source, idx) => {
        console.log(`\n[${idx + 1}] Score: ${source.score.toFixed(3)}`);
        console.log(`Content: ${source.content.substring(0, 150)}...`);
        console.log(`Metadata:`, source.metadata);
      });
    }
  }

  console.log('\n\n✨ Example completed!');
}

// Run the example
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}

export { main };
