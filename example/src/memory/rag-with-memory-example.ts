/**
 * RAG with Memory Example
 * Demonstrates integrating memory with RAG for context-aware responses
 */

import {
  RAGPipelineWithMemory,
  MemoryManager,
  HybridMemory,
  BufferMemory,
  VectorMemory,
  MemoryVectorStore,
  OpenAIEmbeddings,
  RecursiveTextSplitter,
} from '@hazeljs/rag';

async function ragWithMemoryExample() {
  console.log('🤖 RAG with Memory Example\n');

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  OPENAI_API_KEY not found in environment variables.');
    console.log('   Set it with: export OPENAI_API_KEY=your-key-here');
    return;
  }

  // 1. Setup embeddings
  console.log('1️⃣  Setting up embeddings...');
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'text-embedding-3-small',
  });

  // 2. Setup hybrid memory (buffer + vector)
  console.log('2️⃣  Setting up hybrid memory...');
  const buffer = new BufferMemory({ maxSize: 20 });
  const memoryVectorStore = new MemoryVectorStore(embeddings);
  const vectorMemory = new VectorMemory(memoryVectorStore, embeddings);
  const hybridMemory = new HybridMemory(buffer, vectorMemory, {
    archiveThreshold: 15,
  });

  // 3. Create memory manager
  const memoryManager = new MemoryManager(hybridMemory, {
    maxConversationLength: 20,
    summarizeAfter: 50,
    entityExtraction: true,
  });

  // 4. Setup document vector store
  console.log('3️⃣  Setting up document vector store...');
  const documentVectorStore = new MemoryVectorStore(embeddings);
  
  // 5. Setup text splitter
  const textSplitter = new RecursiveTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  // 6. Create LLM function (mock for this example)
  const llmFunction = async (prompt: string): Promise<string> => {
    // In a real application, this would call OpenAI API
    // For this example, we'll return a mock response
    console.log('\n📤 Prompt sent to LLM:');
    console.log('─'.repeat(60));
    console.log(prompt.substring(0, 300) + '...');
    console.log('─'.repeat(60));
    
    return `Based on the provided context and conversation history, I can help you with that. 
The HazelJS framework is designed for building AI-native applications with built-in support for RAG, 
memory management, and persistent context. It uses TypeScript decorators for clean, declarative code.`;
  };

  // 7. Create RAG pipeline with memory
  console.log('4️⃣  Creating RAG pipeline with memory...');
  const rag = new RAGPipelineWithMemory(
    {
      vectorStore: documentVectorStore,
      embeddingProvider: embeddings,
      textSplitter,
      topK: 5,
    },
    memoryManager,
    llmFunction
  );

  await rag.initialize();
  console.log('✅ RAG pipeline initialized\n');

  // 8. Add documents to knowledge base
  console.log('5️⃣  Adding documents to knowledge base...');
  await rag.addDocuments([
    {
      content: 'HazelJS is a modern TypeScript framework for building AI-native applications. It provides built-in support for RAG, memory management, and persistent context.',
      metadata: { source: 'docs', category: 'intro' },
    },
    {
      content: 'The memory system in HazelJS supports conversation tracking, entity extraction, fact storage, and semantic search. It uses hybrid storage combining fast buffers with vector databases.',
      metadata: { source: 'docs', category: 'memory' },
    },
    {
      content: 'RAG (Retrieval-Augmented Generation) combines document retrieval with LLMs. HazelJS makes it easy to implement RAG with decorators and a simple API.',
      metadata: { source: 'docs', category: 'rag' },
    },
    {
      content: 'HazelJS supports multiple vector stores including Pinecone, Qdrant, Weaviate, and ChromaDB. It also provides an in-memory store for development.',
      metadata: { source: 'docs', category: 'vector-stores' },
    },
  ]);
  console.log('✅ Documents added\n');

  // 9. Simulate a conversation with memory
  console.log('6️⃣  Starting conversation with memory...\n');
  
  const sessionId = 'user-session-456';
  const userId = 'user-123';

  // First query
  console.log('👤 User: What is HazelJS?');
  const response1 = await rag.queryWithMemory(
    'What is HazelJS?',
    sessionId,
    userId
  );
  console.log(`🤖 Assistant: ${response1.answer}\n`);
  console.log(`📚 Sources used: ${response1.sources.length}`);
  console.log(`🧠 Memories retrieved: ${response1.memories.length}\n`);

  // Second query - references previous conversation
  console.log('👤 User: Does it support memory management?');
  const response2 = await rag.queryWithMemory(
    'Does it support memory management?',
    sessionId,
    userId
  );
  console.log(`🤖 Assistant: ${response2.answer}\n`);
  console.log(`📚 Sources used: ${response2.sources.length}`);
  console.log(`🧠 Memories retrieved: ${response2.memories.length}`);
  console.log(`💬 Conversation history: ${response2.conversationHistory.length} messages\n`);

  // Third query - uses context from entire conversation
  console.log('👤 User: What vector stores does it support?');
  const response3 = await rag.queryWithMemory(
    'What vector stores does it support?',
    sessionId,
    userId
  );
  console.log(`🤖 Assistant: ${response3.answer}\n`);

  // 10. Store a fact manually
  console.log('7️⃣  Storing user preference...');
  await rag.storeFact(
    'User prefers detailed technical explanations',
    sessionId,
    userId
  );
  console.log('✅ Fact stored\n');

  // 11. Query with learning (auto-extracts facts)
  console.log('8️⃣  Query with automatic fact extraction...');
  console.log('👤 User: Tell me about the decorator pattern in HazelJS');
  const response4 = await rag.queryWithLearning(
    'Tell me about the decorator pattern in HazelJS',
    sessionId,
    userId
  );
  console.log(`🤖 Assistant: ${response4.answer}\n`);
  console.log('✅ Facts automatically extracted and stored\n');

  // 12. Get conversation summary
  console.log('9️⃣  Getting conversation summary...');
  const summary = await rag.getConversationSummary(sessionId);
  console.log('📋 Conversation Summary:');
  console.log(`   ${summary.substring(0, 200)}...\n`);

  // 13. Get memory statistics
  console.log('🔟 Memory Statistics...');
  const stats = await rag.getMemoryStats(sessionId);
  console.log('📊 Stats:');
  console.log(`   Total memories: ${stats.totalMemories}`);
  console.log(`   Conversations: ${stats.byType.conversation}`);
  console.log(`   Facts: ${stats.byType.fact}`);
  console.log(`   Entities: ${stats.byType.entity}\n`);

  // 14. Recall facts
  console.log('1️⃣1️⃣  Recalling facts about user preferences...');
  const facts = await rag.recallFacts('user preferences', 3);
  console.log('🔍 Recalled facts:');
  facts.forEach((fact, i) => {
    console.log(`   ${i + 1}. ${fact}`);
  });
  console.log();

  console.log('✅ RAG with memory example completed!\n');
}

// Run the example
if (require.main === module) {
  ragWithMemoryExample()
    .then(() => {
      console.log('🎉 Example finished successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { ragWithMemoryExample };
