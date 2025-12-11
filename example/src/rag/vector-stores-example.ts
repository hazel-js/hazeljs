/**
 * Vector Stores Comparison Example
 * Demonstrates all available vector store integrations
 */

import {
  MemoryVectorStore,
  PineconeVectorStore,
  QdrantVectorStore,
  WeaviateVectorStore,
  ChromaVectorStore,
  OpenAIEmbeddings,
  Document,
  VectorStore,
} from '@hazeljs/rag';

// Sample documents for testing
const sampleDocuments: Document[] = [
  {
    content: 'TypeScript is a strongly typed programming language that builds on JavaScript.',
    metadata: { category: 'programming', language: 'typescript' },
  },
  {
    content: 'React is a JavaScript library for building user interfaces.',
    metadata: { category: 'framework', language: 'javascript' },
  },
  {
    content: 'Node.js is a JavaScript runtime built on Chrome V8 engine.',
    metadata: { category: 'runtime', language: 'javascript' },
  },
  {
    content: 'Python is a high-level programming language known for simplicity.',
    metadata: { category: 'programming', language: 'python' },
  },
  {
    content: 'Docker is a platform for developing, shipping, and running applications in containers.',
    metadata: { category: 'devops', language: 'general' },
  },
];

/**
 * Generic function to test any vector store
 */
async function testVectorStore(
  name: string,
  vectorStore: VectorStore,
  description: string
): Promise<void> {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${name}`);
  console.log('='.repeat(70));
  console.log(description);
  console.log();

  try {
    // Initialize
    console.log('⏳ Initializing...');
    await vectorStore.initialize();
    console.log('✅ Initialized');

    // Add documents
    console.log(`⏳ Indexing ${sampleDocuments.length} documents...`);
    const ids = await vectorStore.addDocuments(sampleDocuments);
    console.log(`✅ Indexed ${ids.length} documents`);

    // Search
    console.log('\n🔍 Searching for: "JavaScript programming"');
    const results = await vectorStore.search('JavaScript programming', { topK: 3 });
    
    console.log(`\n� Found ${results.length} results:`);
    results.forEach((r, i) => {
      console.log(`\n[${i + 1}] Score: ${r.score.toFixed(4)}`);
      console.log(`    Content: ${r.content.substring(0, 70)}...`);
      console.log(`    Category: ${r.metadata?.category || 'N/A'}`);
    });

    // Test metadata filtering (if supported)
    console.log('\n🔍 Searching with filter: category="programming"');
    const filteredResults = await vectorStore.search('programming language', {
      topK: 2,
      filter: { category: 'programming' },
    });
    console.log(`📊 Found ${filteredResults.length} filtered results`);

    // Get a specific document
    if (ids.length > 0) {
      console.log(`\n📄 Retrieving document by ID: ${ids[0]}`);
      const doc = await vectorStore.getDocument(ids[0]);
      if (doc) {
        console.log(`✅ Retrieved: ${doc.content.substring(0, 50)}...`);
      }
    }

    // Update a document
    if (ids.length > 0) {
      console.log(`\n✏️  Updating document ${ids[0]}`);
      await vectorStore.updateDocument(ids[0], {
        content: 'TypeScript is an amazing strongly typed programming language!',
      });
      console.log('✅ Document updated');
    }

    // Delete a document
    if (ids.length > 1) {
      console.log(`\n🗑️  Deleting document ${ids[1]}`);
      await vectorStore.deleteDocuments([ids[1]]);
      console.log('✅ Document deleted');
    }

    console.log(`\n✨ ${name} test completed successfully!`);
  } catch (error: any) {
    console.error(`\n❌ Error testing ${name}:`, error.message);
  }
}

async function demonstrateMemoryStore() {
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'text-embedding-3-small',
  });

  const vectorStore = new MemoryVectorStore(embeddings);

  await testVectorStore(
    '📦 Memory Vector Store',
    vectorStore,
    'Best for: Development, Testing, Small Datasets\n' +
    'Pros: Fast, No setup, No dependencies\n' +
    'Cons: Not persistent, Limited scalability'
  );
}

async function demonstratePinecone() {
  if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_ENVIRONMENT || !process.env.PINECONE_INDEX) {
    console.log('\n⚠️  Pinecone not configured. Set these environment variables:');
    console.log('   - PINECONE_API_KEY');
    console.log('   - PINECONE_ENVIRONMENT (e.g., us-east-1-aws)');
    console.log('   - PINECONE_INDEX (your index name)');
    return;
  }

  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'text-embedding-3-small',
  });

  const vectorStore = new PineconeVectorStore(embeddings, {
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
    indexName: process.env.PINECONE_INDEX,
    namespace: 'hazeljs-test',
  });

  await testVectorStore(
    '🌲 Pinecone Vector Store',
    vectorStore,
    'Best for: Production, Serverless, Managed\n' +
    'Pros: Fully managed, Auto-scaling, Low latency\n' +
    'Cons: Requires API key, Paid service'
  );
}

async function demonstrateQdrant() {
  try {
    // Check if Qdrant client is installed
    require.resolve('@qdrant/js-client-rest');
  } catch (error) {
    console.log('\n⚠️  Qdrant client not installed.');
    console.log('   Install with: npm install @qdrant/js-client-rest');
    console.log('   Then start Qdrant: docker run -p 6333:6333 qdrant/qdrant');
    return;
  }

  const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
  
  console.log(`\n⚡ Attempting to connect to Qdrant at ${qdrantUrl}`);
  console.log('   To start Qdrant: docker run -p 6333:6333 qdrant/qdrant\n');

  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'text-embedding-3-small',
  });

  const vectorStore = new QdrantVectorStore(embeddings, {
    url: qdrantUrl,
    apiKey: process.env.QDRANT_API_KEY,
    collectionName: 'hazeljs_test',
  });

  await testVectorStore(
    '⚡ Qdrant Vector Store',
    vectorStore,
    'Best for: High-performance, Self-hosted, Production\n' +
    'Pros: Fast (Rust-based), Advanced filtering, Open-source\n' +
    'Cons: Requires server setup'
  );
}

async function demonstrateWeaviate() {
  try {
    // Check if Weaviate client is installed
    require.resolve('weaviate-ts-client');
  } catch (error) {
    console.log('\n⚠️  Weaviate client not installed.');
    console.log('   Install with: npm install weaviate-ts-client');
    console.log('   Then start Weaviate: docker run -p 8080:8080 semitechnologies/weaviate:latest');
    return;
  }

  const weaviateHost = process.env.WEAVIATE_HOST || 'localhost:8080';
  
  console.log(`\n🔷 Attempting to connect to Weaviate at ${weaviateHost}`);
  console.log('   To start Weaviate: docker run -p 8080:8080 semitechnologies/weaviate:latest\n');

  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'text-embedding-3-small',
  });

  const vectorStore = new WeaviateVectorStore(embeddings, {
    scheme: 'http',
    host: weaviateHost,
    apiKey: process.env.WEAVIATE_API_KEY,
    className: 'HazelTest',
  });

  await testVectorStore(
    '🔷 Weaviate Vector Store',
    vectorStore,
    'Best for: GraphQL API, Semantic search, Production\n' +
    'Pros: GraphQL interface, Modular, Open-source\n' +
    'Cons: Requires server setup'
  );
}

async function demonstrateChroma() {
  try {
    // Check if ChromaDB client is installed
    require.resolve('chromadb');
  } catch (error) {
    console.log('\n⚠️  ChromaDB client not installed.');
    console.log('   Install with: npm install chromadb');
    console.log('   Then start ChromaDB: docker run -p 8000:8000 chromadb/chroma');
    return;
  }

  const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000';
  
  console.log(`\n🎨 Attempting to connect to ChromaDB at ${chromaUrl}`);
  console.log('   To start ChromaDB: docker run -p 8000:8000 chromadb/chroma\n');

  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'text-embedding-3-small',
  });

  const vectorStore = new ChromaVectorStore(embeddings, {
    url: chromaUrl,
    collectionName: 'hazeljs_test',
  });

  await testVectorStore(
    '🎨 ChromaDB Vector Store',
    vectorStore,
    'Best for: Embedded, Local development, Lightweight\n' +
    'Pros: Easy setup, Lightweight, Python/JS support\n' +
    'Cons: Limited scalability for large datasets'
  );

  // ChromaDB-specific features
  try {
    console.log('\n📊 ChromaDB-specific features:');
    const stats = await vectorStore.getStats();
    console.log(`   Collection size: ${stats.count} documents`);

    const preview = await vectorStore.peek(3);
    console.log(`   Preview: ${preview.length} documents`);
  } catch (error: any) {
    console.log(`   ⚠️  Could not fetch stats: ${error.message}`);
  }
}

function showComparison() {
  console.log('\n\n📊 === Vector Store Comparison ===\n');

  const comparison = [
    {
      name: 'Memory',
      deployment: 'In-Process',
      scalability: '⭐',
      performance: '⭐⭐⭐⭐⭐',
      features: '⭐⭐',
      cost: 'Free',
      bestFor: 'Development, Testing',
    },
    {
      name: 'Pinecone',
      deployment: 'Managed Cloud',
      scalability: '⭐⭐⭐⭐⭐',
      performance: '⭐⭐⭐⭐⭐',
      features: '⭐⭐⭐⭐⭐',
      cost: 'Paid (Free tier)',
      bestFor: 'Production, Serverless',
    },
    {
      name: 'Qdrant',
      deployment: 'Self-hosted/Cloud',
      scalability: '⭐⭐⭐⭐⭐',
      performance: '⭐⭐⭐⭐⭐',
      features: '⭐⭐⭐⭐⭐',
      cost: 'Free (OSS)',
      bestFor: 'High-performance apps',
    },
    {
      name: 'Weaviate',
      deployment: 'Self-hosted/Cloud',
      scalability: '⭐⭐⭐⭐',
      performance: '⭐⭐⭐⭐',
      features: '⭐⭐⭐⭐⭐',
      cost: 'Free (OSS)',
      bestFor: 'GraphQL, Semantic search',
    },
    {
      name: 'ChromaDB',
      deployment: 'Embedded/Server',
      scalability: '⭐⭐⭐',
      performance: '⭐⭐⭐⭐',
      features: '⭐⭐⭐⭐',
      cost: 'Free (OSS)',
      bestFor: 'Local dev, Prototyping',
    },
  ];

  console.log('┌─────────────┬──────────────────┬─────────────┬─────────────┬──────────┬──────────────────┬────────────────────────┐');
  console.log('│ Store       │ Deployment       │ Scalability │ Performance │ Features │ Cost             │ Best For               │');
  console.log('├─────────────┼──────────────────┼─────────────┼─────────────┼──────────┼──────────────────┼────────────────────────┤');

  comparison.forEach((store) => {
    console.log(
      `│ ${store.name.padEnd(11)} │ ${store.deployment.padEnd(16)} │ ${store.scalability.padEnd(11)} │ ${store.performance.padEnd(11)} │ ${store.features.padEnd(8)} │ ${store.cost.padEnd(16)} │ ${store.bestFor.padEnd(22)} │`
    );
  });

  console.log('└─────────────┴──────────────────┴─────────────┴─────────────┴──────────┴──────────────────┴────────────────────────┘');
}

function showFeatureMatrix() {
  console.log('\n\n🎯 === Feature Matrix ===\n');

  const features = [
    { feature: 'Semantic Search', memory: '✅', pinecone: '✅', qdrant: '✅', weaviate: '✅', chroma: '✅' },
    { feature: 'Metadata Filtering', memory: '✅', pinecone: '✅', qdrant: '✅', weaviate: '✅', chroma: '✅' },
    { feature: 'Hybrid Search', memory: '❌', pinecone: '✅', qdrant: '✅', weaviate: '✅', chroma: '❌' },
    { feature: 'Multi-tenancy', memory: '❌', pinecone: '✅', qdrant: '✅', weaviate: '✅', chroma: '❌' },
    { feature: 'GraphQL API', memory: '❌', pinecone: '❌', qdrant: '❌', weaviate: '✅', chroma: '❌' },
    { feature: 'Persistence', memory: '❌', pinecone: '✅', qdrant: '✅', weaviate: '✅', chroma: '✅' },
    { feature: 'Batch Operations', memory: '✅', pinecone: '✅', qdrant: '✅', weaviate: '✅', chroma: '✅' },
    { feature: 'CRUD Operations', memory: '✅', pinecone: '✅', qdrant: '✅', weaviate: '✅', chroma: '✅' },
  ];

  console.log('┌────────────────────┬────────┬──────────┬────────┬──────────┬────────┐');
  console.log('│ Feature            │ Memory │ Pinecone │ Qdrant │ Weaviate │ Chroma │');
  console.log('├────────────────────┼────────┼──────────┼────────┼──────────┼────────┤');

  features.forEach((f) => {
    console.log(
      `│ ${f.feature.padEnd(18)} │ ${f.memory.padEnd(6)} │ ${f.pinecone.padEnd(8)} │ ${f.qdrant.padEnd(6)} │ ${f.weaviate.padEnd(8)} │ ${f.chroma.padEnd(6)} │`
    );
  });

  console.log('└────────────────────┴────────┴──────────┴────────┴──────────┴────────┘');
}

async function main() {
  console.log('🚀 Vector Stores Comprehensive Guide\n');
  console.log('='.repeat(80));

  try {
    // Demonstrate each vector store
    await demonstrateMemoryStore();
    await demonstratePinecone();
    await demonstrateQdrant();
    await demonstrateWeaviate();
    await demonstrateChroma();

    // Show comparisons
    showComparison();
    showFeatureMatrix();

    console.log('\n' + '='.repeat(80));
    console.log('\n✨ All vector stores demonstrated!');
    console.log('\n💡 Choose based on your needs:');
    console.log('   - Development: Memory or ChromaDB');
    console.log('   - Production (Managed): Pinecone');
    console.log('   - Production (Self-hosted): Qdrant or Weaviate');
    console.log('   - Prototyping: ChromaDB');
    console.log('   - GraphQL needs: Weaviate');
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { main };
